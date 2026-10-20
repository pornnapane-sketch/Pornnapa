// แท็บตารางงาน: แถบเลือกวัน (ล่วงหน้า 14 วัน) และการ์ดงานที่แม่บ้านรับไว้ในวันนั้น พร้อมสถานะการชำระเงิน
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { auth } from '../config/firebaseConfig';
import { useAlert } from '../context/AlertContext';

export default function ScheduleScreen({ navigation, route }) {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [maidData, setMaidData] = useState(null);

  // มีข้อความแจ้งจากหน้าอื่นส่งมา (เช่น งานถูกยกเลิกหลังหมดเวลารอ) แสดงหนึ่งครั้งแล้วล้างทิ้ง
  useEffect(() => {
    const notice = route?.params?.notice;
    if (notice) {
      showAlert('งานถูกยกเลิกแล้ว', notice);
      navigation.setParams({ notice: undefined });
    }
  }, [route?.params?.notice]);

  // การสร้างรายการวันที่ (14 วันล่วงหน้า)
  // สร้างแถบวันที่ 14 วันนับจากวันนี้ แต่ละแท็บมีรหัสวันที่ yyyy-mm-dd ตามเวลาเครื่อง ใช้เทียบกับวันนัดของงาน
  const generateDateTabs = () => {
    const tabs = [];
    const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;
      
      let label = '';
      if (i === 0) {
        label = 'วันนี้';
      } else {
        label = `${days[d.getDay()]} ${d.getDate()}`;
      }
      
      tabs.push({
        id: dateString,
        dateString,
        label,
        isToday: i === 0
      });
    }
    return tabs;
  };

  const [dateTabs] = useState(generateDateTabs());
  const [selectedDate, setSelectedDate] = useState(dateTabs[0].dateString);

  // ดึงงานที่แม่บ้านรับไว้จาก server เก็บไว้ทั้งหมด แล้วกรองแสดงตามวันที่เลือกในฝั่งแอป (เปลี่ยนแท็บวันไม่ต้องโหลดใหม่)
  const fetchJobs = async (maidId) => {
    try {
      const res = await apiClient.get(`/api/jobs/schedule?maid_id=${maidId}`);
      setAllJobs(res.data);
    } catch (error) {
      console.error('Error fetching schedule jobs:', error);
    }
  };

  // หาข้อมูลแม่บ้านจากอีเมลที่ล็อกอิน (ครั้งแรกครั้งเดียว) แล้วโหลดรายการงาน
  const initData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (!maidData) {
        const profileRes = await apiClient.get(`/api/members/profile?email=${currentUser.email}`);
        setMaidData(profileRes.data);
        await fetchJobs(profileRes.data.maid_id);
      } else {
        await fetchJobs(maidData.maid_id);
      }
    } catch (error) {
      console.error('Error init schedule:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ดึงข้อมูลทั้งหมด 1 ครั้งตอนโหลดหน้า
  // โหลดงานใหม่ทุกครั้งที่กลับมาที่แท็บนี้ (เช่นหลังรับงานหรือหลังลูกค้าชำระเงิน)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      initData();
    }, [])
  );

  // กรองข้อมูลงานตามวันที่เลือกแบบเบาๆ (ไม่ทำให้จอโหลด)
  useEffect(() => {
    const filtered = allJobs.filter(job => {
      // job.booking_date มาเป็นเวลา UTC เช่น 2026-10-11T20:55:00.000Z (คือ 12 ต.ค. 03:55 เวลาไทย)
      // ต้องแปลงเป็นวันที่ตามเวลาเครื่องก่อนเทียบ ไม่งั้นงานช่วงเที่ยงคืนถึงตี 7 จะไปอยู่วันก่อนหน้า
      const d = new Date(job.booking_date);
      const jobDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return jobDateStr === selectedDate;
    });
    setJobs(filtered);
  }, [selectedDate, allJobs]);

  // ดึงจอลงเพื่อรีเฟรชรายการงาน
  const onRefresh = () => {
    setRefreshing(true);
    initData();
  };

  // จัดรูปแบบวันที่สำหรับการ์ด
  // แปลงเวลานัดเป็นข้อความสำหรับการ์ด: วันที่แบบไทย (พ.ศ.), เวลา และชื่อวัน
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const fullDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    const dayName = fullDays[date.getDay()];
    const dayNum = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543;
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return {
      dateText: `${dayNum}/${month}/${year}`,
      timeText: `${hours}:${minutes}`,
      dayName: dayName,
    };
  };

  // วาดแท็บวัน 1 อัน: อันที่เลือกเป็นสีเขียวเข้ม, วันนี้ที่ยังไม่ได้เลือกมีขอบเขียว
  const renderDateTab = ({ item }) => {
    const isSelected = selectedDate === item.dateString;
    return (
      <TouchableOpacity
        style={[
          styles.dateTab,
          isSelected && styles.dateTabSelected,
          !isSelected && item.isToday && styles.dateTabToday
        ]}
        onPress={() => {
          setSelectedDate(item.dateString);
        }}
      >
        <Text style={[
          styles.dateTabText,
          isSelected && styles.dateTabTextSelected,
          !isSelected && item.isToday && styles.dateTabTextToday
        ]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  // วาดการ์ดงาน 1 งาน: สีเขียว = ชำระเงินแล้ว, สีส้ม = รอชำระ/รอตรวจสอบ กดแล้วไปหน้ารายละเอียดตามสถานะ (งานที่กำลังแจ้งปัญหาไปหน้ารอตรวจสอบ)
  const renderJobCard = ({ item }) => {
    const { dateText, timeText, dayName } = formatDateTime(item.booking_date);
    
    // งานที่สามารถกดเข้าไปดูได้ (รวมงานที่แจ้งปัญหาอยู่ด้วย และงานที่ยังรอชำระเงิน/รอตรวจสอบ)
    const isClickable = item.status === 'confirmed' || item.status === 'in_progress' || item.status === 'investigating'
      || item.status === 'waiting_payment' || item.status === 'verifying_payment';
    // เฉพาะงานที่รอชำระเงินหรือรอตรวจสอบถึงจะเป็นสีเหลือง/ส้ม
    const isPaid = item.status !== 'pending' && item.status !== 'waiting_payment' && item.status !== 'verifying_payment';
    const themeColor = isPaid ? '#0E6643' : '#DCA34E';

    return (
      <TouchableOpacity
        style={[styles.jobCard, { borderLeftColor: themeColor, backgroundColor: '#FFF' }]}
        onPress={() => {
          if (item.status === 'investigating') {
            navigation.navigate('ReportProblemWait', { bookingId: item.booking_id });
          } else if (!isPaid) {
            // รอชำระเงิน/รอตรวจสอบ: ดูรายละเอียดได้อย่างเดียว ไม่มีปุ่มรับ/ไม่รับงาน
            navigation.navigate('NewJobDetail', { bookingId: item.booking_id });
          } else {
            navigation.navigate('AcceptedJobDetail', { bookingId: item.booking_id });
          }
        }}
        disabled={!isClickable}
      >
        <View style={styles.jobHeaderRow}>
          <Text style={styles.locationText}>{item.location}</Text>
        </View>

        <View style={styles.jobDetailRow}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar" size={18} color={themeColor} />
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>{dateText}</Text>
              <Text style={[styles.dayText, { color: themeColor }]}>{dayName}</Text>
            </View>
          </View>
          <View style={[styles.detailItem, { marginRight: 8 }]}>
            <Ionicons name="time" size={18} color={themeColor} />
            <Text style={styles.timeText}>{timeText}</Text>
          </View>
          <Text style={[styles.statusLabel, { color: themeColor }]}>
            {item.status === 'verifying_payment' ? 'รอตรวจสอบ' : isPaid ? 'ชำระเงินแล้ว' : 'รอชำระเงิน'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>{item.total_price} บาท</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // โหลดครั้งแรกที่ยังไม่มีงานให้แสดง จะแสดงวงกลมหมุนแทนหน้าจอ
  if (loading && !jobs.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0E6643" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.mainHeader}>
        <Text style={styles.mainHeaderTitle}>KU CSC Maid</Text>
      </View>

      {/* แถบเลื่อนวันที่ */}
      <View style={styles.datePickerContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={dateTabs}
          keyExtractor={(item) => item.id}
          renderItem={renderDateTab}
          contentContainerStyle={styles.datePickerContent}
        />
      </View>

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
            <Ionicons name="calendar-clear-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>ไม่มีงานในวันนี้</Text>
            <Text style={styles.emptyStateSubtitle}>
              คุณไม่มีคิวงานที่ต้องทำในวันที่เลือก
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FAF0'
  },
  container: {
    flex: 1,
    backgroundColor: '#F0FAF0'
  },
  mainHeader: {
    backgroundColor: '#0E6643',
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainHeaderTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  datePickerContainer: {
    backgroundColor: '#F0FAF0',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerContent: {
    paddingHorizontal: 12,
  },
  dateTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E7EB', // สีเทาอ่อนๆ สำหรับวันทั่วไป
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateTabToday: {
    backgroundColor: '#FFF',
    borderColor: '#0E6643', // ขอบสีเขียวสำหรับวันนี้ แต่ไม่ได้เลือก
  },
  dateTabSelected: {
    backgroundColor: '#0E6643',
    borderColor: '#0E6643',
    borderWidth: 1,
  },
  dateTabText: {
    fontSize: 14,
    color: '#555',
  },
  dateTabTextToday: {
    color: '#0E6643',
    fontWeight: 'bold',
  },
  dateTabTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  listContent: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationText: {
    flex: 1,
    marginRight: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  statusLabel: {
    marginLeft: 'auto',
    alignSelf: 'flex-start',
    marginTop: 3,
    fontSize: 12,
    fontWeight: 'bold',
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
    color: '#0E6643',
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
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
