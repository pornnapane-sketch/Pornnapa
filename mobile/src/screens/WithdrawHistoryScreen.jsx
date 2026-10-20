// ประวัติการถอนเงิน: รายการคำขอถอนทั้งหมด กรองตามสถานะ (ทั้งหมด / กำลังดำเนินการ / สำเร็จแล้ว / ไม่สำเร็จ) ดึงจอลงเพื่อรีเฟรชได้
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';

export default function WithdrawHistoryScreen({ route, navigation }) {
  const { maidData } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected

  // ดึงรายการคำขอถอนเงินของแม่บ้านคนนี้จาก server
  const fetchWithdrawals = async () => {
    try {
      if (!maidData) return;
      const res = await apiClient.get(`/api/wallets/withdrawals?maid_id=${maidData.maid_id}`);
      setWithdrawals(res.data.withdrawals || []);
    } catch (error) {
      console.error('Error fetching withdrawal history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // โหลดรายการตอนเปิดหน้า
  useEffect(() => {
    fetchWithdrawals();
  }, [maidData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWithdrawals();
  };

  // คัดรายการตามแท็บสถานะที่เลือก
  const filteredWithdrawals = withdrawals.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  // แปลงวันเวลาเป็นข้อความไทย (ปี พ.ศ.)
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

  // แปลงสถานะของคำขอเป็นข้อความ สี และไอคอน (pending = ส้ม, approved = เขียว, rejected = แดง)
  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
        return { label: 'กำลังดำเนินการ', color: '#DCA34E', bg: '#FBE8C4', icon: 'sync-circle' };
      case 'approved':
        return { label: 'สำเร็จแล้ว', color: '#27AE60', bg: '#E8F5E9', icon: 'checkmark-circle' };
      case 'rejected':
        return { label: 'ไม่สำเร็จ', color: '#E74C3C', bg: '#FDEDEC', icon: 'close-circle' };
      default:
        return { label: 'ไม่ทราบสถานะ', color: '#666', bg: '#F2F2F2', icon: 'help-circle' };
    }
  };

  // ซ่อนเลขบัญชี แสดงเฉพาะ 4 ตัวท้าย
  const maskAccountNumber = (accNumber) => {
    if (!accNumber || accNumber === 'ไม่มีข้อมูล') return '**** ****';
    const last4 = accNumber.slice(-4);
    return `**** ${last4}`;
  };

  // วาดการ์ดคำขอถอน 1 รายการ: เวลาที่ขอ จำนวนเงิน สถานะ และบัญชีปลายทาง
  const renderWithdrawalCard = ({ item }) => {
    const config = getStatusConfig(item.status);
    return (
      <View style={[styles.card, { borderLeftColor: config.color }]}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTopLeft}>
            <Ionicons name={config.icon} size={24} color={config.color} style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.cardTitle}>ถอนเงิน</Text>
              <Text style={styles.cardDate}>{formatDateTime(item.requested_at)}</Text>
            </View>
          </View>
          <Text style={styles.cardAmount}>- {Number(item.amount).toLocaleString()} THB</Text>
        </View>

        <View style={styles.cardBottomRow}>
          <View style={[styles.statusChip, { backgroundColor: config.bg }]}>
            <Text style={[styles.statusChipText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.bankText}>
            {item.bank_name.replace('ธนาคาร', '')} {maskAccountNumber(item.bank_account_number)}
          </Text>
        </View>
      </View>
    );
  };

  // วาดแท็บกรอง 1 อัน (อันที่เลือกอยู่จะใช้สีของสถานะนั้น)
  const renderFilterTab = (tabValue, label, color, bg) => {
    const isActive = filter === tabValue;
    return (
      <TouchableOpacity 
        style={[
          styles.filterTab, 
          isActive && { borderColor: color, backgroundColor: bg }
        ]}
        onPress={() => setFilter(tabValue)}
      >
        <Text style={[styles.filterTabText, isActive && { color: color, fontWeight: 'bold' }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ประวัติการถอนเงิน</Text>
      </View>

      {/* Filter Tabs */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
          {renderFilterTab('all', 'ทั้งหมด', '#0E6643', '#E8F5E9')}
          {renderFilterTab('pending', 'กำลังดำเนินการ', '#DCA34E', '#FBE8C4')}
          {renderFilterTab('approved', 'สำเร็จแล้ว', '#27AE60', '#E8F5E9')}
          {renderFilterTab('rejected', 'ไม่สำเร็จ', '#E74C3C', '#FDEDEC')}
        </ScrollView>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0E6643" />
        </View>
      ) : (
        <FlatList
          data={filteredWithdrawals}
          keyExtractor={(item) => item.withdrawal_id.toString()}
          renderItem={renderWithdrawalCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>ไม่มีประวัติการถอนเงิน</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2FBF4'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0E6643',
    marginLeft: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F2FBF4',
    gap: 8,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#999',
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 12,
    color: '#777',
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
  },
  statusChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  bankText: {
    fontSize: 13,
    color: '#555',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
  }
});
