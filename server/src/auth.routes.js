// API ยืนยันตัวตนทางอีเมล: ลืมรหัสผ่านด้วย OTP (ขอรหัส / ตรวจรหัส / ตั้งรหัสใหม่) และยืนยันอีเมลตอนสมัครสมาชิกด้วย OTP
const express = require('express');
const router = express.Router();
const pool = require('./db');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');

// ตัวแปรสำหรับเช็คว่า Firebase Admin ถูกตั้งค่าแล้วหรือยัง
let firebaseAdminInitialized = false;
// เริ่ม Firebase Admin SDK ด้วยไฟล์ serviceAccountKey.json (ใช้เปลี่ยนรหัสผ่านผู้ใช้จากฝั่ง server) ถ้าไม่พบไฟล์จะข้าม และฟีเจอร์ตั้งรหัสใหม่จะใช้ไม่ได้
try {
  // หาที่อยู่ไฟล์ serviceAccountKey.json โดยอิงจากโฟลเดอร์หลัก (server/)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
    ? path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : path.resolve(__dirname, '..', 'serviceAccountKey.json');
    
  const serviceAccount = require(serviceAccountPath);
  
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  firebaseAdminInitialized = true;
} catch (error) {
  console.warn("Firebase Admin SDK ไม่ได้ตั้งค่า หรือหาไฟล์ Service Account ไม่พบ การเปลี่ยนรหัสผ่านจะทำไม่ได้ชั่วคราว");
  console.error("Error details:", error);
}

// ตั้งค่าตัวส่งอีเมล
// สร้างตัวส่งอีเมลผ่าน Gmail ด้วย App Password (ตั้ง GMAIL_USER / GMAIL_PASS ใน .env)
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER, // อีเมล Gmail ของคุณ
      pass: process.env.GMAIL_PASS  // App Password ของ Gmail
    }
  });
};

