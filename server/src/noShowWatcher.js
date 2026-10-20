// ตัวตรวจเบื้องหลัง: ยกเลิกงานอัตโนมัติเมื่อแม่บ้านไม่กดเริ่มเดินทางภายในเวลาที่กำหนดหลังเวลานัด
const pool = require('./db');

// เลยเวลานัดกี่นาทีแล้วแม่บ้านยังไม่กดเริ่มเดินทาง จึงถือว่าไม่มาตามนัด (ตั้ง NO_SHOW_MINUTES=0 ใน .env เพื่อปิดระบบนี้)
const parsedMinutes = Number(process.env.NO_SHOW_MINUTES);
const NO_SHOW_MINUTES =
  process.env.NO_SHOW_MINUTES === undefined || Number.isNaN(parsedMinutes) ? 20 : parsedMinutes;
// หลังแม่บ้านแจ้งปัญหา รอแอดมินกี่นาที ถ้าเกินแล้วยังไม่มีใครดำเนินการ งานจะถูกยกเลิกอัตโนมัติ (ตั้ง PROBLEM_WAIT_MINUTES ใน .env, 0 = ปิด)
const parsedProblemMinutes = Number(process.env.PROBLEM_WAIT_MINUTES);
const PROBLEM_WAIT_MINUTES =
  process.env.PROBLEM_WAIT_MINUTES === undefined || Number.isNaN(parsedProblemMinutes) ? 10 : parsedProblemMinutes;
// หลังแม่บ้านกดรับงาน ลูกค้าต้องโอนเงินภายในกี่นาที ไม่เช่นนั้นงานถูกยกเลิกอัตโนมัติ (ตั้ง PAYMENT_TIMEOUT_MINUTES ใน .env, 0 = ปิด)
const parsedPaymentMinutes = Number(process.env.PAYMENT_TIMEOUT_MINUTES);
const PAYMENT_TIMEOUT_MINUTES =
  process.env.PAYMENT_TIMEOUT_MINUTES === undefined || Number.isNaN(parsedPaymentMinutes) ? 30 : parsedPaymentMinutes;
// เหตุผลที่บันทึกลง bookings.cancel_reason เมื่อยกเลิกเพราะลูกค้าไม่โอนเงิน (ใช้เป็นตัวระบุงานประเภทนี้เพื่อซ่อนจากประวัติของแม่บ้านด้วย)
const CUSTOMER_UNPAID_REASON = 'ลูกค้าไม่โอนเงินภายในเวลาที่กำหนด';
// ลูกค้าส่งสลิปแล้วแต่แอดมินยังไม่ตรวจสอบ: ถ้าใกล้เวลานัดไม่เกินกี่นาทีแล้วยังไม่ยืนยัน ให้ยกเลิกงานทันที (ตั้ง VERIFY_DEADLINE_MINUTES ใน .env, 0 = ปิด)
// ค่าเริ่มต้น 60 = ก่อนเวลานัด 1 ชั่วโมง (ตรงกับเวลาที่แม่บ้านเริ่มกดเดินทางได้พอดี)
const parsedVerifyMinutes = Number(process.env.VERIFY_DEADLINE_MINUTES);
const VERIFY_DEADLINE_MINUTES =
  process.env.VERIFY_DEADLINE_MINUTES === undefined || Number.isNaN(parsedVerifyMinutes) ? 60 : parsedVerifyMinutes;
// เหตุผลที่บันทึกลง bookings.cancel_reason เมื่อยกเลิกเพราะแอดมินไม่ตรวจสอบสลิปทันเวลา (ซ่อนจากประวัติของแม่บ้านเช่นเดียวกับกรณีลูกค้าไม่โอนเงิน)
const ADMIN_NO_VERIFY_REASON = 'แอดมินไม่ตรวจสอบสลิปทันเวลา';
// ตรวจทุก 1 นาที
const CHECK_INTERVAL_MS = 60 * 1000;

