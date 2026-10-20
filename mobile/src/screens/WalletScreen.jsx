// หน้ากระเป๋าเงิน: ยอดเงินสะสม ปุ่มถอนเงิน บัญชีรับเงิน แท็บสรุปรายได้ (วันนี้ / สัปดาห์นี้ / เดือนนี้) และรายการรับเงิน
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';

export default function WalletScreen({ route, navigation }) {
  const { maidData } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0);
  const [allTransactions, setAllTransactions] = useState([]);
  const [filter, setFilter] = useState('today'); // 'today', 'week', 'month', 'all'

  // ดึงข้อมูลกระเป๋าเงิน (ยอด บัญชี ยอดที่ขอถอนค้างอยู่) และรายการรับเงินทั้งหมดจาก server
  const fetchWallet = async () => {
    try {
      if (!maidData) return;
      const res = await apiClient.get(`/api/wallets?maid_id=${maidData.maid_id}`);
      setWallet(res.data.wallet);
      setPendingWithdrawal(res.data.pending_withdrawal || 0);
      setAllTransactions(res.data.transactions || []);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // โหลดใหม่ทุกครั้งที่กลับมาที่หน้านี้ (เช่นหลังถอนเงินหรือแก้บัญชี)
  useFocusEffect(
    useCallback(() => {
      fetchWallet();
    }, [maidData])
  );

  // ดึงจอลงเพื่อรีเฟรชข้อมูล
  const onRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  // การตั้งค่าช่วงเวลาสำหรับตัวกรอง
  // คืนช่วงเวลาเริ่ม-จบของแท็บที่เลือก: วันนี้ / สัปดาห์นี้ (เริ่มวันจันทร์) / เดือนนี้ / ทั้งหมด (ไม่จำกัดช่วงเวลา)
  const getFilterRange = (filterType) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filterType === 'today') {
      const endToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { start: today, end: endToday };
    }

    if (filterType === 'week') {
      const day = now.getDay() || 7; // ทำให้ วันจันทร์ = 1, วันอาทิตย์ = 7
      const startWeek = new Date(today.getTime() - (day - 1) * 24 * 60 * 60 * 1000);
      const endWeek = new Date(startWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      return { start: startWeek, end: endWeek };
    }

    if (filterType === 'month') {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: startMonth, end: endMonth };
    }
    
    // 'all' ไม่จำกัดช่วงเวลา
    return { start: new Date(0), end: new Date(8640000000000000) };
  };

  // กรองรายการรับเงิน (Transactions) แบบเรียลไทม์
  // คัดเฉพาะรายการรับเงินที่อยู่ในช่วงเวลาของแท็บที่เลือก แล้วสรุปรายได้รวมกับจำนวนงานจากรายการเหล่านั้น
  const { start, end } = getFilterRange(filter);
  
  const filteredTransactions = allTransactions.filter(tx => {
    const txDate = new Date(tx.created_at);
    return txDate >= start && txDate <= end;
  });

  // คำนวณรายได้และจำนวนงานตามแถบที่เลือก
  const totalIncome = filteredTransactions.reduce((sum, tx) => {
    return sum + Number(tx.amount || 0);
  }, 0);
  
  // นับเฉพาะรายการรายได้จากงาน (ค่าชดเชยไม่นับเป็นงานที่สำเร็จ)
  const totalJobs = filteredTransactions.filter(tx => tx.type === 'earning').length;

  // แปลงวันเวลาเป็นข้อความไทย เช่น 12 ต.ค. 2569 13:00 น.
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

  // วาดรายการรับเงิน 1 แถว: สถานที่ วันเวลา และจำนวนเงินที่ได้รับ
  const renderTransactionCard = ({ item }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionIconContainer}>
        <Ionicons name="cash-outline" size={20} color="#0E6643" />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionLocation}>
          {item.type === 'compensation' ? 'ค่าชดเชยการยกเลิกงาน' : (item.location || 'งานทั่วไป')}
        </Text>
        <Text style={styles.transactionDate}>{formatDateTime(item.created_at)}</Text>
      </View>
      <View>
        <Text style={styles.transactionAmount}>+ {Number(item.amount).toLocaleString()}</Text>
      </View>
    </View>
  );

  // ระหว่างโหลดครั้งแรกแสดงวงกลมหมุน
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0E6643" />
      </View>
    );
  }

  // เซนเซอร์เลขบัญชีให้เหลือแค่ 4 ตัวท้าย
  const maskAccountNumber = (accNumber) => {
    if (!accNumber || accNumber === 'ไม่มีข้อมูล') return '**** ****';
    const last4 = accNumber.slice(-4);
    return `**** ${last4}`;
  };

  // ยอดที่ถอนได้จริง = ยอดในกระเป๋า - ยอดที่ขอถอนไว้แล้วแต่ยังรอแอดมินอนุมัติ
  const walletBalance = wallet ? Number(wallet.wallet_balance) : 0;
  const availableBalance = Math.max(0, walletBalance - pendingWithdrawal);

  const currentBalance = availableBalance.toLocaleString();
  const bankName = wallet ? wallet.bank_name : 'ไม่ทราบธนาคาร';
  const accountNumber = maskAccountNumber(wallet ? wallet.account_number : '');

  // หน้าจอ: หัวเรื่อง แล้วรายการแบบเลื่อนดูที่ส่วนหัวรายการคือการ์ดยอดเงิน บัญชี แท็บสรุป และกล่องรายได้
  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>กระเป๋าเงิน</Text>
      </View>

      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.transaction_id.toString()}
        renderItem={renderTransactionCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} />}
        ListHeaderComponent={
          <View>
            {/* Main Top Section (สีเขียวเข้ม) */}
            <View style={styles.topSection}>
              <Text style={styles.balanceLabel}>ยอดเงินสะสมปัจจุบัน</Text>
              <Text style={styles.balanceText}>{currentBalance} THB</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={styles.withdrawButton}
                  onPress={() => navigation.navigate('Withdraw', { maidData, currentWallet: wallet, availableBalance })}
                >
                  <Text style={styles.withdrawButtonText}>ถอนเงิน</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.historyIconButton}
                  onPress={() => navigation.navigate('WithdrawHistory', { maidData })}
                >
                  <Ionicons name="document-text" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Account Info Card */}
            <View style={styles.accountCard}>
              <View style={styles.accountIcon}>
                <Ionicons name="card" size={24} color="#FFF" />
              </View>
              <View style={styles.accountDetails}>
                <Text style={styles.accountLabel}>บัญชี</Text>
                <Text style={styles.accountBank}>{bankName}  {accountNumber}</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('EditBankAccount', { maidData, currentWallet: wallet })}>
                <View style={styles.changeAccountBtn}>
                  <Text style={styles.changeAccountText}>เปลี่ยนบัญชี</Text>
                  <Ionicons name="chevron-forward" size={14} color="#3498DB" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterTabsContainer}>
              <TouchableOpacity 
                style={[styles.filterTab, filter === 'today' && styles.filterTabActive]} 
                onPress={() => setFilter('today')}
              >
                <Text style={[styles.filterTabText, filter === 'today' && styles.filterTabTextActive]}>วันนี้</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterTab, filter === 'week' && styles.filterTabActive]} 
                onPress={() => setFilter('week')}
              >
                <Text style={[styles.filterTabText, filter === 'week' && styles.filterTabTextActive]}>สัปดาห์นี้</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterTab, filter === 'month' && styles.filterTabActive]} 
                onPress={() => setFilter('month')}
              >
                <Text style={[styles.filterTabText, filter === 'month' && styles.filterTabTextActive]}>เดือนนี้</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
                onPress={() => setFilter('all')}
              >
                <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>ทั้งหมด</Text>
              </TouchableOpacity>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>
                  รายได้{filter === 'today' ? 'วันนี้' : filter === 'week' ? 'สัปดาห์นี้' : filter === 'month' ? 'เดือนนี้' : 'ทั้งหมด'}
                </Text>
                <Text style={styles.summaryValueText}>{totalIncome.toLocaleString()} THB</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>งานที่สำเร็จ</Text>
                <Text style={styles.summaryJobsText}>
                  <Text style={styles.summaryJobsNumber}>{totalJobs}</Text>  งาน
                </Text>
              </View>
            </View>

            <Text style={styles.transactionSectionTitle}>รายการรับเงิน</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>ไม่มีรายการ</Text>
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
    backgroundColor: '#F2FBF4' // สีเขียวอ่อนแบบในรูป
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
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
  topSection: {
    backgroundColor: '#0E6643', // สีเขียวเข้ม
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginHorizontal: -16,
  },
  balanceLabel: {
    color: '#A7F3D0', // สีเขียวอ่อนๆ สำหรับ label
    fontSize: 16,
    marginBottom: 8,
  },
  balanceText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  withdrawButton: {
    backgroundColor: '#FFF',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 24,
  },
  withdrawButtonText: {
    color: '#0E6643',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyIconButton: {
    position: 'absolute',
    right: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  accountIcon: {
    width: 40,
    height: 30,
    backgroundColor: '#0E6643',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountDetails: {
    flex: 1,
  },
  accountLabel: {
    fontSize: 12,
    color: '#777',
    marginBottom: 2,
  },
  accountBank: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  changeAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeAccountText: {
    fontSize: 12,
    color: '#3498DB',
    marginRight: 2,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#EAEAEA',
    borderRadius: 12,
    padding: 4,
    marginTop: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#FFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#000',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  summaryValueText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0E6643',
  },
  summaryJobsText: {
    fontSize: 16,
    color: '#666',
  },
  summaryJobsNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  transactionSectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000',
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9', // เขียวอ่อนมากๆ
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionLocation: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#777',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27AE60',
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