// 1. ขอรหัส OTP (ลืมรหัสผ่าน)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'กรุณาระบุอีเมล' });

  try {
    // สุ่มรหัส OTP 6 หลัก
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // ตั้งเวลาหมดอายุ 15 นาที
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    // บันทึกลงฐานข้อมูล (ถ้ามีข้อมูลเดิมให้ update ทับไปเลย)
    await pool.query(
      `INSERT INTO password_resets (email, otp, expires_at) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE otp = ?, expires_at = ?, created_at = CURRENT_TIMESTAMP`,
      [email, otp, expiresAt, otp, expiresAt]
    );

    // ส่งอีเมล
    // ถ้ายังไม่ตั้งค่า Gmail (ช่วงพัฒนา) จะไม่ส่งอีเมลจริง แต่พิมพ์รหัส OTP ลง console ให้ผู้พัฒนาใช้ทดสอบแทน
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.warn("อีเมล OTP คือ:", otp, "(ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_PASS เลยแสดงใน console แทน)");
      return res.json({ message: 'ยังไม่ได้ตั้งค่าอีเมลในระบบ แต่จำลองส่งสำเร็จ (ดู OTP ใน console)' });
    }

    // ประกอบอีเมลที่มีรหัส OTP แล้วส่งผ่าน Gmail
    const transporter = createTransporter();
    const mailOptions = {
      from: `"KU CSC Maid" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน (KU CSC Maid)',
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px;">
          <h2>รีเซ็ตรหัสผ่าน KU CSC Maid</h2>
          <p>รหัส OTP ของคุณคือ:</p>
          <h1 style="color: #0E6643; letter-spacing: 5px;">${otp}</h1>
          <p>รหัสนี้มีอายุการใช้งาน 15 นาที</p>
          <p>หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'ส่งรหัส OTP ไปที่อีเมลแล้ว' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่ง OTP' });
  }
});

// 2. ตรวจสอบรหัส OTP
router.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM password_resets WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      return res.status(400).json({ message: 'ไม่พบคำขอรีเซ็ตรหัสผ่าน' });
    }

    // ตรวจ 2 อย่าง: รหัสต้องยังไม่หมดอายุ และต้องตรงกับที่ส่งไปให้อีเมลนี้
    const record = rows[0];
    const now = new Date();

    if (new Date(record.expires_at) < now) {
      return res.status(400).json({ message: 'รหัส OTP หมดอายุแล้ว' });
    }

    if (record.otp !== code) {
      return res.status(400).json({ message: 'รหัส OTP ไม่ถูกต้อง' });
    }

    res.json({ message: 'รหัส OTP ถูกต้อง', success: true });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// 3. ตั้งรหัสผ่านใหม่
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
  }

  if (!firebaseAdminInitialized) {
    return res.status(500).json({ message: 'ระบบหลังบ้านยังไม่ตั้งค่า Firebase Admin SDK' });
  }

  try {
    // 3.1 ยืนยัน OTP อีกครั้งเพื่อความปลอดภัย
    const [rows] = await pool.query('SELECT * FROM password_resets WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(400).json({ message: 'ไม่พบคำขอรีเซ็ตรหัสผ่าน' });
    
    // เช็คตามลำดับ: หมดอายุ -> ลองผิดเกินกำหนด -> รหัสไม่ตรง -> (ผ่าน) บันทึกว่ายืนยันแล้ว
    const record = rows[0];
    if (record.otp !== code) return res.status(400).json({ message: 'รหัส OTP ไม่ถูกต้อง' });
    if (new Date(record.expires_at) < new Date()) return res.status(400).json({ message: 'รหัส OTP หมดอายุแล้ว' });

    // 3.2 หา UID ของ user จากอีเมล ผ่าน Firebase Admin
    const userRecord = await getAuth().getUserByEmail(email);

    // 3.3 เปลี่ยนรหัสผ่านใหม่
    await getAuth().updateUser(userRecord.uid, {
      password: newPassword
    });

    // 3.4 ลบ OTP ทิ้งเพื่อป้องกันการใช้ซ้ำ
    await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);

    res.json({ message: 'รหัสผ่านถูกเปลี่ยนเรียบร้อยแล้ว' });

  } catch (error) {
    console.error('Reset password error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' });
    }
    
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' });
  }
});

// ===== ยืนยันอีเมลตอนสมัครสมาชิก (OTP) =====
// ค่ากำหนดของ OTP สมัครสมาชิก: กรอกผิดได้ 5 ครั้ง, ขอรหัสใหม่ได้ทุก 60 วินาที, และรูปแบบอีเมลที่ยอมรับ
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 4. ขอรหัส OTP ยืนยันอีเมล (สมัครสมาชิก)
router.post('/register-otp/send', async (req, res) => {
  const email = String(req.body.email || '').trim();
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
  }

  try {
    // ถ้าอีเมลนี้สมัครสมาชิกไว้แล้ว ไม่ส่งรหัสและแจ้งว่าถูกใช้งานแล้ว
    // ตรวจทั้งตาราง maids และ users เพราะตอนสมัครระบบจะบันทึกทั้งสองตาราง (อีเมลซ้ำในตารางใดตารางหนึ่งก็สมัครไม่ได้)
    const [existing] = await pool.query(
      'SELECT 1 FROM maids WHERE email = ? UNION SELECT 1 FROM users WHERE email = ?',
      [email, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }

    // กันกดขอรหัสรัวๆ
    const [recent] = await pool.query(
      `SELECT GREATEST(1, ? - TIMESTAMPDIFF(SECOND, created_at, NOW())) AS wait
       FROM email_verifications
       WHERE email = ? AND created_at > (NOW() - INTERVAL ? SECOND)`,
      [OTP_RESEND_COOLDOWN_SECONDS, email, OTP_RESEND_COOLDOWN_SECONDS]
    );
    if (recent.length > 0) {
      return res.status(429).json({
        message: 'ส่งรหัสไปแล้ว กรุณารอสักครู่ก่อนขอรหัสใหม่',
        retry_after: Number(recent[0].wait)
      });
    }

    // สุ่มรหัส 6 หลักด้วย crypto (ปลอดภัยกว่า Math.random) แล้วบันทึกลงแถวของอีเมลนี้ อายุ 10 นาที พร้อมล้างจำนวนครั้งที่ลองผิดและสถานะที่เคยยืนยันไว้
    const otp = String(crypto.randomInt(100000, 1000000));

    await pool.query(
      `INSERT INTO email_verifications (email, otp, expires_at, attempts, verified_at, created_at)
       VALUES (?, ?, NOW() + INTERVAL 10 MINUTE, 0, NULL, NOW())
       ON DUPLICATE KEY UPDATE
         otp = VALUES(otp),
         expires_at = VALUES(expires_at),
         attempts = 0,
         verified_at = NULL,
         created_at = NOW()`,
      [email, otp]
    );

    // ช่วงพัฒนาที่ยังไม่ตั้งค่า Gmail: แสดงรหัสใน console แทนการส่งอีเมลจริง
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.warn('อีเมล OTP สมัครสมาชิกคือ:', otp, '(ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_PASS เลยแสดงใน console แทน)');
      return res.json({ message: 'จำลองส่งสำเร็จ (ดู OTP ใน console)', retry_after: OTP_RESEND_COOLDOWN_SECONDS });
    }

    try {
      // ส่งอีเมลรหัสยืนยันให้ผู้สมัคร
      await createTransporter().sendMail({
        from: `"KU CSC Maid" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'รหัสยืนยันอีเมลสำหรับสมัครสมาชิก (KU CSC Maid)',
        html: `
          <div style="font-family: sans-serif; text-align: center; padding: 20px;">
            <h2>ยืนยันอีเมลสมัครสมาชิก KU CSC Maid</h2>
            <p>รหัสยืนยันของคุณคือ:</p>
            <h1 style="color: #0E6643; letter-spacing: 5px;">${otp}</h1>
            <p>รหัสนี้มีอายุการใช้งาน 10 นาที</p>
            <p>หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้</p>
          </div>
        `
      });
    } catch (mailError) {
      // ส่งไม่สำเร็จ ลบรหัสทิ้งเพื่อให้ผู้ใช้กดขอใหม่ได้ทันที ไม่ติด cooldown
      await pool.query('DELETE FROM email_verifications WHERE email = ?', [email]);
      console.error('Send registration OTP mail error:', mailError);
      return res.status(500).json({ message: 'ไม่สามารถส่งอีเมลได้ กรุณาตรวจสอบอีเมลแล้วลองใหม่อีกครั้ง' });
    }

    res.json({ message: 'ส่งรหัสยืนยันไปที่อีเมลแล้ว', retry_after: OTP_RESEND_COOLDOWN_SECONDS });
  } catch (error) {
    console.error('Register OTP send error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งรหัสยืนยัน' });
  }
});

