// API เกี่ยวกับงาน: รายการงานใหม่ / ตารางงาน / ประวัติ, รายละเอียดงาน, รับ-ปฏิเสธงาน, อัปโหลดรูป, จบงาน (โอนเงินเข้ากระเป๋า), แจ้งปัญหา และเริ่มเดินทาง
const express = require('express');
const router = express.Router();
const pool = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { cancelExpiredProblemReports, PROBLEM_WAIT_MINUTES, CUSTOMER_UNPAID_REASON, ADMIN_NO_VERIFY_REASON } = require('./noShowWatcher');

// งานของแม่บ้านคนเดียวกันต้องเริ่มห่างกันอย่างน้อยกี่นาที ถึงจะรับซ้อนได้ (ตั้ง JOB_CONFLICT_MINUTES=0 ใน .env เพื่อปิดการตรวจ)
const parsedConflictMinutes = Number(process.env.JOB_CONFLICT_MINUTES);
const JOB_CONFLICT_MINUTES =
  process.env.JOB_CONFLICT_MINUTES === undefined || Number.isNaN(parsedConflictMinutes) ? 120 : parsedConflictMinutes;

// สถานะงานที่ถือว่าแม่บ้านรับไว้แล้วและยังไม่จบ (ใช้ตรวจเวลาชนทั้งตอนแสดงรายการงานใหม่และตอนกดรับงาน ต้องตรงกันเสมอ)
const ACTIVE_JOB_STATUSES_SQL = "'waiting_payment', 'verifying_payment', 'confirmed', 'in_progress', 'investigating'";

// ข้อความเหตุผลที่แสดงในประวัติ เมื่องานถูกยกเลิกอัตโนมัติเพราะแม่บ้านไม่เริ่มเดินทางตามกำหนด
// เปิดให้กดเริ่มเดินทางล่วงหน้าได้กี่นาทีก่อนเวลานัด (ตั้ง START_TRAVEL_WINDOW_MINUTES=0 ใน .env เพื่อไม่จำกัด)
// กันแม่บ้านกดเริ่มเดินทางไว้ก่อนหลายชั่วโมง/หลายวัน แล้วหลบระบบยกเลิกงานที่แม่บ้านไม่มาตามนัด
const parsedStartWindow = Number(process.env.START_TRAVEL_WINDOW_MINUTES);
const START_TRAVEL_WINDOW_MINUTES = Math.max(
  0,
  process.env.START_TRAVEL_WINDOW_MINUTES === undefined || Number.isNaN(parsedStartWindow) ? 60 : parsedStartWindow
);

