// ตรรกะรูปภาพของหน้ารายงานก่อน/หลังปฏิบัติงาน: ดึงรูปที่เคยอัปไว้กลับมาแสดง, ถ่าย/เลือกรูป, ลบรูป และอัปโหลดเฉพาะรูปใหม่แบบหลายรูปพร้อมกัน
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api/apiClient';
import { API_BASE_URL } from '../config/env';

const MAX_PER_ZONE = 4;
// อัปโหลดพร้อมกันกี่รูป (มากไปมือถือและ server จะอึดอัด น้อยไปจะช้า)
const UPLOAD_CONCURRENCY = 3;
// รูปจากกล้องไฟล์ใหญ่ ให้เวลาอัปโหลดต่อรูปนานกว่า timeout ปกติของแอป
const UPLOAD_TIMEOUT_MS = 60000;
// ลดคุณภาพรูปที่ได้จากกล้อง/คลังให้ไฟล์เล็กลง อัปโหลดเร็วขึ้น แต่ยังชัดพอเป็นหลักฐาน
const PICKER_QUALITY = 0.5;

// photoType: 'before' หรือ 'after'
// รูปแต่ละรูปในห้อง = { uri, photoId } ถ้ามี photoId แปลว่าอยู่บน server แล้ว ไม่ต้องอัปโหลดซ้ำ
export default function useWorkPhotos({ bookingId, services, photoType }) {
  const [zones, setZones] = useState([]);
  const [photos, setPhotos] = useState({});
  // กำลังเตรียมรูปจากกล้อง/คลัง (ตัวเลือกรูปต้องบีบอัดไฟล์ก่อนส่งกลับ ช่วงนี้หน้าจอจะเงียบ จึงแสดงสถานะรอ)
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // สร้างรายชื่อห้อง/บริการจากบริการที่จอง (ไม่ซ้ำ) ถ้าไม่มีข้อมูลบริการใช้ค่าสำรอง แล้วดึงรูปที่เคยอัปไว้ของงานนี้จาก server มาแสดง
  useEffect(() => {
    const unique = services && services.length > 0
      ? [...new Set(services.map(s => s.zone_name).filter(Boolean))]
      : ['ห้องนอน', 'ห้องน้ำ'];
    setZones(unique);
    const empty = {};
    unique.forEach(z => { empty[z] = []; });
    setPhotos(empty);

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(`/api/jobs/photos/${bookingId}`);
        if (cancelled) return;
        setPhotos(prev => {
          const next = { ...prev };
          unique.forEach(z => {
            const saved = res.data
              .filter(p => p.photo_type === photoType && p.service_zone === z)
              .map(p => ({ uri: `${API_BASE_URL}${p.photo_path}`, photoId: p.photo_id }));
            next[z] = [...saved, ...(prev[z] || [])].slice(0, MAX_PER_ZONE);
          });
          return next;
        });
      } catch (error) {
        // ดึงรูปเดิมไม่ได้ก็ใช้งานต่อได้ตามปกติ (แค่ไม่เห็นรูปที่เคยอัป)
        console.error('Error loading saved photos:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId, services, photoType]);

  // ขอสิทธิ์ใช้กล้องและคลังรูปภาพ ถ้าไม่อนุญาตจะแจ้งเตือนและไม่ทำต่อ
  const requestPermissions = async () => {
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (cameraStatus.status !== 'granted' || libraryStatus.status !== 'granted') {
      Alert.alert('แจ้งเตือน', 'กรุณาอนุญาตให้แอปเข้าถึงกล้องและคลังภาพเพื่ออัปโหลดรูปครับ');
      return false;
    }
    return true;
  };

  // เพิ่มรูปใหม่ (ยังไม่ได้อัป) เข้าห้องที่ระบุ ไม่เกิน 4 รูปต่อห้อง
  const addUris = (zone, uris) => {
    setPhotos(prev => ({
      ...prev,
      [zone]: [...(prev[zone] || []), ...uris.map(uri => ({ uri, photoId: null }))].slice(0, MAX_PER_ZONE)
    }));
  };

  // เปิดกล้องถ่ายรูปแล้วเพิ่มเข้าห้องที่เลือก
  const takePhoto = async (zone) => {
    if (!(await requestPermissions())) return;
    setPicking(true);
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: PICKER_QUALITY });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        addUris(zone, [result.assets[0].uri]);
      }
    } finally {
      setPicking(false);
    }
  };

  // เลือกรูปจากคลังได้หลายรูปพร้อมกัน แต่แต่ละห้องมีรูปได้ไม่เกิน 4 รูป
  const pickImage = async (zone) => {
    if (!(await requestPermissions())) return;

    const remainingLimit = MAX_PER_ZONE - (photos[zone] ? photos[zone].length : 0);
    if (remainingLimit <= 0) {
      Alert.alert('แจ้งเตือน', 'คุณอัปโหลดรูปภาพครบ 4 รูปแล้วสำหรับพื้นที่นี้');
      return;
    }

    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: PICKER_QUALITY,
        allowsMultipleSelection: true,
        selectionLimit: remainingLimit,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        addUris(zone, result.assets.map(asset => asset.uri).slice(0, remainingLimit));
      }
    } finally {
      setPicking(false);
    }
  };

  // ลบรูปตามลำดับที่กด ถ้ารูปอยู่บน server แล้วต้องสั่งลบที่ server ด้วย (ลบไม่สำเร็จจะไม่เอาออกจากหน้าจอ)
  const removePhoto = async (zone, index) => {
    if (uploading) return;
    const target = photos[zone]?.[index];
    if (!target) return;

    if (target.photoId) {
      try {
        await apiClient.delete(`/api/jobs/photo/${target.photoId}`);
      } catch (error) {
        console.error('Error deleting photo:', error);
        Alert.alert('ข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถลบรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }
    }
    setPhotos(prev => ({ ...prev, [zone]: prev[zone].filter(p => p.uri !== target.uri) }));
  };

  // ส่งรายงานได้เมื่อทุกห้องมีรูปอย่างน้อย 2 รูป
  const isComplete = zones.length > 0 && zones.every(zone => photos[zone] && photos[zone].length >= 2);

  // อัปโหลดเฉพาะรูปที่ยังไม่อยู่บน server ครั้งละหลายรูปพร้อมกัน รูปที่อัปสำเร็จจะถูกมาร์กไว้ ถ้ามีรูปพลาดจะ throw (กดลองใหม่แล้วอัปเฉพาะที่เหลือ)
  const uploadPending = async () => {
    const queue = [];
    zones.forEach(zone => (photos[zone] || []).forEach(p => {
      if (!p.photoId) queue.push({ zone, uri: p.uri });
    }));
    if (queue.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: queue.length });
    let nextIndex = 0;
    let done = 0;
    let failure = null;

    const worker = async () => {
      while (!failure && nextIndex < queue.length) {
        const { zone, uri } = queue[nextIndex++];
        try {
          const filename = uri.split('/').pop();
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image';

          const formData = new FormData();
          formData.append('photo', { uri, name: filename, type });
          formData.append('booking_id', bookingId);
          formData.append('service_zone', zone);
          formData.append('photo_type', photoType);

          const res = await apiClient.post('/api/jobs/upload-photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: UPLOAD_TIMEOUT_MS
          });
          const photoId = res.data.photo_id;
          setPhotos(prev => ({
            ...prev,
            [zone]: prev[zone].map(p => (p.uri === uri ? { ...p, photoId } : p))
          }));
          done += 1;
          setProgress({ done, total: queue.length });
        } catch (error) {
          failure = error;
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker));
    } finally {
      setUploading(false);
    }
    if (failure) throw failure;
  };

  return { zones, photos, picking, uploading, progress, isComplete, takePhoto, pickImage, removePhoto, uploadPending };
}
