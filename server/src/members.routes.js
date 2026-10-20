// API ของสมาชิก (แม่บ้าน): ดูโปรไฟล์, สมัครสมาชิก, แก้ไขข้อมูลส่วนตัว, เปลี่ยนรูปประจำตัว และดูรีวิว
const express = require('express');
const router = express.Router();
const pool = require('./db');
const multer = require('multer');
const path = require('path');

// ตั้งค่า Multer สำหรับบันทึกไฟล์รูป
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  // ตั้งชื่อไฟล์ใหม่ไม่ซ้ำ (profile-เวลา-เลขสุ่ม) กันรูปชื่อเดียวกันทับกัน
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// ดึงรายชื่อแม่บ้านทั้งหมด
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT* FROM maids; '
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูล member ได้' });
  }
});

// ดึงข้อมูลแม่บ้าน 1 คนตามอีเมล
router.get('/profile', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'กรุณาส่ง email มาด้วย' });

    const [rows] = await pool.query('SELECT * FROM maids WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลแม่บ้านที่ตรงกับอีเมลนี้' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'เซิร์ฟเวอร์มีปัญหา' });
  }
});

// อัปเดตสถานะความพร้อมรับงาน (is_online) ที่แอปเรียกเมื่อแม่บ้านกดสวิตช์ที่หน้าหลัก
// รับ email และ is_online (1 = ออนไลน์, 0 = ออฟไลน์) แล้วบันทึกลงตาราง maids ค่านี้ใช้เช็กก่อนแสดงงานใหม่และตัวเลขแจ้งเตือนในแอป
router.put('/profile/status', async (req, res) => {
  try {
    const { email, is_online } = req.body;
    if (!email || is_online === undefined) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });

    // อัปเดตคอลัมน์ is_online
    await pool.query('UPDATE maids SET is_online = ? WHERE email = ?', [is_online, email]);
    
    res.json({ message: 'อัปเดตสถานะเรียบร้อย' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'เซิร์ฟเวอร์มีปัญหา' });
  }
});

// ตัวอย่างพื้นฐาน: เพิ่มข้อมูลลงตาราง member (การสมัครแม่บ้านจริงใช้เส้นทาง /register ด้านล่าง)
router.post('/', async (req, res) => {
  try {
    const { name, age, password } = req.body;

    if (!name || !age || !password) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
    }

    const ageNumber = Number(age);

    if (Number.isNaN(ageNumber) || ageNumber <= 0) {
      return res.status(400).json({ message: 'กรุณากรอกอายุเป็นตัวเลข' });
    }

    const [result] = await pool.query(
      'INSERT INTO member (name, age, password) VALUES (?, ?, ?)',
      [name, ageNumber, password]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      age: ageNumber,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ไม่สามารถบันทึกข้อมูล member ได้' });
  }
});

