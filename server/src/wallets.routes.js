// API กระเป๋าเงินของแม่บ้าน: ดูยอดเงินและรายการรับเงิน, แก้บัญชีรับเงิน, ขอถอนเงิน และดูประวัติการถอน
const express = require('express');
const router = express.Router();
const pool = require('./db');

// ดึงข้อมูลกระเป๋าเงินและประวัติการทำรายการ
router.get('/', async (req, res) => {
  try {
    const { maid_id } = req.query; 
    if (!maid_id) {
      return res.status(400).json({ message: 'กรุณาส่ง maid_id' });
    }

    // 1. ดึงข้อมูลกระเป๋าเงิน (ยอดเงิน, บัญชีธนาคาร)
    const [wallets] = await pool.query(
      `SELECT wallet_id, bank_name, account_number, account_name, wallet_balance 
       FROM maid_wallets 
       WHERE maid_id = ?`,
      [maid_id]
    );

    // ถ้าแม่บ้านยังไม่มีกระเป๋าเงิน จะส่งค่าเริ่มต้นกลับไปแทน เพื่อให้หน้าจอแสดงผลได้ตามปกติ
    let walletData = null;
    let wallet_id = null;

    if (wallets.length > 0) {
      walletData = wallets[0];
      wallet_id = wallets[0].wallet_id;
    } else {
      // ถ้ายังไม่มีกระเป๋าเงิน (ข้อมูลสมมติไปก่อน หรือสร้างใหม่)
      walletData = {
        wallet_balance: 0,
        bank_name: 'ยังไม่ผูกบัญชี',
        account_number: 'ไม่มีข้อมูล',
        account_name: '-'
      };
    }

    // 2. ดึงรายการธุรกรรม (Transactions) ถ้ามี wallet_id
    let transactions = [];
    let pendingWithdrawalAmount = 0;
    
    if (wallet_id) {
      // รายการรับเงินทั้งหมด (เชื่อมกับงานเพื่อเอาชื่อสถานที่ไปแสดง) แล้วตามด้วยยอดที่ขอถอนไว้แต่ยังรอแอดมินอนุมัติ
      const [txs] = await pool.query(
        `SELECT 
          t.transaction_id,
          t.amount,
          t.type,
          t.created_at,
          b.location
         FROM wallet_transactions t
         LEFT JOIN bookings b ON t.reference_id = b.booking_id
         WHERE t.wallet_id = ? AND t.type <> 'withdrawal'
         ORDER BY t.created_at DESC`,
        [wallet_id]
      );
      transactions = txs;

      // ดึงยอดถอนเงินที่รออนุมัติ
      const [pendingRequests] = await pool.query(
        'SELECT SUM(amount) as total_pending FROM withdrawal_requests WHERE wallet_id = ? AND status = "pending"',
        [wallet_id]
      );
      pendingWithdrawalAmount = Number(pendingRequests[0].total_pending || 0);
    }

    res.json({
      wallet: walletData,
      pending_withdrawal: pendingWithdrawalAmount,
      transactions: transactions
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลกระเป๋าเงินได้' });
  }
});

// อัปเดตข้อมูลบัญชีรับเงิน
router.put('/account', async (req, res) => {
  try {
    const { maid_id, bank_name, account_number, account_name } = req.body;
    
    if (!maid_id || !bank_name || !account_number || !account_name) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ตรวจสอบว่ามีกระเป๋าเงินอยู่แล้วหรือไม่
    const [wallets] = await pool.query('SELECT wallet_id FROM maid_wallets WHERE maid_id = ?', [maid_id]);

    if (wallets.length > 0) {
      // มีกระเป๋าเงินแล้ว อัปเดตข้อมูล
      await pool.query(
        'UPDATE maid_wallets SET bank_name = ?, account_number = ?, account_name = ? WHERE maid_id = ?',
        [bank_name, account_number, account_name, maid_id]
      );
    } else {
      // สร้างกระเป๋าเงินใหม่ (สร้างรหัสกระเป๋าเงินสุ่มแบบง่ายๆ หรือกำหนดเอง)
      const wallet_id = 'W' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
      await pool.query(
        'INSERT INTO maid_wallets (wallet_id, maid_id, bank_name, account_number, account_name, wallet_balance) VALUES (?, ?, ?, ?, ?, 0)',
        [wallet_id, maid_id, bank_name, account_number, account_name]
      );
    }

    res.json({ message: 'อัปเดตบัญชีรับเงินเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
  }
});

// ส่งคำร้องขอถอนเงิน
router.post('/withdraw', async (req, res) => {
  // ใช้ transaction และล็อกแถวกระเป๋าเงิน (FOR UPDATE) กันการขอถอนซ้อนกันจนเกินยอดเงินที่มี
  const connection = await pool.getConnection();
  try {
    const { maid_id, amount } = req.body;
    
    // ต้องระบุจำนวนเงินเป็นตัวเลข และถอนขั้นต่ำ 100 บาท
    if (!maid_id || !amount || isNaN(amount) || amount < 100) {
      return res.status(400).json({ message: 'จำนวนเงินถอนขั้นต่ำคือ 100 บาท' });
    }

    await connection.beginTransaction();

    // 1. ตรวจสอบกระเป๋าเงิน
    const [wallets] = await connection.query(
      'SELECT wallet_id, wallet_balance, bank_name, account_number, account_name FROM maid_wallets WHERE maid_id = ? FOR UPDATE',
      [maid_id]
    );

    if (wallets.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'ไม่พบกระเป๋าเงิน' });
    }

    const wallet = wallets[0];

    // ตรวจสอบยอดคำร้องขอถอนเงินที่รอการอนุมัติอยู่
    const [pendingRequests] = await connection.query(
      'SELECT SUM(amount) as total_pending FROM withdrawal_requests WHERE wallet_id = ? AND status = "pending"',
      [wallet.wallet_id]
    );
    const pendingAmount = Number(pendingRequests[0].total_pending || 0);

    // หักลบยอดที่รออนุมัติ เพื่อดูว่ามีเงินเหลือให้ถอนได้เท่าไหร่
    const availableBalance = Number(wallet.wallet_balance) - pendingAmount;

    if (availableBalance < Number(amount)) {
      await connection.rollback();
      return res.status(400).json({ message: 'ยอดเงินที่สามารถถอนได้ไม่เพียงพอ (อาจมีคำขอถอนเงินที่รอการอนุมัติอยู่)' });
    }

    // 2. สร้างรายการขอถอนเงิน (รอแอดมินยืนยัน จึงจะหักเงิน)
    const withdrawal_id = 'WR' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    await connection.query(
      'INSERT INTO withdrawal_requests (withdrawal_id, wallet_id, amount, bank_name, bank_account_number, bank_account_name, status) VALUES (?, ?, ?, ?, ?, ?, "pending")',
      [withdrawal_id, wallet.wallet_id, amount, wallet.bank_name, wallet.account_number, wallet.account_name]
    );

    // ยืนยัน transaction: คำขอถูกบันทึกเป็น pending (ยอดเงินจะถูกหักตอนแอดมินอนุมัติ ไม่ใช่ตอนนี้)
    await connection.commit();
    res.json({ message: 'ส่งคำขอถอนเงินเรียบร้อยแล้ว' });

  } catch (error) {
    await connection.rollback();
    console.error('Error withdrawing money:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการทำรายการ' });
  } finally {
    connection.release();
  }
});

// ดึงประวัติการถอนเงินทั้งหมด
router.get('/withdrawals', async (req, res) => {
  try {
    const { maid_id } = req.query;
    if (!maid_id) {
      return res.status(400).json({ message: 'กรุณาส่ง maid_id' });
    }

    const [wallets] = await pool.query('SELECT wallet_id FROM maid_wallets WHERE maid_id = ?', [maid_id]);
    if (wallets.length === 0) {
      return res.json({ withdrawals: [] });
    }
    const wallet_id = wallets[0].wallet_id;

    const [withdrawals] = await pool.query(
      'SELECT * FROM withdrawal_requests WHERE wallet_id = ? ORDER BY requested_at DESC',
      [wallet_id]
    );

    res.json({ withdrawals });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลประวัติการถอนเงินได้' });
  }
});

// ===== API จำลองฝั่งแอดมิน (ใช้ทดสอบแอปแม่บ้านผ่าน Postman เท่านั้น) =====
// ของจริงอยู่ในโปรแกรมแอดมินที่แยกกัน ปิดอัตโนมัติเมื่อ NODE_ENV=production หรือตั้ง ENABLE_TEST_ENDPOINTS=false ใน .env
const TEST_ENDPOINTS_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_ENDPOINTS !== 'false';

if (TEST_ENDPOINTS_ENABLED) {
  // แอดมินอนุมัติหรือปฏิเสธคำขอถอนเงิน
  // ส่งแบบ JSON: { "withdrawal_id": "WR802591", "action": "approve" หรือ "reject", "admin_note": "หมายเหตุ" (ไม่ใส่ก็ได้) }
  // approve = หักยอดในกระเป๋า + บันทึกรายการถอนใน wallet_transactions / reject = แค่เปลี่ยนสถานะ ไม่หักเงิน
  router.post('/test/approve-withdrawal', async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const withdrawal_id = String(req.body.withdrawal_id || '').trim();
      const action = String(req.body.action || 'approve').trim();
      const admin_note = req.body.admin_note ? String(req.body.admin_note) : null;

      if (!withdrawal_id) return res.status(400).json({ message: 'กรุณาส่ง withdrawal_id' });
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'action ต้องเป็น approve หรือ reject' });
      }

      await connection.beginTransaction();

      // ล็อกแถวคำขอไว้ กันกดอนุมัติซ้ำพร้อมกัน
      const [reqRows] = await connection.query('SELECT * FROM withdrawal_requests WHERE withdrawal_id = ? FOR UPDATE', [withdrawal_id]);
      if (reqRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: `ไม่พบคำขอถอนเงิน (withdrawal_id ที่ได้รับ: "${withdrawal_id}" ยาว ${withdrawal_id.length} ตัวอักษร)` });
      }
      const request = reqRows[0];
      if (request.status !== 'pending') {
        await connection.rollback();
        return res.status(409).json({ message: `คำขอนี้ถูกดำเนินการไปแล้ว (สถานะ ${request.status})` });
      }

      if (action === 'reject') {
        await connection.query(
          "UPDATE withdrawal_requests SET status = 'rejected', processed_at = NOW(), admin_note = ? WHERE withdrawal_id = ?",
          [admin_note, withdrawal_id]
        );
        await connection.commit();
        return res.json({ message: 'ปฏิเสธคำขอถอนเงินแล้ว (ไม่หักเงิน)', withdrawal_id, status: 'rejected' });
      }

      // อนุมัติ: ตรวจยอดคงเหลือจริงก่อนหัก
      const [wallets] = await connection.query('SELECT wallet_balance FROM maid_wallets WHERE wallet_id = ? FOR UPDATE', [request.wallet_id]);
      const balance = Number(wallets[0].wallet_balance);
      if (balance < Number(request.amount)) {
        await connection.rollback();
        return res.status(409).json({ message: `ยอดในกระเป๋า (${balance}) ไม่พอสำหรับถอน ${request.amount}` });
      }

      await connection.query('UPDATE maid_wallets SET wallet_balance = wallet_balance - ? WHERE wallet_id = ?', [request.amount, request.wallet_id]);
      await connection.query(
        "INSERT INTO wallet_transactions (wallet_id, amount, type, reference_id, note) VALUES (?, ?, 'withdrawal', ?, ?)",
        [request.wallet_id, -Number(request.amount), withdrawal_id, 'ถอนเงินเข้าบัญชีธนาคาร']
      );
      await connection.query(
        "UPDATE withdrawal_requests SET status = 'approved', processed_at = NOW(), admin_note = ? WHERE withdrawal_id = ?",
        [admin_note, withdrawal_id]
      );
      await connection.commit();
      res.json({ message: 'อนุมัติการถอนเงินแล้ว', withdrawal_id, status: 'approved', amount: Number(request.amount), balance_after: balance - Number(request.amount) });
    } catch (error) {
      await connection.rollback();
      console.error('Error test approve withdrawal:', error);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดำเนินการคำขอถอนเงิน' });
    } finally {
      connection.release();
    }
  });

  // แอดมินจ่ายค่าชดเชยแม่บ้านกรณีงานถูกยกเลิกจากการที่แม่บ้านแจ้งปัญหา (เช่น ติดต่อผู้ว่าจ้างไม่ได้) ตามเปอร์เซ็นต์ของค่าบริการรวม
  // ส่งแบบ JSON: { "booking_id": "B0018", "percent": 20 } (percent ไม่ใส่ = 20)
  // ทำ: เติมเงินเข้ากระเป๋าแม่บ้าน + บันทึกรายการ compensation + ปิดเคสใน booking_refunds (เก็บยอดชดเชยและกระเป๋าที่รับ)
  router.post('/test/compensate', async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const booking_id = String(req.body.booking_id || '').trim();
      const percent = req.body.percent === undefined ? 20 : Number(req.body.percent);

      if (!booking_id) return res.status(400).json({ message: 'กรุณาส่ง booking_id' });
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        return res.status(400).json({ message: 'percent ต้องเป็นตัวเลขมากกว่า 0 และไม่เกิน 100' });
      }

      await connection.beginTransaction();

      const [bookings] = await connection.query('SELECT status, maid_id FROM bookings WHERE booking_id = ? FOR UPDATE', [booking_id]);
      if (bookings.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: `ไม่พบงานนี้ (booking_id ที่ได้รับ: "${booking_id}" ยาว ${booking_id.length} ตัวอักษร)` });
      }
      const booking = bookings[0];
      if (booking.status !== 'cancelled' || !booking.maid_id) {
        await connection.rollback();
        return res.status(409).json({ message: `งานนี้อยู่ในสถานะ ${booking.status} จ่ายค่าชดเชยไม่ได้ (ต้องเป็นงานที่ถูกยกเลิกและมีแม่บ้านรับไว้)` });
      }

      // ต้องมีเคสที่แม่บ้านแจ้งปัญหาและยังรอดำเนินการ (งานที่ถูกยกเลิกเพราะแม่บ้านไม่เริ่มเดินทางไม่มีสิทธิ์ได้ค่าชดเชย)
      const [cases] = await connection.query(
        "SELECT refund_id FROM booking_refunds WHERE booking_id = ? AND reason_type = 'maid_report' AND status IN ('requested', 'investigating') ORDER BY reported_at DESC LIMIT 1 FOR UPDATE",
        [booking_id]
      );
      if (cases.length === 0) {
        await connection.rollback();
        return res.status(409).json({ message: 'ไม่พบเคสที่แม่บ้านแจ้งปัญหาและรอดำเนินการของงานนี้ (อาจจ่ายไปแล้ว หรืองานถูกยกเลิกเพราะเหตุอื่น)' });
      }

      const [paid] = await connection.query(
        "SELECT 1 FROM wallet_transactions WHERE type = 'compensation' AND reference_id = ? LIMIT 1",
        [booking_id]
      );
      if (paid.length > 0) {
        await connection.rollback();
        return res.status(409).json({ message: 'งานนี้จ่ายค่าชดเชยไปแล้ว' });
      }

      const [wallets] = await connection.query('SELECT wallet_id, wallet_balance FROM maid_wallets WHERE maid_id = ? FOR UPDATE', [booking.maid_id]);
      if (wallets.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'แม่บ้านคนนี้ยังไม่มีกระเป๋าเงิน' });
      }
      const wallet = wallets[0];

      const [[{ total }]] = await connection.query(
        'SELECT COALESCE(SUM(price_at_booking), 0) AS total FROM booking_services WHERE booking_id = ?',
        [booking_id]
      );
      const amount = Math.round(Number(total) * percent) / 100;

      await connection.query('UPDATE maid_wallets SET wallet_balance = wallet_balance + ? WHERE wallet_id = ?', [amount, wallet.wallet_id]);
      await connection.query(
        "INSERT INTO wallet_transactions (wallet_id, amount, type, reference_id, note) VALUES (?, ?, 'compensation', ?, ?)",
        [wallet.wallet_id, amount, booking_id, `ค่าชดเชยกรณียกเลิกงาน (${percent}% ของค่าบริการ ${Number(total)} บาท)`]
      );
      await connection.query(
        "UPDATE booking_refunds SET status = 'refunded', compensation_amount = ?, wallet_id = ?, resolved_at = NOW() WHERE refund_id = ?",
        [amount, wallet.wallet_id, cases[0].refund_id]
      );

      await connection.commit();
      res.json({
        message: 'จ่ายค่าชดเชยเข้ากระเป๋าแม่บ้านแล้ว',
        booking_id,
        maid_id: booking.maid_id,
        service_total: Number(total),
        percent,
        compensation: amount,
        balance_after: Number(wallet.wallet_balance) + amount
      });
    } catch (error) {
      await connection.rollback();
      console.error('Error test compensate:', error);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการจ่ายค่าชดเชย' });
    } finally {
      connection.release();
    }
  });
}

module.exports = router;
