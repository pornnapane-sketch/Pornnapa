// สร้าง connection pool ของ MySQL ไว้ใช้ร่วมกันทั้ง server (ค่าเชื่อมต่ออ่านจากไฟล์ .env)
const mysql = require('mysql2/promise');
require('dotenv').config();

// pool เปิดการเชื่อมต่อไว้ใช้ซ้ำ จำกัดพร้อมกันไม่เกิน 10 และให้รอคิวเมื่อเต็ม แทนที่จะ error ทันที
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ส่งออก pool ให้ไฟล์ routes เรียก pool.query(...) ได้
module.exports = pool;

