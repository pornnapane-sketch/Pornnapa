// ตัวเรียก API กลางของแอป: ทุกหน้าเรียก server ผ่านตัวนี้ เพื่อกำหนด URL หลักและ timeout ไว้ที่เดียว
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

// รอ server ตอบไม่เกิน 10 วินาที เกินแล้วถือว่าเรียกไม่สำเร็จ
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export default apiClient;

