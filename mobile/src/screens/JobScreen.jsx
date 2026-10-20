// แท็บงานใหม่: รายการงานที่รอแม่บ้านกดรับ (แสดงเมื่อเปิดสถานะพร้อมรับงานเท่านั้น) กดการ์ดเพื่อดูรายละเอียดและรับ/ปฏิเสธงาน
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { auth } from '../config/firebaseConfig';

export default function JobScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [isOnline, setIsOnline] = useState(false);

  // เช็คสถานะออนไลน์ก่อน ถ้าปิดรับงานจะไม่โหลดงานเลย ถ้าเปิดอยู่ค่อยดึงรายการงานใหม่ (server ซ่อนงานที่เวลาชนกับงานที่รับไว้แล้ว)
  const fetchJobsAndStatus = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // 1. ตรวจสอบสถานะออนไลน์ของแม่บ้าน
      const profileRes = await apiClient.get(`/api/members/profile?email=${currentUser.email}`);
      const onlineStatus = profileRes.data.is_online === 1;
      setIsOnline(onlineStatus);

      // 2. ถ้าออนไลน์ ให้ดึงข้อมูลงานใหม่
      if (onlineStatus) {
        const jobsRes = await apiClient.get(`/api/jobs/new?maid_id=${profileRes.data.maid_id}`);
        setJobs(jobsRes.data);
      } else {
        setJobs([]);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // โหลดใหม่ทุกครั้งที่เปิดแท็บนี้ เพื่อให้เห็นงานล่าสุดเสมอ
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchJobsAndStatus();
    }, [])
  );

  // ดึงจอลงเพื่อรีเฟรชรายการ
  const onRefresh = () => {
    setRefreshing(true);
    fetchJobsAndStatus();
  };

  // ฟังก์ชันจัดรูปแบบวันที่และเวลา
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    const dayName = days[date.getDay()];
    const dayNum = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543; // ปี พ.ศ.
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return {
      dateText: `${dayNum}/${month}/${year}`,
      timeText: `${hours}:${minutes}`,
      dayName: dayName,
      color: '#27AE60' // getDayColor(date.getDay())
    };
  };

  // const getDayColor = (dayIndex) => {
  //   return '#27AE60'; 
  // };

  // วาดการ์ดงานใหม่ 1 งาน (สถานที่ วันเวลา ราคา) กดแล้วไปหน้า NewJobDetail
  const renderJobCard = ({ item }) => {
    const { dateText, timeText, dayName, color } = formatDateTime(item.booking_date);
    
    return (
      <TouchableOpacity 
        style={styles.jobCard} 
        onPress={() => navigation.navigate('NewJobDetail', { bookingId: item.booking_id })}
      >
        <View style={styles.jobHeaderRow}>
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
        
        <View style={styles.jobDetailRow}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar" size={18} color="#27AE60" />
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>{dateText}</Text>
              <Text style={[styles.dayText, { color: color }]}>{dayName}</Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time" size={18} color="#27AE60" />
            <Text style={styles.timeText}>{timeText}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>{item.total_price} บาท</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ระหว่างโหลดแสดงวงกลมหมุน
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0E6643" />
      </View>
    );
  }

  // ถ้าปิดรับงานแสดงข้อความให้เปิดสวิตช์ (ดึงจอลงรีเฟรชได้) ถ้าเปิดอยู่แสดงรายการงานแบบเลื่อนดู หรือข้อความว่างเมื่อยังไม่มีงาน
  return (
    <SafeAreaView style={styles.container}>
      {/* ส่วน Header */}
      <View style={styles.mainHeader}>
        <Text style={styles.headerTitle}>KU CSC Maid</Text>
      </View>

      <View style={styles.pageHeader}>
        <Text style={styles.pageHeaderTitle}>งานใหม่</Text>
      </View>

      {!isOnline ? (
        <ScrollView 
          contentContainerStyle={styles.emptyStateContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} />
          }
        >
          <Ionicons name="power" size={60} color="#CBD5E1" />
          <Text style={styles.emptyStateTitle}>คุณกำลังปิดรับงาน</Text>
          <Text style={styles.emptyStateSubtitle}>กรุณากดเปิดสวิตช์ "พร้อมรับงาน" ที่หน้าหลักเพื่อดูงานใหม่</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.booking_id.toString()}
          renderItem={renderJobCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Ionicons name="document-text-outline" size={60} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>ยังไม่มีงานใหม่</Text>
              <Text style={styles.emptyStateSubtitle}>ในขณะนี้ยังไม่มีงานใหม่เข้ามาในระบบ</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FAF0' // <-- จุดเปลี่ยนสีพื้นหลัง (ถ้าอยากกลับไปใช้สีเขียวอ่อน ให้เปลี่ยนเป็น '#F0FAF0')
  },
  container: {
    flex: 1,
    backgroundColor: '#F0FAF0' // <-- จุดเปลี่ยนสีพื้นหลัง (ถ้าอยากกลับไปใช้สีเขียวอ่อน ให้เปลี่ยนเป็น '#F0FAF0')
  },
  mainHeader: {
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
  pageHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  pageHeaderTitle: {
    fontSize: 20,
    color: '#333',
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 40,
  },
  jobCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 6,
    borderLeftColor: '#0E6643'
  },
  jobHeaderRow: {
    marginBottom: 12,
  },
  locationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  jobDetailRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 24,
  },
  dateContainer: {
    marginLeft: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#000',
  },
  dayText: {
    fontSize: 14,
    marginTop: 2,
  },
  timeText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  priceRow: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 18,
    color: '#E74C3C', 
  },
  emptyStateContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 22,
  }
});
