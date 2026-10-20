// ตำแหน่งไฟล์: src/config/firebaseConfig.js

import { initializeApp } from 'firebase/app';
// นำเข้าบริการต่างๆ ที่คุณต้องการใช้งาน (เช่น Auth สำหรับล็อกอิน, Firestore สำหรับฐานข้อมูล)
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// คัดลอกค่า Config เหล่านี้มาจากหน้าเว็บ Firebase ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyBwlJ-mRUsXTudg8nKTDyv3n1EdAqQISYY",
  authDomain: "ku-maid-service-8e998.firebaseapp.com",
  projectId: "ku-maid-service-8e998",
  storageBucket: "ku-maid-service-8e998.firebasestorage.app",
  messagingSenderId: "128923572562",
  appId: "1:128923572562:web:7e2d1e20d24b69921b028b"
};

// สั่งให้แอป Firebase เริ่มทำงาน
const app = initializeApp(firebaseConfig);

// เตรียมส่งออกเครื่องมือต่างๆ (export) เพื่อให้ไฟล์อื่นนำไปใช้งานต่อได้
// auth ใช้ล็อกอิน/สมัครด้วยอีเมล โดยเก็บสถานะล็อกอินในเครื่อง (AsyncStorage) ผู้ใช้จึงไม่ต้องล็อกอินใหม่ทุกครั้งที่เปิดแอป
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
// ตัวเชื่อม Firestore ส่งออกไว้ให้หน้าอื่นเรียกใช้เมื่อจำเป็น
export const db = getFirestore(app);