// แปลงเวลาเป็นข้อความไทย เช่น 13/10/2569 11:00 น. (ใช้ในข้อความตอบกลับของ API)
const formatThaiDateTime = (value) => {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`;
};

const NO_SHOW_CANCEL_REASON ='แม่บ้านไม่ได้เริ่มเดินทางภายในเวลาที่กำหนด (ระบบยกเลิกงานอัตโนมัติ)';

// ตั้งค่าที่เก็บไฟล์ของ multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/jobs');
    // สร้างโฟลเดอร์ถ้ายังไม่มี
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  // ตั้งชื่อไฟล์เป็น job-เวลา-เลขสุ่ม ตามนามสกุลเดิม กันชื่อซ้ำ
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'job-' + uniqueSuffix + ext);
  }
});

// ตัวรับไฟล์รูปที่แนบมากับ request (ใช้กับอัปโหลดรูปงานและรูปหลักฐานแจ้งปัญหา)
const upload = multer({ storage: storage });

// ดึงรายการงานใหม่ที่รอแม่บ้านกดรับ
router.get('/new', async (req, res) => {
  try {
    const { maid_id } = req.query; // อาจจะนำมาใช้เช็ค zone หรือเงื่อนไขเพิ่มเติมในอนาคต

    // ซ่อนงานที่เวลาชน/ใกล้กับงานที่แม่บ้านคนนี้รับไว้แล้ว (กฎเดียวกับตอนกดรับงาน)
    const conflictFilter = JOB_CONFLICT_MINUTES > 0
      ? `AND NOT EXISTS (
           SELECT 1 FROM bookings o
           WHERE o.maid_id = ?
             AND o.booking_id <> b.booking_id
             AND o.status IN (${ACTIVE_JOB_STATUSES_SQL})
             AND ABS(TIMESTAMPDIFF(MINUTE, o.booking_date, b.booking_date)) < ?
         )`
      : '';
    // ลำดับค่าต้องตรงกับเครื่องหมาย ? ในคำสั่ง SQL: ถ้ามีเงื่อนไขเวลาชนจะเพิ่ม maid_id กับจำนวนนาทีเข้าไปอีกชุด
    const params = JOB_CONFLICT_MINUTES > 0
      ? [maid_id, maid_id, JOB_CONFLICT_MINUTES]
      : [maid_id];

    // ค้นหางานที่มีสถานะ pending (รอกดรับ) และแม่บ้านคนนี้ยังไม่ได้กดปฏิเสธ
    const [jobs] = await pool.query(
      `SELECT
        b.booking_id,
        b.location,
        b.booking_date,
        b.dorm_type,
        b.status,
        IFNULL(SUM(bs.price_at_booking), 0) AS total_price
      FROM bookings b
      LEFT JOIN booking_services bs ON b.booking_id = bs.booking_id
      LEFT JOIN maid_job_rejections mjr ON b.booking_id = mjr.booking_id AND mjr.maid_id = ?
      WHERE (b.status = 'pending' OR b.status = 'waiting_maid')
        AND mjr.maid_id IS NULL
        AND DATE(b.booking_date) >= CURDATE()
        ${conflictFilter}
      GROUP BY b.booking_id
      ORDER BY b.booking_date ASC`,
      params
    );

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching new jobs:', error);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลงานใหม่ได้' });
  }
});

// ดึงรายการงานที่แม่บ้านรับไว้แล้ว ตามวันที่เลือก
router.get('/schedule', async (req, res) => {
  try {
    const { maid_id, date } = req.query; 
    if (!maid_id) {
      return res.status(400).json({ message: 'กรุณาส่ง maid_id' });
    }

    // ประกอบ SQL แบบเติมเงื่อนไขต่อท้าย: งานที่ยังไม่จบของแม่บ้านคนนี้ แล้วกรองตามวันที่ (ถ้าไม่ส่งวันที่มาจะดึงล่วงหน้า 14 วัน)
    let query = `
      SELECT 
        b.booking_id,
        b.location,
        b.booking_date,
        b.dorm_type,
        b.status,
        IFNULL(SUM(bs.price_at_booking), 0) AS total_price
      FROM bookings b
      LEFT JOIN booking_services bs ON b.booking_id = bs.booking_id
      WHERE b.maid_id = ? 
        AND b.status IN ('waiting_payment', 'verifying_payment', 'confirmed', 'in_progress', 'investigating')
    `;
    const params = [maid_id];

    if (date) {
      query += ` AND DATE(b.booking_date) = ? `;
      params.push(date);
    } else {
      // ถ้าไม่ส่ง date มา ให้ดึงงานล่วงหน้า 14 วัน
      query += ` AND DATE(b.booking_date) >= CURDATE() AND DATE(b.booking_date) <= DATE_ADD(CURDATE(), INTERVAL 14 DAY) `;
    }

    query += ` GROUP BY b.booking_id ORDER BY b.booking_date ASC`;

    const [jobs] = await pool.query(query, params);

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching schedule jobs:', error);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลตารางงานได้' });
  }
});

// ดึงประวัติการรับงาน (สำเร็จแล้ว / ยกเลิก)
router.get('/history', async (req, res) => {
  try {
    const { maid_id } = req.query; 
    if (!maid_id) {
      return res.status(400).json({ message: 'กรุณาส่ง maid_id' });
    }

    const [jobs] = await pool.query(
      `SELECT 
        b.booking_id,
        b.location,
        b.booking_date,
        b.dorm_type,
        b.status,
        IFNULL(SUM(bs.price_at_booking), 0) AS total_price,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE type = 'compensation' AND reference_id = b.booking_id) AS compensation_amount
      FROM bookings b
      LEFT JOIN booking_services bs ON b.booking_id = bs.booking_id
      WHERE b.maid_id = ? 
        AND b.status IN ('completed', 'cancelled', 'cancelled_no_maid')
        AND (b.cancel_reason IS NULL OR b.cancel_reason NOT IN (?, ?))
      GROUP BY b.booking_id
      ORDER BY b.booking_date DESC`,
      [maid_id, CUSTOMER_UNPAID_REASON, ADMIN_NO_VERIFY_REASON]
    );

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching history jobs:', error);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลประวัติการรับงานได้' });
  }
});

// ดึงรายละเอียดงาน
router.get('/detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // ดึงข้อมูลหลัก
    // งานที่ถูกยกเลิกเพราะแม่บ้านไม่มาตามนัด (no_show_status ถูกติดธงไว้) ให้ใช้เหตุผลนี้ก่อนเสมอ
    // ไม่เอาเหตุผล/รูปจากการแจ้งปัญหาครั้งเก่า (เช่น แจ้งแล้วกลับไปทำงาน) มาแสดงแทน
    const [bookingRows] = await pool.query(
      `SELECT b.*, u.fullname as customer_name, u.phone as customer_phone,
              CASE WHEN b.status = 'cancelled' AND b.no_show_status IN ('reported', 'resolved')
                   THEN ? ELSE r.reason_text END as cancel_reason,
              CASE WHEN b.status = 'cancelled' AND b.no_show_status IN ('reported', 'resolved')
                   THEN NULL ELSE r.evidence_images END as cancel_images,
              TIMESTAMPDIFF(SECOND, NOW(), DATE_SUB(b.booking_date, INTERVAL ? MINUTE)) as start_travel_wait_seconds,
              (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE type = 'compensation' AND reference_id = b.booking_id) as compensation_amount
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.user_id
       LEFT JOIN booking_refunds r ON b.booking_id = r.booking_id
       WHERE b.booking_id = ?
       ORDER BY r.reported_at DESC LIMIT 1`,
      [NO_SHOW_CANCEL_REASON, START_TRAVEL_WINDOW_MINUTES, id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลงาน' });
    }

    const booking = bookingRows[0];

    // ดึงบริการที่เลือก
    const [services] = await pool.query(
      `SELECT bs.price_at_booking, sz.zone_name, sz.is_addon 
       FROM booking_services bs 
       JOIN service_zones sz ON bs.service_zone_id = sz.zone_id 
       WHERE bs.booking_id = ?`,
      [id]
    );

    // แนบรายการบริการและราคารวมเข้าไปในข้อมูลงานก่อนส่งกลับ
    booking.services = services;
    booking.total_price = services.reduce((sum, s) => sum + Number(s.price_at_booking), 0);

    // เวลาที่ปุ่มเริ่มเดินทางจะเปิดให้กด และจำนวนวินาทีที่ต้องรอ (คิดจากเวลาของ server ไม่ใช้เวลาในมือถือ)
    if (START_TRAVEL_WINDOW_MINUTES > 0) {
      booking.start_travel_opens_at = new Date(new Date(booking.booking_date).getTime() - START_TRAVEL_WINDOW_MINUTES * 60000);
    } else {
      booking.start_travel_opens_at = null;
      booking.start_travel_wait_seconds = 0;
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching job detail:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายละเอียดงาน' });
  }
});

// ดึงรูปภาพทั้งหมดของงาน
router.get('/photos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [photos] = await pool.query(
      `SELECT * FROM job_photos WHERE booking_id = ? ORDER BY service_zone, photo_type`,
      [id]
    );
    res.json(photos);
  } catch (error) {
    console.error('Error fetching job photos:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรูปภาพงาน' });
  }
});

// รับงาน / ไม่รับงาน
router.post('/action', async (req, res) => {
  try {
    const { booking_id, maid_id, action } = req.body;
    
    // accept = รับงาน (ตรวจว่างานยังว่างและเวลาไม่ชน แล้วเปลี่ยนเป็นรอชำระเงิน) / reject = บันทึกว่าปฏิเสธ จะได้ไม่เห็นงานนี้อีก
    if (action === 'accept') {
      // ใช้ transaction เพื่อให้ล็อกแถวและอัปเดตเป็นชุดเดียวกัน ถ้าพลาดกลางทางจะย้อนกลับทั้งหมด
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // ล็อกแถวงานนี้ไว้ กันแม่บ้านสองคนกดรับงานเดียวกันพร้อมกัน
        const [targets] = await connection.query(
          'SELECT status FROM bookings WHERE booking_id = ? FOR UPDATE',
          [booking_id]
        );
        if (targets.length === 0) {
          await connection.rollback();
          return res.status(404).json({ message: 'ไม่พบงานนี้' });
        }
        if (!['pending', 'waiting_maid'].includes(targets[0].status)) {
          await connection.rollback();
          return res.status(409).json({ message: 'งานนี้ถูกรับไปแล้วหรือไม่เปิดรับแล้ว' });
        }

        // ห้ามรับงานที่เวลาชนหรือใกล้กับงานที่ตัวเองรับไว้แล้ว (ล็อกแถวงานเดิมไว้ด้วย กันกดรับ 2 งานพร้อมกัน)
        if (JOB_CONFLICT_MINUTES > 0) {
          const [conflicts] = await connection.query(
            `SELECT o.location, o.booking_date
             FROM bookings o
             JOIN bookings t ON t.booking_id = ?
             WHERE o.maid_id = ?
               AND o.booking_id <> t.booking_id
               AND o.status IN (${ACTIVE_JOB_STATUSES_SQL})
               AND ABS(TIMESTAMPDIFF(MINUTE, o.booking_date, t.booking_date)) < ?
             LIMIT 1
             FOR UPDATE`,
            [booking_id, maid_id, JOB_CONFLICT_MINUTES]
          );
          if (conflicts.length > 0) {
            await connection.rollback();
            const d = new Date(conflicts[0].booking_date);
            const when = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
            return res.status(409).json({
              message: `คุณมีงานอื่นในช่วงเวลาใกล้กัน (${conflicts[0].location} ${when}) จึงไม่สามารถรับงานซ้อนกันได้`
            });
          }
        }

        // เปลี่ยนสถานะเป็นรอชำระเงิน บันทึกรหัสแม่บ้าน และเวลาที่รับงาน (accepted_at) เพื่อเริ่มนับเวลาที่ลูกค้าต้องโอนเงิน
        await connection.query(
          `UPDATE bookings SET status = 'waiting_payment', maid_status = 'accepted', maid_id = ?, accepted_at = NOW() WHERE booking_id = ?`,
          [maid_id, booking_id]
        );
        await connection.commit();
        res.json({ message: 'รับงานสำเร็จ' });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else if (action === 'reject') {
      // บันทึกในตาราง maid_job_rejections เพื่อไม่ให้เห็นซ้ำ
      await pool.query(
        `INSERT INTO maid_job_rejections (booking_id, maid_id) VALUES (?, ?)`,
        [booking_id, maid_id]
      );
      res.json({ message: 'ปฏิเสธงานสำเร็จ' });
    } else {
      res.status(400).json({ message: 'Action ไม่ถูกต้อง' });
    }
  } catch (error) {
    console.error('Error job action:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดำเนินการ' });
  }
});

// อัปโหลดรูปภาพ (Before / After)
router.post('/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    const { booking_id, service_zone, photo_type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'ไม่มีไฟล์รูปภาพ' });
    }

    // เก็บเฉพาะ path ของไฟล์ที่ multer บันทึกไว้แล้วในโฟลเดอร์ uploads/jobs
    const photo_path = `/uploads/jobs/${req.file.filename}`;

    // บันทึกลงฐานข้อมูล: รหัสรูปสุ่ม 8 หลัก (คอลัมน์ varchar(10)) ไม่ซ้ำกันแม้แอปอัปโหลดหลายรูปพร้อมกัน
    const photo_id = 'P' + crypto.randomBytes(4).toString('hex');

    await pool.query(
      `INSERT INTO job_photos (photo_id, booking_id, service_zone, photo_type, photo_path) VALUES (?, ?, ?, ?, ?)`,
      [photo_id, booking_id, service_zone, photo_type, photo_path]
    );

    // รูปก่อนปฏิบัติงานรูปแรกของงานนี้ = แม่บ้านถึงหน้างานและเริ่มทำงานจริง บันทึกเป็น job_started_at
    // (เขียนทับเวลาเริ่มเดินทางที่บันทึกไว้ก่อนหน้า เพราะคอลัมน์นี้หมายถึงเวลาเริ่มงาน)
    if (photo_type === 'before') {
      const [[{ n }]] = await pool.query(
        `SELECT COUNT(*) AS n FROM job_photos WHERE booking_id = ? AND photo_type = 'before'`,
        [booking_id]
      );
      if (n === 1) {
        await pool.query('UPDATE bookings SET job_started_at = NOW() WHERE booking_id = ?', [booking_id]);
      }
    }

    res.json({ message: 'อัปโหลดรูปภาพสำเร็จ', photo_id, photo_path });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' });
  }
});

// ลบรูปรายงานที่อัปโหลดไปแล้ว (แม่บ้านกดลบรูปตอนแก้ไขรายงาน) ลบได้เฉพาะงานที่ยังไม่จบ
router.delete('/photo/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;
    const [rows] = await pool.query(
      `SELECT p.photo_path, b.status
       FROM job_photos p JOIN bookings b ON p.booking_id = b.booking_id
       WHERE p.photo_id = ?`,
      [photoId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบรูปภาพ' });
    if (!['confirmed', 'in_progress'].includes(rows[0].status)) {
      return res.status(409).json({ message: 'งานนี้ปิดไปแล้ว ไม่สามารถลบรูปภาพได้' });
    }

    await pool.query('DELETE FROM job_photos WHERE photo_id = ?', [photoId]);
    // ลบไฟล์จริงในเครื่อง server ด้วย (ไม่สำเร็จก็ไม่เป็นไร ข้อมูลในฐานข้อมูลถูกลบแล้ว)
    const filePath = path.join(__dirname, '..', rows[0].photo_path);
    fs.unlink(filePath, () => {});
    res.json({ message: 'ลบรูปภาพแล้ว' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบรูปภาพ' });
  }
});

// เสร็จสิ้นการทำงาน (Complete Job)
router.post('/complete', async (req, res) => {
  try {
    const { booking_id, maid_id } = req.body;

    // 1. ตรวจสอบสถานะงานว่ากำลังดำเนินการหรือรับแล้ว
    const [bookings] = await pool.query(
      `SELECT status, maid_id FROM bookings WHERE booking_id = ?`,
      [booking_id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลงาน' });
    }

    if (bookings[0].maid_id !== maid_id) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ในการเสร็จสิ้นงานนี้' });
    }

    // 2. คำนวณยอดเงินรวม (total_price)
    const [services] = await pool.query(
      `SELECT IFNULL(SUM(price_at_booking), 0) AS total_price FROM booking_services WHERE booking_id = ?`,
      [booking_id]
    );
    const total_price = Number(services[0].total_price);

    // เริ่ม Transaction
    // ทำเป็น transaction เดียว: เปลี่ยนสถานะงานเป็นเสร็จ + เพิ่มเงินเข้ากระเป๋า + บันทึกรายการรับเงิน ถ้าขั้นไหนพลาดจะย้อนทั้งหมด ยอดเงินจะไม่เพี้ยน
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 3. เปลี่ยนสถานะงาน
      await connection.query(
        `UPDATE bookings SET status = 'completed', maid_status = 'completed', completed_at = NOW() WHERE booking_id = ?`,
        [booking_id]
      );

      // หา wallet_id ของแม่บ้านคนนี้
      const [wallets] = await connection.query(
        `SELECT wallet_id FROM maid_wallets WHERE maid_id = ?`,
        [maid_id]
      );
      
      let wallet_id = null;
      if (wallets.length > 0) {
        wallet_id = wallets[0].wallet_id;
        // 4. เพิ่มเงินเข้ากระเป๋าแม่บ้าน
        await connection.query(
          `UPDATE maid_wallets SET wallet_balance = wallet_balance + ? WHERE wallet_id = ?`,
          [total_price, wallet_id]
        );
      } else {
        // ถ้ายังไม่มี wallet ให้สร้างใหม่
        wallet_id = 'W' + maid_id;
        await connection.query(
          `INSERT INTO maid_wallets (wallet_id, maid_id, wallet_balance) VALUES (?, ?, ?)`,
          [wallet_id, maid_id, total_price]
        );
      }

      // 5. บันทึก transaction ใน wallet_transactions
      await connection.query(
        `INSERT INTO wallet_transactions (wallet_id, amount, type, reference_id, note) 
         VALUES (?, ?, 'earning', ?, 'รายได้จากการให้บริการ')`,
        [wallet_id, total_price, booking_id]
      );

      await connection.commit();
      res.json({ message: 'เสร็จสิ้นการทำงานและโอนเงินเข้ากระเป๋าสำเร็จ' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error completing job:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเสร็จสิ้นการทำงาน' });
  }
});

// แจ้งปัญหา (Report Problem) พร้อมแนบรูป
router.post('/report-problem', upload.array('images', 4), async (req, res) => {
  try {
    const { booking_id, reason_type, reason_text } = req.body;
    
    if (!booking_id || !reason_type) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: 'กรุณาแนบรูปหลักฐานอย่างน้อย 1 รูป' });
    }
    
    // ประกอบข้อความเหตุผล: เลือก 'อื่นๆ' ใช้ข้อความที่พิมพ์เลย ถ้าเลือกหัวข้อพร้อมข้อความเพิ่มเติมให้ต่อกัน
    let final_reason_text = reason_type;
    if (reason_type === 'อื่นๆ' && reason_text) {
      final_reason_text = reason_text; // ถ้าเลือกอื่นๆ ให้ใช้ข้อความที่พิมพ์มาเลย
    } else if (reason_text) {
      final_reason_text = `${reason_type} - ${reason_text}`;
    }

    // แปลงไฟล์รูปหลักฐานเป็น path แล้วเก็บเป็น JSON ในคอลัมน์ evidence_images
    const imageUrls = req.files ? req.files.map(f => `/uploads/jobs/${f.filename}`) : [];

    // สร้างรหัสคำร้องจากเวลาปัจจุบัน (6 หลักท้าย)
    const refund_id = 'R' + Date.now().toString().slice(-6);

    // เริ่ม Transaction
    // ทำเป็น transaction เดียว: บันทึกรายงานปัญหา + เปลี่ยนสถานะงานเป็น investigating
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // บันทึกลงตาราง booking_refunds
      await connection.query(
        `INSERT INTO booking_refunds (refund_id, booking_id, reason_type, reason_text, reported_by, status, evidence_images) 
         VALUES (?, ?, 'maid_report', ?, 'maid', 'investigating', ?)`,
        [refund_id, booking_id, final_reason_text, JSON.stringify(imageUrls)]
      );

      // (Optional) อาจจะอัปเดต status ของ bookings เป็น investigating หรืออื่นๆ ตาม business logic ของระบบ
      await connection.query(
        `UPDATE bookings SET status = 'investigating' WHERE booking_id = ?`,
        [booking_id]
      );

      await connection.commit();
      res.json({ message: 'ส่งรายงานปัญหาเรียบร้อยแล้ว', refund_id });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error reporting problem:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งรายงานปัญหา' });
  }
});
// ดึงเวลาที่แจ้งปัญหา
router.get('/wait-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // คำนวณวินาทีที่เหลือจากนาฬิกาของ server (ไม่พึ่งนาฬิกามือถือ) พร้อมสถานะงานล่าสุด
    // ถ้างานถูกยกเลิกไปแล้ว (เช่นหมดเวลาตอนแม่บ้านปิดแอป) หน้าจอจะได้แจ้งทันที
    const [rows] = await pool.query(
      `SELECT r.reported_at,
              b.status AS booking_status,
              TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(r.reported_at, INTERVAL ? MINUTE)) AS seconds_left
       FROM booking_refunds r
       JOIN bookings b ON b.booking_id = r.booking_id
       WHERE r.booking_id = ?
       ORDER BY r.reported_at DESC LIMIT 1`,
      [PROBLEM_WAIT_MINUTES, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการแจ้งปัญหา' });
    }
    res.json({
      reported_at: rows[0].reported_at,
      booking_status: rows[0].booking_status,
      wait_minutes: PROBLEM_WAIT_MINUTES,
      seconds_left: Math.max(0, Number(rows[0].seconds_left))
    });
  } catch (error) {
    console.error('Error fetching wait status:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

// กลับไปปฏิบัติงาน (Resume Job)
router.post('/resume-job', async (req, res) => {
  try {
    const { booking_id } = req.body;
    // เปลี่ยนสถานะกลับเป็น confirmed 
    await pool.query(`UPDATE bookings SET status = 'confirmed' WHERE booking_id = ?`, [booking_id]);
    
    // อัปเดตตาราง booking_refunds ให้รู้ว่ายกเลิกการแจ้งปัญหา
    await pool.query(`UPDATE booking_refunds SET status = 'rejected', admin_note = 'Maid resumed job' WHERE booking_id = ? AND status = 'investigating'`, [booking_id]);

    res.json({ message: 'กลับไปปฏิบัติงานสำเร็จ' });
  } catch (error) {
    console.error('Error resuming job:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการกลับไปปฏิบัติงาน' });
  }
});

// ยกเลิกงานเมื่อหมดเวลารอหลังแจ้งปัญหา (หน้าจอแม่บ้านเรียกเมื่อนับถอยหลังครบ)
// server ตรวจเวลาเอง: ยกเลิกให้เฉพาะงานที่ยังอยู่ในสถานะตรวจสอบและครบเวลารอจริง ถ้ายังไม่ครบตอบ 409 (TOO_EARLY)
// ถ้างานถูกยกเลิกไปแล้ว (ตัวตรวจเบื้องหลังทำให้ก่อนหน้า) ตอบ 200 เหมือนกัน กดซ้ำได้
router.post('/cancel-timeout', async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });

    await cancelExpiredProblemReports(booking_id);

    const [rows] = await pool.query('SELECT status FROM bookings WHERE booking_id = ?', [booking_id]);
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบงานนี้' });
    if (rows[0].status === 'cancelled') {
      return res.json({ message: 'ยกเลิกงานสำเร็จ', status: 'cancelled' });
    }
    const code = rows[0].status === 'investigating' ? 'TOO_EARLY' : 'NOT_WAITING';
    const message = code === 'TOO_EARLY' ? 'ยังไม่ครบเวลารอ' : 'งานนี้ไม่ได้อยู่ในสถานะรอตรวจสอบ';
    res.status(409).json({ code, message, status: rows[0].status });
  } catch (error) {
    console.error('Error cancelling job timeout:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการยกเลิกงาน' });
  }
});

// แม่บ้านกดเริ่มเดินทาง: บันทึกเวลาไว้ เพื่อให้ระบบรู้ว่ากำลังไปทำงานแล้ว (จะไม่ถูกยกเลิกอัตโนมัติจากการไม่มาตามนัด)
router.post('/start-travel', async (req, res) => {
  try {
    const { booking_id, maid_id } = req.body;
    if (!booking_id || !maid_id) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    await pool.query(
      // บันทึกเวลาเริ่มเดินทางครั้งแรกเท่านั้น (ถ้าบันทึกไว้แล้วจะไม่เขียนทับ) เฉพาะงานที่ยืนยันแล้วของแม่บ้านคนนี้
      // และต้องอยู่ในช่วงที่เปิดให้เริ่มเดินทางได้ (ไม่เกิน START_TRAVEL_WINDOW_MINUTES นาทีก่อนเวลานัด)
      `UPDATE bookings SET job_started_at = NOW()
       WHERE booking_id = ? AND maid_id = ? AND status IN ('confirmed', 'in_progress') AND job_started_at IS NULL
         AND (? <= 0 OR booking_date <= DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [booking_id, maid_id, START_TRAVEL_WINDOW_MINUTES, START_TRAVEL_WINDOW_MINUTES]
    );

    // อ่านสถานะจริงหลังอัปเดต (กดซ้ำได้ ไม่เป็นไร และรู้ด้วยว่าโดนยกเลิกไปก่อนหน้านี้หรือไม่)
    const [rows] = await pool.query(
      'SELECT status, maid_id, job_started_at, booking_date FROM bookings WHERE booking_id = ?',
      [booking_id]
    );
    if (rows.length === 0 || rows[0].maid_id !== maid_id) {
      return res.status(404).json({ message: 'ไม่พบงานนี้' });
    }
    // ถ้ายังไม่มีเวลาเริ่ม แปลว่าอัปเดตไม่สำเร็จ: ถูกยกเลิกไปแล้ว / ยังไม่ถึงช่วงเวลาที่กดได้ / ยังไม่อยู่ในสถานะพร้อมเริ่มเดินทาง
    // ส่ง code กลับไปด้วย เพื่อให้แอปแยกวิธีแสดงผลได้
    if (!rows[0].job_started_at) {
      let code = 'NOT_READY';
      let message = 'งานนี้ยังไม่พร้อมเริ่มเดินทาง';
      if (rows[0].status === 'cancelled') {
        code = 'CANCELLED';
        message = 'งานนี้ถูกยกเลิกแล้ว เนื่องจากเลยเวลานัดและยังไม่ได้เริ่มเดินทาง';
      } else if (['confirmed', 'in_progress'].includes(rows[0].status)) {
        code = 'TOO_EARLY';
        const opensAt = new Date(new Date(rows[0].booking_date).getTime() - START_TRAVEL_WINDOW_MINUTES * 60000);
        message = `ยังไม่ถึงเวลาเริ่มเดินทาง กดได้ตั้งแต่ ${formatThaiDateTime(opensAt)}`;
      }
      return res.status(409).json({ code, message });
    }

    res.json({ message: 'บันทึกการเริ่มเดินทางแล้ว' });
  } catch (error) {
    console.error('Error starting travel:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเริ่มเดินทาง' });
  }
});