// นับเวลาจาก "เวลานัด หรือเวลาที่ชำระเงินสำเร็จ อันไหนทีหลังกว่า"
// กันกรณีแอดมินยืนยันการชำระเงินช้าจนเลยเวลานัดไปแล้ว แม่บ้านจะได้ไม่โดนยกเลิกทั้งที่ยังไม่มีโอกาสเริ่ม
// no_show_status = 'reported' คือสัญญาณให้ฝั่งแอดมินเห็นว่าต้องตรวจสอบ/คืนเงินลูกค้า
// ทำเป็น UPDATE คำสั่งเดียว: เลือกงาน confirmed ที่แม่บ้านรับแล้วแต่ job_started_at ยังว่าง และเลยเวลาเกินกำหนด แล้วเปลี่ยนเป็น cancelled
async function cancelNoShowJobs() {
  const [result] = await pool.query(
    `UPDATE bookings b
     LEFT JOIN booking_payments p ON p.booking_id = b.booking_id AND p.payment_status = 'paid'
     SET b.status = 'cancelled', b.no_show_status = 'reported'
     WHERE b.status = 'confirmed'
       AND b.maid_status = 'accepted'
       AND b.job_started_at IS NULL
       AND GREATEST(b.booking_date, COALESCE(p.paid_at, b.booking_date)) < (NOW() - INTERVAL ? MINUTE)`,
    [NO_SHOW_MINUTES]
  );

  // บันทึก log เฉพาะรอบที่มีงานถูกยกเลิก
  if (result.affectedRows > 0) {
    console.log(`[no-show] ยกเลิกงานที่แม่บ้านไม่เริ่มเดินทางตามกำหนด ${result.affectedRows} งาน`);
  }
}

// ยกเลิกงานที่แม่บ้านแจ้งปัญหาไว้ (status = investigating) และเคสล่าสุดยังรอดำเนินการเกินเวลา PROBLEM_WAIT_MINUTES
// ส่ง bookingId มาด้วยจะตรวจเฉพาะงานนั้น (ใช้ตอนหน้าจอแม่บ้านนับถอยหลังครบ) ไม่ส่งจะตรวจทุกงาน (ใช้ในตัวตรวจเบื้องหลัง)
// เวลาทั้งหมดคิดจากนาฬิกาของ server คืนจำนวนงานที่ถูกยกเลิก เคสในตาราง booking_refunds ยังเป็น investigating ให้แอดมินดำเนินการต่อ
async function cancelExpiredProblemReports(bookingId = null) {
  if (PROBLEM_WAIT_MINUTES <= 0) return 0;
  const [result] = await pool.query(
    `UPDATE bookings b
     JOIN booking_refunds r ON r.refund_id = (
       SELECT refund_id FROM booking_refunds
       WHERE booking_id = b.booking_id ORDER BY reported_at DESC LIMIT 1
     )
     SET b.status = 'cancelled'
     WHERE b.status = 'investigating'
       AND r.reason_type = 'maid_report'
       AND r.status = 'investigating'
       AND r.reported_at <= (NOW() - INTERVAL ? MINUTE)
       AND (? IS NULL OR b.booking_id = ?)`,
    [PROBLEM_WAIT_MINUTES, bookingId, bookingId]
  );
  if (result.affectedRows > 0 && bookingId === null) {
    console.log(`[problem-wait] ยกเลิกงานที่แจ้งปัญหาแล้วหมดเวลารอ ${result.affectedRows} งาน`);
  }
  return result.affectedRows;
}

// ยกเลิกงานที่แม่บ้านรับแล้วแต่ลูกค้ายังไม่โอนเงินภายใน PAYMENT_TIMEOUT_MINUTES นาทีนับจากเวลาที่แม่บ้านกดรับ (accepted_at)
// เฉพาะสถานะ waiting_payment เท่านั้น: ถ้าลูกค้าส่งสลิปแล้ว (verifying_payment) จะไม่ถูกยกเลิก เพราะรอแอดมินตรวจ
// งานเก่าที่ไม่มี accepted_at (รับไว้ก่อนเริ่มระบบนี้) จะไม่ถูกแตะ บันทึกเหตุผลลง cancel_reason
// UPDATE คำสั่งเดียวพร้อมเงื่อนไขสถานะ ถ้าลูกค้าส่งสลิปในจังหวะเดียวกัน จะมีฝ่ายเดียวที่สำเร็จ ไม่เกิดการยกเลิกซ้อนกับการชำระเงิน
async function cancelUnpaidJobs() {
  if (PAYMENT_TIMEOUT_MINUTES <= 0) return 0;
  const [result] = await pool.query(
    `UPDATE bookings
     SET status = 'cancelled', cancel_reason = ?
     WHERE status = 'waiting_payment'
       AND accepted_at IS NOT NULL
       AND accepted_at <= (NOW() - INTERVAL ? MINUTE)`,
    [CUSTOMER_UNPAID_REASON, PAYMENT_TIMEOUT_MINUTES]
  );
  if (result.affectedRows > 0) {
    console.log(`[unpaid] ยกเลิกงานที่ลูกค้าไม่โอนเงินภายในเวลา ${result.affectedRows} งาน`);
  }
  return result.affectedRows;
}

