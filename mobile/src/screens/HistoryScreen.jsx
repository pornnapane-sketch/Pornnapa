// ประวัติการรับงาน: งานที่เสร็จสิ้นหรือถูกยกเลิก จัดกลุ่มตามเดือน กรองด้วยแท็บ ทั้งหมด / สำเร็จแล้ว / ยกเลิก และกดดูรายละเอียดได้
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';

export default function HistoryScreen({ route, navigation }) {
  const { maidData } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allJobs, setAllJobs] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'completed', 'cancelled'

  // ดึงประวัติงานทั้งหมดของแม่บ้านจาก server (ทั้งสำเร็จและยกเลิก) เก็บไว้แล้วกรองตามแท็บในฝั่งแอป
  const fetchHistory = async () => {
    try {
      if (!maidData) return;
      const res = await apiClient.get(`/api/jobs/history?maid_id=${maidData.maid_id}`);
      setAllJobs(res.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // โหลดใหม่ทุกครั้งที่กลับมาที่หน้านี้ จะได้เห็นงานที่เพิ่งถูกยกเลิก/เสร็จสิ้นทันที
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [maidData])
  );

  // ดึงจอลงเพื่อรีเฟรชรายการ
  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  // กรองข้อมูลตามแถบที่เลือก
  const filteredJobs = allJobs.filter(job => {
    if (filter === 'all') return true;
    if (filter === 'completed') return job.status === 'completed';
    if (filter === 'cancelled') return job.status === 'cancelled' || job.status === 'cancelled_no_maid';
    return true;
  });

  // จัดกลุ่มข้อมูลตามเดือนและปี
  const groupJobsByMonth = (jobs) => {
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    
    const grouped = jobs.reduce((acc, job) => {
      const d = new Date(job.booking_date);
      const monthYear = `${months[d.getMonth()]} ${d.getFullYear() + 543}`;
      
      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      acc[monthYear].push(job);
      return acc;
    }, {});

    // แปลง Object เป็น Array สำหรับ SectionList
    return Object.keys(grouped).map(key => ({
      title: key,
      data: grouped[key]
    }));
  };

  const sections = groupJobsByMonth(filteredJobs);

  // แปลงวันเวลาเป็นข้อความไทย แยกเป็นวันที่ (พ.ศ.) กับเวลา
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const dayNum = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return {
      dateText: `${dayNum} ${month} ${year}`,
      timeText: `${hours}:${minutes} น.`
    };
  };

  // วาดการ์ดงาน 1 งาน: สำเร็จ = ไอคอนเขียวและยอดเงิน, ยกเลิก = ไอคอนแดงและยอด 0 ปุ่มดูรายละเอียดไปหน้า HistoryDetail
  const renderJobCard = ({ item }) => {
    const { dateText, timeText } = formatDateTime(item.booking_date);
    const isCompleted = item.status === 'completed';
    
    return (
      <View style={styles.jobCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            {isCompleted ? (
              <Ionicons name="checkmark-circle-outline" size={32} color="#27AE60" style={styles.icon} />
            ) : (
              <Ionicons name="close-circle-outline" size={32} color="#E74C3C" style={styles.icon} />
            )}
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.locationText}>{item.location}</Text>
              <Text style={styles.dateTimeText}>{dateText}    {timeText}</Text>
            </View>
          </View>
          <View>
            {/* งานที่ยกเลิกแต่ได้ค่าชดเชย แสดงเป็นยอดบวกสีเขียว */}
            <Text style={[styles.priceText, !isCompleted && !Number(item.compensation_amount) && styles.priceTextCancelled]}>
              {isCompleted
                ? `+ ${item.total_price}`
                : Number(item.compensation_amount) > 0 ? `+ ${Number(item.compensation_amount)}` : '0'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.statusText, !isCompleted && styles.statusTextCancelled]}>
            {isCompleted ? 'สำเร็จแล้ว' : 'ยกเลิก'}
          </Text>
          <TouchableOpacity 
            style={styles.detailButton}
            onPress={() => navigation.navigate('HistoryDetail', { bookingId: item.booking_id })}
          >
            <Text style={styles.detailButtonText}>ดูรายละเอียด</Text>
            <Ionicons name="chevron-forward" size={16} color="#3498DB" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // วาดแท็บกรองสถานะ (ทั้งหมด / สำเร็จแล้ว / ยกเลิก)
  const renderFilterTabs = () => {
    const tabs = [
      { id: 'all', label: 'ทั้งหมด' },
      { id: 'completed', label: 'สำเร็จแล้ว' },
      { id: 'cancelled', label: 'ยกเลิก' }
    ];

    return (
      <View style={styles.filterContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.filterTab,
              filter === tab.id && styles.filterTabActive
            ]}
            onPress={() => setFilter(tab.id)}
          >
            <Text style={[
              styles.filterTabText,
              filter === tab.id && styles.filterTabTextActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0E6643" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ประวัติการรับงาน</Text>
      </View>

      {/* Filter Tabs */}
      {renderFilterTabs()}

      {/* List */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.booking_id.toString()}
        renderItem={renderJobCard}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyText}>ไม่มีประวัติการรับงานในหมวดหมู่นี้</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2FBF4'
  },
  container: {
    flex: 1,
    backgroundColor: '#F2FBF4', // เขียวอ่อน
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0E6643',
    marginLeft: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#7F8C8D', // เทาเข้ม
    marginRight: 10,
    backgroundColor: '#F8F9F9',
  },
  filterTabActive: {
    backgroundColor: '#A7F3D0', // เขียวอ่อน
    borderColor: '#0E6643',
  },
  filterTabText: {
    fontSize: 14,
    color: '#555',
  },
  filterTabTextActive: {
    color: '#0E6643',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 16,
    color: '#555',
    marginTop: 8,
    marginBottom: 12,
  },
  jobCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  icon: {
    marginRight: 12,
  },
  locationText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  dateTimeText: {
    fontSize: 12,
    color: '#666',
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27AE60', // สีเขียว
  },
  priceTextCancelled: {
    color: '#7F8C8D', // สีเทา
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  statusTextCancelled: {
    color: '#E74C3C',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: 14,
    color: '#3498DB',
    marginRight: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
  }
});