// 5. ตรวจสอบรหัส OTP ยืนยันอีเมล (สมัครสมาชิก)
router.post('/register-otp/verify', async (req, res) => {
  const email = String(req.body.email || '').trim();
  const code = String(req.body.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: 'กรุณากรอกรหัสยืนยัน 6 หลัก' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT otp, attempts, (expires_at < NOW()) AS expired FROM email_verifications WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'ไม่พบคำขอรหัสยืนยัน กรุณาขอรหัสใหม่' });
    }

    const record = rows[0];
    if (record.expired) {
      return res.status(400).json({ message: 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่' });
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: 'กรอกรหัสผิดเกินกำหนด กรุณาขอรหัสใหม่' });
    }

    if (record.otp !== code) {
      await pool.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?', [email]);
      return res.status(400).json({ message: 'รหัสยืนยันไม่ถูกต้อง' });
    }

    // รหัสถูกต้อง: บันทึกเวลายืนยันสำเร็จ เพื่อให้ /api/members/register ตรวจต่อได้ (ใช้ได้ภายใน 30 นาที)
    await pool.query('UPDATE email_verifications SET verified_at = NOW() WHERE email = ?', [email]);
    res.json({ message: 'ยืนยันอีเมลสำเร็จ', success: true });
  } catch (error) {
    console.error('Register OTP verify error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัส' });
  }
});

module.exports = router;
