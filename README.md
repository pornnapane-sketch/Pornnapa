# KU Maid (ฝั่งแม่บ้าน)

แอปมือถือสำหรับแม่บ้านรับงานทำความสะอาดหอพัก: สมัครสมาชิก รับ/ปฏิเสธงาน เริ่มเดินทาง ถ่ายรูปก่อน-หลังทำงาน แจ้งปัญหา ดูประวัติงาน และจัดการกระเป๋าเงิน/ถอนเงิน

## วิดีโอแนะนำโปรเจกต์
<!-- ใส่ลิงก์วิดีโอ YouTube หรือ Google Drive ตรงนี้ -->
(ลิงก์วิดีโอ)

## เทคโนโลยีที่ใช้
| ส่วน | เทคโนโลยี |
|---|---|
| แอปมือถือ (`mobile/`) | React Native, Expo SDK 57, React Navigation, react-native-maps |
| API (`server/`) | Node.js, Express, multer, nodemailer |
| ฐานข้อมูล | MySQL / MariaDB (ผ่าน XAMPP) |
| ยืนยันตัวตน | Firebase Authentication + Firebase Admin, รหัส OTP ทางอีเมล |

## โครงสร้างโปรเจกต์
```
mobile/   แอปมือถือ (หน้าจอทั้งหมดอยู่ใน src/screens)
server/   API server (เส้นทางอยู่ใน src/*.routes.js, ตัวตรวจเวลาอัตโนมัติ noShowWatcher.js)
```

## วิธีติดตั้งและรัน

### 1) ฐานข้อมูล
1. เปิด XAMPP แล้วสตาร์ท MySQL
2. สร้างฐานข้อมูล `ku_maid_db` แล้วนำเข้าไฟล์ `server/db.sql` (ผ่าน phpMyAdmin หรือคำสั่ง `mysql -u root < server/db.sql`)

### 2) API server
```bash
cd server
npm install
```
1. คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่าจริง (ฐานข้อมูล, Gmail, Firebase)
2. วางไฟล์ Firebase Service Account ชื่อ `serviceAccountKey.json` ไว้ในโฟลเดอร์ `server` (ดาวน์โหลดจาก Firebase Console)
3. รันเซิร์ฟเวอร์
```bash
npm run dev
```
ตรวจว่าทำงานได้ที่ `http://localhost:3000/health`

### 3) แอปมือถือ
```bash
cd mobile
npm install
```
1. แก้ `mobile/src/config/env.js` ให้ `API_BASE_URL` และ `IMAGE_BASE_URL` ชี้ไปที่ IP ของคอมพิวเตอร์ที่รัน server (ดูได้จาก `ipconfig`) มือถือและคอมพิวเตอร์ต้องอยู่ Wi-Fi เดียวกัน
2. รันแอป
```bash
npx expo start --dev-client
```
แอปใช้ react-native-maps จึงต้องใช้ development build (EAS) ไม่รองรับ Expo Go

## กฎอัตโนมัติของระบบ
ตั้งค่าได้ใน `server/.env` (หน่วยเป็นนาที)

| กฎ | ตัวแปร |
|---|---|
| แม่บ้านไม่ไปตามนัด งานถูกยกเลิก | `NO_SHOW_MINUTES` |
| ลูกค้าไม่โอนเงินหลังแม่บ้านรับงาน งานถูกยกเลิก | `PAYMENT_TIMEOUT_MINUTES` |
| แอดมินไม่ตรวจสลิปก่อนเวลานัด งานถูกยกเลิก | `VERIFY_DEADLINE_MINUTES` |
| แม่บ้านแจ้งปัญหาแล้วรอครบเวลา งานถูกยกเลิก | `PROBLEM_WAIT_MINUTES` |
| กดเริ่มเดินทางได้ก่อนเวลานัด | `START_TRAVEL_WINDOW_MINUTES` |

## หมายเหตุ
- ระบบลูกค้า แอดมิน และการคืนเงิน เป็นโปรแกรมแยกต่างหาก โปรเจกต์นี้เป็นฝั่งแม่บ้านเท่านั้น
- เส้นทาง `/test/...` ใน API ใช้จำลองการทำงานของโปรแกรมอื่นตอนทดสอบ ปิดได้ด้วย `ENABLE_TEST_ENDPOINTS=false`