// ยกเลิกงานที่ลูกค้าส่งสลิปแล้ว (verifying_payment) แต่แอดมินยังไม่ยืนยันเมื่อเหลือเวลาก่อนเริ่มงานไม่เกิน VERIFY_DEADLINE_MINUTES นาที
// บันทึกเหตุผลลง cancel_reason ใบชำระเงินใน booking_payments ยังเป็น waiting_verify ไว้ เพื่อให้ฝั่งแอดมินเห็นว่าลูกค้าจ่ายแล้วและต้องคืนเงิน
// UPDATE คำสั่งเดียวพร้อมเงื่อนไขสถานะ ถ้าแอดมินกดยืนยันในจังหวะเดียวกัน จะมีฝ่ายเดียวที่สำเร็จ
async function cancelUnverifiedPayments() {
  if (VERIFY_DEADLINE_MINUTES <= 0) return 0;
  const [result] = await pool.query(
    `UPDATE bookings
     SET status = 'cancelled', cancel_reason = ?
     WHERE status = 'verifying_payment'
       AND booking_date <= (NOW() + INTERVAL ? MINUTE)`,
    [ADMIN_NO_VERIFY_REASON, VERIFY_DEADLINE_MINUTES]
  );
  if (result.affectedRows > 0) {
    console.log(`[verify] ยกเลิกงานที่แอดมินไม่ตรวจสอบสลิปทันเวลา ${result.affectedRows} งาน (ลูกค้าจ่ายแล้ว ต้องคืนเงิน)`);
  }
  return result.affectedRows;
}

// เริ่มตัวตรวจ: รันทันทีหนึ่งรอบ แล้วตั้งเวลาให้ทำซ้ำทุก 1 นาที ตรวจสองกฎ: แม่บ้านไม่มาตามนัด (NO_SHOW_MINUTES) และแจ้งปัญหาแล้วหมดเวลารอ (PROBLEM_WAIT_MINUTES)
// แต่ละกฎตั้งเป็น 0 เพื่อปิดแยกกันได้ ถ้าปิดทั้งคู่จะไม่เริ่มตัวตรวจ
function startNoShowWatcher() {
  if (NO_SHOW_MINUTES <= 0) {
    console.log('[no-show] ปิดระบบยกเลิกงานอัตโนมัติ (NO_SHOW_MINUTES=0)');
  }
  if (PROBLEM_WAIT_MINUTES <= 0) {
    console.log('[problem-wait] ปิดระบบยกเลิกงานหลังแจ้งปัญหา (PROBLEM_WAIT_MINUTES=0)');
  }
  if (PAYMENT_TIMEOUT_MINUTES <= 0) {
    console.log('[unpaid] ปิดระบบยกเลิกงานที่ลูกค้าไม่โอนเงิน (PAYMENT_TIMEOUT_MINUTES=0)');
  }
  if (VERIFY_DEADLINE_MINUTES <= 0) {
    console.log('[verify] ปิดระบบยกเลิกงานที่แอดมินไม่ตรวจสลิป (VERIFY_DEADLINE_MINUTES=0)');
  }
  if (NO_SHOW_MINUTES <= 0 && PROBLEM_WAIT_MINUTES <= 0 && PAYMENT_TIMEOUT_MINUTES <= 0 && VERIFY_DEADLINE_MINUTES <= 0) return;

  // ดัก error ของแต่ละกฎแยกกัน กันไม่ให้กฎที่พังทำให้อีกกฎหรือรอบถัดไปหยุดทำงาน
  const tick = () => {
    if (NO_SHOW_MINUTES > 0) cancelNoShowJobs().catch((err) => console.error('[no-show] error:', err));
    if (PROBLEM_WAIT_MINUTES > 0) cancelExpiredProblemReports().catch((err) => console.error('[problem-wait] error:', err));
    if (PAYMENT_TIMEOUT_MINUTES > 0) cancelUnpaidJobs().catch((err) => console.error('[unpaid] error:', err));
    if (VERIFY_DEADLINE_MINUTES > 0) cancelUnverifiedPayments().catch((err) => console.error('[verify] error:', err));
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log(`[watcher] เปิดตัวตรวจเบื้องหลัง: ไม่เริ่มเดินทางเลยเวลานัด ${NO_SHOW_MINUTES} นาที / แจ้งปัญหารอเกิน ${PROBLEM_WAIT_MINUTES} นาที / รอลูกค้าโอนเงินเกิน ${PAYMENT_TIMEOUT_MINUTES} นาที / แอดมินต้องยืนยันสลิปก่อนเริ่มงาน ${VERIFY_DEADLINE_MINUTES} นาที`);
}

module.exports = {
  startNoShowWatcher,
  cancelNoShowJobs,
  cancelExpiredProblemReports,
  cancelUnpaidJobs,
  cancelUnverifiedPayments,
  PROBLEM_WAIT_MINUTES,
  PAYMENT_TIMEOUT_MINUTES,
  CUSTOMER_UNPAID_REASON,
  VERIFY_DEADLINE_MINUTES,
  ADMIN_NO_VERIFY_REASON
};