// ===== API จำลองฝั่งลูกค้า/แอดมิน (ใช้ทดสอบแอปแม่บ้านผ่าน Postman เท่านั้น) =====
// ของจริงอยู่ในโปรแกรมลูกค้า/แอดมินที่แยกกัน เปิดใช้เฉพาะตอนพัฒนา:
// ปิดอัตโนมัติเมื่อ NODE_ENV=production หรือตั้ง ENABLE_TEST_ENDPOINTS=false ใน .env
const TEST_ENDPOINTS_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_ENDPOINTS !== 'false';

if (TEST_ENDPOINTS_ENABLED) {
  // ที่เก็บไฟล์สลิปที่ส่งมาจาก Postman
  const slipUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/slips');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        cb(null, 'slip-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
      }
    }),
    // รับเฉพาะไฟล์รูป
    fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
  });

  // ลูกค้าชำระเงินพร้อมแนบสลิป: บันทึกสลิปลง booking_payments (รอตรวจสอบ) และเปลี่ยนงานเป็น verifying_payment
  // ส่งแบบ form-data: booking_id (Text) และ slip (File)
  // ครอบตัวรับไฟล์ไว้เพื่อให้ตอบ JSON ที่อ่านง่าย เมื่อชื่อฟิลด์ไฟล์ผิด (แทนหน้า error HTML)
  const receiveSlip = (req, res, next) => {
    slipUpload.single('slip')(req, res, (err) => {
      if (err) return res.status(400).json({ message: `ส่งไฟล์ไม่ถูกต้อง: ชื่อ Key ของไฟล์ต้องเป็น slip (${err.message})` });
      next();
    });
  };

  router.post('/test/pay', receiveSlip, async (req, res) => {
    try {
      const booking_id = String(req.body.booking_id || '').trim();
      if (!booking_id) return res.status(400).json({ message: 'กรุณาส่ง booking_id' });
      if (!req.file) return res.status(400).json({ message: 'กรุณาแนบไฟล์รูปสลิปในฟิลด์ slip (ชนิด File และต้องเป็นรูปภาพ)' });

      const [rows] = await pool.query('SELECT status FROM bookings WHERE booking_id = ?', [booking_id]);
      if (rows.length === 0) return res.status(404).json({ message: `ไม่พบงานนี้ (booking_id ที่ได้รับ: "${booking_id}" ยาว ${booking_id.length} ตัวอักษร)` });
      if (rows[0].status !== 'waiting_payment') {
        return res.status(409).json({ message: `งานนี้อยู่ในสถานะ ${rows[0].status} ชำระเงินไม่ได้ (ต้องเป็น waiting_payment)` });
      }

      const slipPath = `/uploads/slips/${req.file.filename}`;
      const [[{ total }]] = await pool.query(
        'SELECT COALESCE(SUM(price_at_booking), 0) AS total FROM booking_services WHERE booking_id = ?',
        [booking_id]
      );

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        // ถ้างานนี้เคยมีใบชำระเงินแล้ว (เช่นส่งสลิปใหม่) อัปเดตแถวเดิม ไม่เช่นนั้นสร้างใหม่
        const [existing] = await connection.query('SELECT payment_id FROM booking_payments WHERE booking_id = ? LIMIT 1', [booking_id]);
        let paymentId;
        if (existing.length > 0) {
          paymentId = existing[0].payment_id;
          await connection.query(
            `UPDATE booking_payments SET payment_status = 'waiting_verify', payment_slip = ?, total_price = ? WHERE payment_id = ?`,
            [slipPath, total, paymentId]
          );
        } else {
          paymentId = 'PM' + crypto.randomBytes(4).toString('hex');
          await connection.query(
            `INSERT INTO booking_payments (payment_id, booking_id, total_price, payment_status, payment_slip) VALUES (?, ?, ?, 'waiting_verify', ?)`,
            [paymentId, booking_id, total, slipPath]
          );
        }
        // เปลี่ยนสถานะแบบมีเงื่อนไข: ถ้าระบบเพิ่งยกเลิกงานเพราะเลยเวลาชำระเงินไปพอดี จะไม่มีแถวถูกแก้ และตอบว่าชำระไม่ได้
        const [statusResult] = await connection.query(`UPDATE bookings SET status = 'verifying_payment' WHERE booking_id = ? AND status = 'waiting_payment'`, [booking_id]);
        if (statusResult.affectedRows === 0) {
          await connection.rollback();
          return res.status(409).json({ message: 'งานนี้ไม่อยู่ในสถานะรอชำระเงินแล้ว (อาจเลยเวลาชำระและถูกยกเลิก)' });
        }
        await connection.commit();
        res.json({ message: 'รับสลิปแล้ว รอแอดมินตรวจสอบ', payment_id: paymentId, payment_slip: slipPath, status: 'verifying_payment' });
      } catch (txError) {
        await connection.rollback();
        throw txError;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error test pay:', error);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกการชำระเงิน' });
    }
  });

  // ลูกค้าให้คะแนนรีวิวหลังงานเสร็จ: บันทึกลง booking_reviews (งานต้องเป็น completed, ถ้างานนี้เคยรีวิวแล้วจะแก้ทับของเดิม)
  // ส่งแบบ JSON: { "booking_id": "B0022", "rating": 5, "review_text": "ข้อความรีวิว" } (review_text ไม่ใส่ก็ได้)
  router.post('/test/review', async (req, res) => {
    try {
      const booking_id = String(req.body.booking_id || '').trim();
      const rating = Number(req.body.rating);
      const review_text = req.body.review_text ? String(req.body.review_text) : null;

      if (!booking_id) return res.status(400).json({ message: 'กรุณาส่ง booking_id' });
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'rating ต้องเป็นเลขจำนวนเต็ม 1-5' });
      }

      const [rows] = await pool.query('SELECT status, maid_id FROM bookings WHERE booking_id = ?', [booking_id]);
      if (rows.length === 0) {
        return res.status(404).json({ message: `ไม่พบงานนี้ (booking_id ที่ได้รับ: "${booking_id}" ยาว ${booking_id.length} ตัวอักษร)` });
      }
      if (rows[0].status !== 'completed') {
        return res.status(409).json({ message: `งานนี้อยู่ในสถานะ ${rows[0].status} รีวิวไม่ได้ (ต้องเป็น completed)` });
      }

      const [existing] = await pool.query('SELECT review_id FROM booking_reviews WHERE booking_id = ? LIMIT 1', [booking_id]);
      if (existing.length > 0) {
        await pool.query('UPDATE booking_reviews SET rating = ?, review_text = ?, created_at = NOW() WHERE review_id = ?', [rating, review_text, existing[0].review_id]);
        return res.json({ message: 'แก้ไขรีวิวเดิมแล้ว', review_id: existing[0].review_id, maid_id: rows[0].maid_id, rating, replaced: true });
      }
      const [result] = await pool.query(
        'INSERT INTO booking_reviews (booking_id, rating, review_text) VALUES (?, ?, ?)',
        [booking_id, rating, review_text]
      );
      res.status(201).json({ message: 'บันทึกรีวิวแล้ว', review_id: result.insertId, maid_id: rows[0].maid_id, rating, replaced: false });
    } catch (error) {
      console.error('Error test review:', error);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกรีวิว' });
    }
  });

  // แอดมินอนุมัติสลิป: ใบชำระเงินเป็น paid และงานเป็น confirmed (แม่บ้านเริ่มเดินทางได้)
  // ส่งแบบ JSON: { "booking_id": "B0024" }
  router.post('/test/approve-payment', async (req, res) => {
    try {
      const booking_id = String(req.body.booking_id || '').trim();
      if (!booking_id) return res.status(400).json({ message: 'กรุณาส่ง booking_id' });

      const [rows] = await pool.query('SELECT status FROM bookings WHERE booking_id = ?', [booking_id]);
      if (rows.length === 0) return res.status(404).json({ message: `ไม่พบงานนี้ (booking_id ที่ได้รับ: "${booking_id}" ยาว ${booking_id.length} ตัวอักษร)` });
      if (rows[0].status !== 'verifying_payment') {
        return res.status(409).json({ message: `งานนี้อยู่ในสถานะ ${rows[0].status} อนุมัติไม่ได้ (ต้องเป็น verifying_payment)` });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `UPDATE booking_payments SET payment_status = 'paid', paid_at = NOW() WHERE booking_id = ? AND payment_status = 'waiting_verify'`,
          [booking_id]
        );
        // เปลี่ยนสถานะแบบมีเงื่อนไข: ถ้าระบบเพิ่งยกเลิกงานเพราะแอดมินตรวจไม่ทัน จะไม่มีแถวถูกแก้ และตอบว่าอนุมัติไม่ได้
        const [confirmResult] = await connection.query(`UPDATE bookings SET status = 'confirmed' WHERE booking_id = ? AND status = 'verifying_payment'`, [booking_id]);
        if (confirmResult.affectedRows === 0) {
          await connection.rollback();
          return res.status(409).json({ message: 'งานนี้ไม่อยู่ในสถานะรอตรวจสอบสลิปแล้ว (อาจถูกยกเลิกเพราะตรวจไม่ทันเวลา)' });
        }
        await connection.commit();
        res.json({ message: 'อนุมัติการชำระเงินแล้ว', status: 'confirmed' });
      } catch (txError) {
        await connection.rollback();
        throw txError;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error test approve payment:', error);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอนุมัติการชำระเงิน' });
    }
  });
}

module.exports = router;
