// แท็บหน้าหลัก: การ์ดโปรไฟล์พร้อมสวิตช์เปิด/ปิดรับงาน, คะแนนเฉลี่ย, จำนวนงานที่สำเร็จ และประวัติงานที่สำเร็จล่าสุด 5 งาน
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';
import { auth } from '../config/firebaseConfig';
import { Alert } from 'react-native';
import { API_BASE_URL } from '../config/env';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [maidData, setMaidData] = useState(null);
  
  // State สำหรับปุ่มเปิด-ปิด สถานะ (true = active/พร้อมรับงาน, false = inactive/ปิดรับงาน)
  // เป็นตัวกำหนดหน้าตาของสวิตช์และข้อความสถานะ ค่าเริ่มต้นเป็น false (ออฟไลน์) จนกว่าจะโหลดค่าจริงจากฐานข้อมูลเสร็จ
  const [isReady, setIsReady] = useState(false);
  const [completedJobs, setCompletedJobs] = useState([]);

  // ดึงข้อมูลทั้งหมดของหน้า: โปรไฟล์ -> ประวัติงาน (เก็บเฉพาะงานที่สำเร็จ) -> คะแนนรีวิวเฉลี่ย
  const fetchMaidData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลการล็อกอิน');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // ดึงข้อมูลจริงจากฐานข้อมูล MySQL (XAMPP) ผ่าน API
      const response = await apiClient.get(`/api/members/profile?email=${currentUser.email}`);
      const dbData = response.data;

      setMaidData(dbData);
      // ตรวจสอบจาก is_online (1 = ออนไลน์, 0 = ออฟไลน์)
      // นำค่าที่เก็บในฐานข้อมูลมาตั้งเป็น state ของสวิตช์ เพื่อให้เปิดแอปครั้งใหม่แล้วสวิตช์ตรงกับสถานะล่าสุดที่เคยตั้งไว้
      setIsReady(dbData.is_online === 1);

      // ดึงข้อมูลประวัติการทำงาน
      if (dbData.maid_id) {
        const historyRes = await apiClient.get(`/api/jobs/history?maid_id=${dbData.maid_id}`);
        const allHistory = historyRes.data || [];
        // กรองเฉพาะงานที่สำเร็จ
        const completed = allHistory.filter(job => job.status === 'completed');
        setCompletedJobs(completed);
        
        // Fetch rating score
        try {
          const reviewRes = await apiClient.get(`/api/members/profile/reviews?maid_id=${dbData.maid_id}`);
          if (reviewRes.data && reviewRes.data.avgRating !== undefined) {
             setMaidData(prev => ({ ...prev, rating: reviewRes.data.avgRating }));
          }
        } catch (e) {
          console.log('Error fetching review stats:', e);
        }
      }

    } catch (error) {
      console.error('Error fetching maid profile:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลจากฐานข้อมูลได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // โหลดข้อมูลครั้งแรกตอนเปิดหน้า
  useEffect(() => {
    fetchMaidData();
  }, []);

  // ดึงจอลงเพื่อรีเฟรชข้อมูล
  const onRefresh = () => {
    setRefreshing(true);
    fetchMaidData();
  };

  // ฟังก์ชันเมื่อกดปุ่มสวิตช์ เปิด-ปิด สถานะ
  // ลำดับ: กลับค่าสถานะ -> เปลี่ยนหน้าจอทันที -> บันทึกลงฐานข้อมูล -> ถ้าบันทึกไม่สำเร็จให้ย้อนสวิตช์กลับ
  const toggleSwitch = async () => {
    // 1. กลับค่าจากสถานะปัจจุบัน (ออนไลน์ -> ออฟไลน์ หรือออฟไลน์ -> ออนไลน์)
    const newStatus = !isReady;
    setIsReady(newStatus); // เปลี่ยน UI ทันทีให้ลื่นไหล

    try {
      // ต้องมีผู้ล็อกอินอยู่ จึงจะรู้ว่าจะแก้สถานะของแม่บ้านคนไหน
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // 2. ส่งค่ากลับไปอัปเดตคอลัมน์ is_online ในตาราง maids ของจริง (server รับที่ PUT /api/members/profile/status)
      // หน้างานใหม่และตัวเลขแจ้งเตือนบนแท็บจะอ่านค่านี้ไปเช็กก่อนแสดงงาน (ออฟไลน์ = ไม่แสดง)
      await apiClient.put('/api/members/profile/status', {
        email: currentUser.email,
        is_online: newStatus ? 1 : 0 // แปลงเป็น 1 หรือ 0 ก่อนส่ง
      });

    } catch (error) {
      // 3. บันทึกไม่สำเร็จ (เช่นเน็ตหลุด): แจ้งผู้ใช้ และย้อนสวิตช์กลับ เพื่อไม่ให้หน้าจอแสดงสถานะที่ไม่ตรงกับในฐานข้อมูล
      console.error('Error updating status:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถอัปเดตสถานะในระบบได้');
      setIsReady(!newStatus); // ถ้า error ให้สวิตช์เด้งกลับ
    }
  };

  // ถ้าระบบกำลังโหลดข้อมูล ให้แสดงวงแหวนหมุนๆ
  if (loading || !maidData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0E6643" />
      </View>
    );
  }

  // แปลงวันเวลาเป็นข้อความไทย เช่น 12 ต.ค. 2569 13:00 น. (ปีเป็น พ.ศ.)
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const dayNum = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${dayNum} ${month} ${year}    ${hours}:${minutes} น.`;
  };

  // หน้าจอหลัก: การ์ดโปรไฟล์ + สวิตช์รับงาน, กล่องคะแนน/งานที่สำเร็จ, และรายการงานที่สำเร็จล่าสุด (ถ้าไม่มีแสดงข้อความว่าง)
  return (
    <SafeAreaView style={styles.container}>
      {/* ส่วน Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>KU CSC Maid</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} />
        }
      >
        
        {/* การ์ดโปรไฟล์แม่บ้าน */}
        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            {maidData.profile_pic ? (
              <Image 
                source={{ uri: `${API_BASE_URL}${maidData.profile_pic}` }} 
                style={styles.profileImage} 
              />
            ) : (
              <View style={[styles.profileImage, styles.defaultAvatar]}>
                <Text style={styles.defaultAvatarText}>
                  {maidData.first_name ? maidData.first_name.charAt(0) : '?'}
                </Text>
              </View>
            )}
            <View style={styles.profileTextContainer}>
              <Text style={styles.greetingText}>สวัสดี,</Text>
              <Text style={styles.nameText}>
                {/* ดึง คำนำหน้า + ชื่อ + นามสกุล มาต่อกัน */}
                {maidData.title_prefix}{maidData.first_name} {maidData.last_name}
              </Text>
              <Text style={styles.emailText}>Email: {maidData.email}</Text>
            </View>
          </View>

          {/* ส่วนสวิตช์เปิด-ปิดรับงาน: ข้อความ สีปุ่ม และตำแหน่งสวิตช์ทั้งหมดอ่านจาก state isReady, กดแล้วเรียก toggleSwitch */}
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              สถานะ : {isReady ? 'พร้อมรับงาน' : 'ปิดรับงาน'}
            </Text>
            <Switch
              trackColor={{ false: '#d3d3d3', true: '#a5d6a7' }}
              thumbColor={isReady ? '#2e7d32' : '#f4f3f4'}
              onValueChange={toggleSwitch}
              value={isReady}
            />
          </View>
        </View>

        {/* ส่วนกล่องคะแนนและงานที่สำเร็จ */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statTitle}>คะแนนเฉลี่ย</Text>
            <View style={styles.statValueContainer}>
              <Ionicons name="star" size={20} color="#F1C40F" />
              <Text style={styles.statValue}> {maidData.rating !== undefined && maidData.rating !== null && maidData.rating > 0 ? Number(maidData.rating).toFixed(1) : '0.0'}</Text>
            </View>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statTitle}>งานที่สำเร็จ</Text>
            <Text style={styles.statValue}>{completedJobs.length} งาน</Text>
          </View>
        </View>

        {/* ส่วนประวัติรายการล่าสุด */}
        <Text style={styles.sectionTitle}>ประวัติรายการล่าสุด</Text>

        {completedJobs.length > 0 ? (
          completedJobs.slice(0, 5).map((job, index) => (
            <View key={index} style={styles.jobCard}>
              <View style={styles.jobLeft}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#27AE60" />
                <View style={styles.jobDetails}>
                  <Text style={styles.jobTitle}>{job.location}</Text>
                  <Text style={styles.jobDate}>{formatDateTime(job.booking_date)}</Text>
                </View>
              </View>
              <View style={styles.jobRight}>
                <Text style={styles.jobPrice}>+ {job.total_price}</Text>
                <Text style={styles.jobStatus}>สำเร็จแล้ว</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="document-text-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>ยังไม่มีประวัติรายการ</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// โค้ดตกแต่งหน้าจอ
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FAF0',
  },
  container: {
    flex: 1,
    backgroundColor: '#F0FAF0', // เปลี่ยนเป็นสีขาว F0FAF0  FFF F4F6F8
  },
  header: {
    backgroundColor: '#0E6643', // สีเขียวเข้มของแถบด้านบน
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3, // เงาสำหรับ Android
    shadowColor: '#000', // เงาสำหรับ iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#eee',
  },
  defaultAvatar: {
    backgroundColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: '#27AE60',
    fontWeight: '600',
  },
  nameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 2,
  },
  emailText: {
    fontSize: 14,
    color: '#555',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 15,
    color: '#555',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: '#FFF',
    width: '48%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 10,
  },
  jobCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  jobLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  jobDetails: {
    marginLeft: 12,
    flex: 1,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  jobDate: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  jobRight: {
    alignItems: 'flex-end',
  },
  jobPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  jobStatus: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '600',
    marginTop: 4,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  emptyStateText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 12,
  }
});