// สมัครสมาชิกแม่บ้านใหม่ (แอปเรียกหลังสร้างบัญชีใน Firebase สำเร็จแล้ว)
// ลำดับ: ตรวจข้อมูลที่จำเป็น -> ตรวจว่ายืนยันอีเมลด้วย OTP แล้ว -> สร้างรหัส maid/wallet -> บันทึก maids + maid_wallets + users เป็นชุดเดียว -> ลบ OTP
router.post('/register', async (req, res) => {
  try {
    const { 
      title_prefix, first_name, last_name, 
      national_id, phone, email, 
      bank_name, bank_account, account_name 
    } = req.body;

    if (!email || !first_name || !last_name) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    // ต้องยืนยันอีเมลด้วย OTP มาแล้วภายใน 30 นาที ถึงจะสมัครได้
    const [verified] = await pool.query(
      `SELECT 1 FROM email_verifications
       WHERE email = ? AND verified_at IS NOT NULL AND verified_at > (NOW() - INTERVAL 30 MINUTE)`,
      [email.trim()]
    );
    if (verified.length === 0) {
      return res.status(403).json({ message: 'กรุณายืนยันอีเมลก่อนสมัครสมาชิก' });
    }

    // 1. สร้าง maid_id ใหม่
    const [maidRows] = await pool.query('SELECT maid_id FROM maids ORDER BY maid_id DESC LIMIT 1');
    let nextMaidId = 'M0001';
    if (maidRows.length > 0) {
      const lastId = maidRows[0].maid_id;
      const numberPart = parseInt(lastId.substring(1), 10);
      nextMaidId = 'M' + String(numberPart + 1).padStart(4, '0');
    }

    // 2. สร้าง wallet_id ใหม่
    const [walletRows] = await pool.query('SELECT wallet_id FROM maid_wallets ORDER BY wallet_id DESC LIMIT 1');
    let nextWalletId = 'WL0001';
    if (walletRows.length > 0) {
      const lastWalletId = walletRows[0].wallet_id;
      const numberPart = parseInt(lastWalletId.substring(2), 10);
      nextWalletId = 'WL' + String(numberPart + 1).padStart(4, '0');
    }

    // บันทึก 3 ตารางเป็นชุดเดียวกัน ถ้าตารางใดพลาดจะย้อนกลับทั้งหมด ไม่ให้เหลือข้อมูลค้างครึ่งๆ กลางๆ
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 3. บันทึกลงตาราง maids
      await connection.query(
        `INSERT INTO maids
        (maid_id, title_prefix, first_name, last_name, national_id, phone, email, status, is_online)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
        [nextMaidId, title_prefix, first_name, last_name, national_id, phone, email]
      );

      // 4. บันทึกลงตาราง maid_wallets
      await connection.query(
        `INSERT INTO maid_wallets
        (wallet_id, maid_id, bank_name, account_number, account_name, wallet_balance)
        VALUES (?, ?, ?, ?, ?, 0.00)`,
        [nextWalletId, nextMaidId, bank_name, bank_account, account_name]
      );

      // 5. บันทึกลงตาราง users (ตารางผู้ใช้งานทั้งหมด) ด้วย role = 'maid' รหัสรูปแบบ U0001 ต่อจากรหัสล่าสุด
      const [userRows] = await connection.query('SELECT user_id FROM users ORDER BY user_id DESC LIMIT 1 FOR UPDATE');
      let nextUserId = 'U0001';
      if (userRows.length > 0) {
        const numberPart = parseInt(userRows[0].user_id.substring(1), 10);
        nextUserId = 'U' + String(numberPart + 1).padStart(4, '0');
      }
      await connection.query(
        `INSERT INTO users (user_id, email, fullname, role, phone) VALUES (?, ?, ?, 'maid', ?)`,
        [nextUserId, email, `${first_name} ${last_name}`, phone]
      );

      await connection.commit();
    } catch (txError) {
      await connection.rollback();
      throw txError;
    } finally {
      connection.release();
    }

    // สมัครสำเร็จแล้ว ลบแถว OTP ของอีเมลนี้ทิ้ง ป้องกันการนำไปใช้ซ้ำ
    await pool.query('DELETE FROM email_verifications WHERE email = ?', [email.trim()]);

    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ', maid_id: nextMaidId });
  } catch (error) {
    console.error('Error Registering Maid:', error);
    // เช็คว่า Error มาจาก Email ซ้ำหรือไม่ (Duplicate entry)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'อีเมลนี้มีในระบบแล้ว' });
    }
    res.status(500).json({ message: 'ไม่สามารถสมัครสมาชิกได้' });
  }
});

// อัปโหลดและเปลี่ยนรูปประจำตัว (แอปส่งมาแบบ multipart: ไฟล์ในฟิลด์ profile_pic และอีเมลของแม่บ้าน)
// ลำดับ: multer (upload.single) บันทึกไฟล์ลงโฟลเดอร์ uploads ก่อน -> ตรวจอีเมลและไฟล์ -> เก็บพาธรูปลงตาราง maids และ users -> ตอบพาธกลับให้แอปแสดงรูปใหม่
router.post('/profile-pic', upload.single('profile_pic'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'กรุณาส่งอีเมลมาด้วย' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'ไม่พบไฟล์รูปภาพ' });
    }

    // สร้าง path ของรูปเพื่อเก็บในฐานข้อมูล (ตัวอย่าง: /uploads/profile-1234.jpg)
    const profilePicPath = `/uploads/${req.file.filename}`;

    // อัปเดตในฐานข้อมูล
    await pool.query('UPDATE maids SET profile_pic = ? WHERE email = ?', [profilePicPath, email]);
    // ซิงก์ไปตาราง users ด้วย (ลูกค้าเห็นรูปแม่บ้านจากตารางนี้ได้ตรงกัน)
    await pool.query("UPDATE users SET profile_pic = ? WHERE email = ? AND role = 'maid'", [profilePicPath, email]);

    res.json({ 
      message: 'อัปเดตรูปประจำตัวสำเร็จ', 
      profile_pic: profilePicPath 
    });

  } catch (error) {
    console.error('Error Uploading Profile Pic:', error);
    res.status(500).json({ message: 'ไม่สามารถอัปโหลดรูปภาพได้' });
  }
});

// อัปเดตข้อมูลชื่อ-นามสกุล
router.put('/profile/name', async (req, res) => {
  try {
    const { email, title_prefix, first_name, last_name } = req.body;
    if (!email || !title_prefix || !first_name || !last_name) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    await pool.query(
      'UPDATE maids SET title_prefix = ?, first_name = ?, last_name = ? WHERE email = ?', 
      [title_prefix, first_name, last_name, email]
    );
    // ซิงก์ชื่อไปตาราง users ด้วย
    await pool.query(
      "UPDATE users SET fullname = ? WHERE email = ? AND role = 'maid'",
      [`${first_name} ${last_name}`, email]
    );

    res.json({ message: 'อัปเดตชื่อ-นามสกุลสำเร็จ' });
  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
  }
});

// อัปเดตข้อมูลเบอร์โทรศัพท์
router.put('/profile/phone', async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    await pool.query(
      'UPDATE maids SET phone = ? WHERE email = ?', 
      [phone, email]
    );
    // ซิงก์เบอร์โทรไปตาราง users ด้วย
    await pool.query("UPDATE users SET phone = ? WHERE email = ? AND role = 'maid'", [phone, email]);

    res.json({ message: 'อัปเดตเบอร์โทรศัพท์สำเร็จ' });
  } catch (error) {
    console.error('Error updating phone:', error);
    res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
  }
});

// อัปเดตข้อมูลทักษะความชำนาญพิเศษ
router.put('/profile/specialty', async (req, res) => {
  try {
    const { email, specialty } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    // ถ้า specialty เป็นค่าว่าง หรือไม่ได้ส่งมา ให้เซ็ตเป็น NULL ในฐานข้อมูล
    const specialtyValue = specialty && specialty.trim() !== '' ? specialty : null;

    await pool.query(
      'UPDATE maids SET specialty = ? WHERE email = ?', 
      [specialtyValue, email]
    );

    res.json({ message: 'อัปเดตทักษะความชำนาญสำเร็จ' });
  } catch (error) {
    console.error('Error updating specialty:', error);
    res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
  }
});

// ดึงข้อมูลรีวิวของแม่บ้าน
router.get('/profile/reviews', async (req, res) => {
  try {
    const { maid_id } = req.query;
    if (!maid_id) {
      return res.status(400).json({ message: 'กรุณาส่ง maid_id' });
    }

    // ดึงข้อมูลรีวิว
    const [reviews] = await pool.query(
      `SELECT 
        r.review_id, r.rating, r.review_text, r.created_at,
        u.fullname, u.profile_pic
      FROM booking_reviews r
      JOIN bookings b ON r.booking_id = b.booking_id
      JOIN users u ON b.user_id = u.user_id
      WHERE b.maid_id = ?
      ORDER BY r.created_at DESC`,
      [maid_id]
    );

    // คำนวณคะแนนเฉลี่ยจากทุกรีวิว (ทศนิยม 1 ตำแหน่ง) ถ้ายังไม่มีรีวิวให้เป็น 0
    let totalReviews = reviews.length;
    let avgRating = 0;

    if (totalReviews > 0) {
      const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
      avgRating = (sum / totalReviews).toFixed(1);
    }

    res.json({
      avgRating: parseFloat(avgRating),
      totalReviews,
      reviews
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลรีวิวได้' });
  }
});

module.exports = router;

