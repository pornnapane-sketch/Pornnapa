// ฟังก์ชันเรียก API ของสมาชิก (ส่วนเสริม ใช้ apiClient ตัวเดียวกับทั้งแอป)
import apiClient from './apiClient';

// ดึงรายชื่อสมาชิกทั้งหมดจาก server
export const getMembers = async () => {
  const response = await apiClient.get('/api/members');
  return response.data;
};

// ส่งข้อมูลสมาชิกใหม่ไปเพิ่มที่ server
export const createMember = async (data) => {
  const response = await apiClient.post('/api/members', data);
  return response.data;
};

