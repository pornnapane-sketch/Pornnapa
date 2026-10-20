// จุดเริ่มต้นของ API server (Express): ตั้งค่า middleware, ผูกเส้นทาง /api/... และเริ่มตัวตรวจงานที่แม่บ้านไม่มาตามนัด
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const membersRoutes = require('./members.routes');
const jobsRoutes = require('./jobs.routes');
const walletsRoutes = require('./wallets.routes');
const authRoutes = require('./auth.routes');
const { startNoShowWatcher } = require('./noShowWatcher');

const app = express();

// เปิด CORS ให้แอปมือถือเรียก API ได้ และให้อ่าน body ของ request แบบ JSON
app.use(cors());
app.use(express.json());

// ให้บริการไฟล์ Static จากโฟลเดอร์ uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// เส้นทางไว้เช็คว่า server ยังทำงานอยู่
app.get('/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// แยกเส้นทาง API ตามหมวด: สมาชิก / งาน / กระเป๋าเงิน / ยืนยันตัวตนและรีเซ็ตรหัสผ่าน
app.use('/api/members', membersRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/wallets', walletsRoutes);
app.use('/api/auth', authRoutes);

// พอร์ตอ่านจาก .env (ถ้าไม่ตั้งใช้ 3000) เปิดฟังแล้วเริ่มตัวตรวจ no-show ที่ทำงานเบื้องหลัง
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  startNoShowWatcher();
});
