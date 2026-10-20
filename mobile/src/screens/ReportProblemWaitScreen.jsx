// หน้ารอตรวจสอบหลังแจ้งปัญหา: นับถอยหลังตามเวลาที่ server กำหนด (ปกติ 10 นาที) นับจากเวลาที่แจ้ง ครบแล้ว server ยกเลิกงานให้อัตโนมัติ (แม้แม่บ้านปิดแอปไปแล้ว) หรือแม่บ้านกด กลับไปปฏิบัติงาน เพื่อยกเลิกการแจ้งปัญหา
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Alert, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';

export default function ReportProblemWaitScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const insets = useSafeAreaInsets();
  
  const [timeLeft, setTimeLeft] = useState(600); // วินาทีที่เหลือ (ค่าจริงมาจาก server)
  const [waitMinutes, setWaitMinutes] = useState(10); // ระยะเวลารอทั้งหมดที่ server กำหนด ใช้แสดงในข้อความ
  // กันการสั่งยกเลิก/แสดงป๊อบอัพซ้ำสองครั้ง
  const timeoutHandledRef = useRef(false);
  // เวลาสิ้นสุดการรอ (ตามนาฬิกาเครื่อง) ใช้คำนวณเวลาที่เหลือจากเวลาจริงทุกครั้ง ไม่ลดเลขทีละ 1 เพราะตอนแอปอยู่เบื้องหลังตัวนับจะหยุดทำงาน
  const deadlineRef = useRef(null);
  const cancellingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  // ตัวควบคุมแอนิเมชันหมุนไอคอนนาฬิกาทราย
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Animation Loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
        Animated.timing(spinAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ])
    ).start();
  }, [spinAnim]);

  // ดึงสถานะจาก server แล้วตั้งเวลาสิ้นสุดการรอใหม่ (คิดจากนาฬิกา server ไม่ใช้นาฬิกามือถือ)
  // ถ้างานถูกยกเลิกไปแล้วระหว่างที่ปิดแอป แจ้งทันที ถ้าเวลาหมดแล้วสั่งยกเลิกงานทันที
  const syncStatus = async () => {
    try {
      const response = await apiClient.get(`/api/jobs/wait-status/${bookingId}`);
      const { booking_status, seconds_left, wait_minutes } = response.data;
      if (wait_minutes) setWaitMinutes(wait_minutes);
      deadlineRef.current = Date.now() + seconds_left * 1000;
      setTimeLeft(seconds_left);

      if (booking_status === 'cancelled') {
        showCancelled();
      } else if (booking_status === 'investigating' && seconds_left === 0) {
        handleTimeout();
      }
    } catch (error) {
      console.error('Error fetching wait status:', error);
    } finally {
      setLoading(false);
    }
  };

  // โหลดสถานะตอนเปิดหน้า และโหลดใหม่ทุกครั้งที่กลับเข้าแอป (ออกจากแอปไปแล้วกลับมา เวลาจะข้ามไปตามเวลาจริง)
  useEffect(() => {
    syncStatus();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncStatus();
    });
    return () => subscription.remove();
  }, [bookingId]);

  // นับถอยหลังทุก 1 วินาที โดยคำนวณจากเวลาสิ้นสุดการรอ เมื่อเหลือ 0 เรียก handleTimeout
  useEffect(() => {
    if (loading) return;
    const timer = setInterval(() => {
      if (deadlineRef.current === null) return;
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) handleTimeout();
    }, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  // งานถูกยกเลิกแล้ว (ยกเลิกที่ server ไปก่อนหน้านี้แล้ว) ออกจากหน้านี้ทันทีไปแท็บตารางงาน ไม่ต้องรอกดปุ่ม
  // ส่งข้อความแจ้งเหตุผลไปให้หน้าตารางงานแสดงทีหลัง ล้างประวัติหน้าไม่ให้ย้อนกลับมาหน้านี้
  const showCancelled = () => {
    if (timeoutHandledRef.current) return;
    timeoutHandledRef.current = true;
    navigation.reset({
      index: 0,
      routes: [{
        name: 'Home',
        params: {
          screen: 'ScheduleTab',
          params: { notice: `ครบกำหนดรอ ${waitMinutes} นาที ระบบได้ยกเลิกงานนี้เรียบร้อยแล้ว` }
        }
      }]
    });
  };

  // ครบเวลา: ให้ server ยกเลิกงาน (server ตรวจเวลาเองอีกครั้ง) ถ้า server ยังบอกว่าไม่ครบ (นาฬิกาเหลื่อมกันเล็กน้อย) รอ 2 วินาทีแล้วลองใหม่ได้ 3 ครั้ง
  const handleTimeout = async () => {
    if (timeoutHandledRef.current || cancellingRef.current) return;
    cancellingRef.current = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await apiClient.post('/api/jobs/cancel-timeout', { booking_id: bookingId });
          showCancelled();
          return;
        } catch (error) {
          if (error.response?.data?.code === 'TOO_EARLY') {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
          console.error('Error cancelling on timeout:', error);
          return;
        }
      }
    } finally {
      cancellingRef.current = false;
    }
  };

  // แม่บ้านเลือกกลับไปทำงานต่อ: ให้ server ยกเลิกการแจ้งปัญหา (สถานะกลับเป็น confirmed) แล้วล้างประวัติหน้าให้เหลือ Home -> รายละเอียดงานเดิม
  const handleResume = async () => {
    setActionLoading(true);
    try {
      await apiClient.post('/api/jobs/resume-job', { booking_id: bookingId });
      // เคลียร์หน้าแจ้งปัญหา/แนบหลักฐานที่ค้างอยู่ใน stack ทั้งหมด แล้วกลับไปหน้ารายละเอียดงานเดิม
      // ตั้ง Home ไว้เป็นหน้าล่างสุด เพื่อให้กด < จากหน้ารายละเอียดงานแล้วไม่ย้อนไปเจอหน้าแจ้งปัญหาอีก
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Home' },
          { name: 'AcceptedJobDetail', params: { bookingId } },
        ],
      });
    } catch (error) {
      console.error('Error resuming job:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถกลับไปปฏิบัติงานได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setActionLoading(false);
    }
  };

  // แปลงจำนวนวินาทีเป็นข้อความ นาที : วินาที
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')} : ${s.toString().padStart(2, '0')}`;
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  // หัวเรื่องพร้อมปุ่มย้อนกลับ การ์ดแสดงไอคอนนาฬิกาทราย เวลาที่เหลือ และปุ่มกลับไปปฏิบัติงาน
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home', params: { screen: 'ScheduleTab' } }] })}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แจ้งปัญหา</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0E6643" />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.card}>
            
            <Animated.View style={[styles.iconContainer, { transform: [{ rotate: spin }] }]}>
              <Ionicons name="hourglass" size={100} color="#C9A87C" />
            </Animated.View>

            <Text style={styles.mainTitle}>ระบบได้รับข้อมูลแล้ว</Text>
            
            <Text style={styles.description}>
              กรุณารออีก {waitMinutes} นาทีระบบจะทำการยกเลิกงาน และ พิจารณาจ่ายค่าชดเชย
            </Text>

            <Text style={styles.timerLabel}>เวลาที่เหลือสำหรับการรอ</Text>
            
            <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>
            
            <TouchableOpacity 
              style={styles.resumeButton} 
              onPress={handleResume}
              disabled={actionLoading || timeLeft <= 0}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.resumeButtonText}>กลับไปปฏิบัติงาน</Text>
              )}
            </TouchableOpacity>

          </View>
        </View>
      )}
    </View>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    zIndex: 10
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0E6643'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
    justifyContent: 'flex-start',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    marginBottom: 30,
    marginTop: 10,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  timerLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  timerValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 40,
  },
  resumeButton: {
    backgroundColor: '#1EAE53',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
