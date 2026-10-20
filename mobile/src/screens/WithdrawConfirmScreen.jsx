// หน้าตรวจสอบก่อนถอนเงิน: สรุปจำนวนเงินและบัญชีปลายทาง กดยืนยันเพื่อส่งคำขอถอนไปที่ server (ยอดจะถูกหักตอนแอดมินอนุมัติ)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

export default function WithdrawConfirmScreen({ route, navigation }) {
  const { maidData, currentWallet, amount } = route.params;
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);

  // ส่งคำขอถอนเงินไปที่ server สำเร็จแล้วแสดงป๊อบอัพและย้อนกลับ 2 หน้า (กลับไปหน้ากระเป๋าเงิน)
  const handleConfirm = async () => {
    setLoading(true);
    try {
      await apiClient.post('/api/wallets/withdraw', {
        maid_id: maidData.maid_id,
        amount: amount
      });
      
      showAlert('สำเร็จ', 'ส่งคำขอถอนเงินเรียบร้อยแล้ว เงินจะเข้าบัญชีของคุณภายใน 1-2 วัน', [
        { text: 'ตกลง', onPress: () => navigation.pop(2) }
      ]);
    } catch (error) {
      console.error('Error withdrawing money:', error);
      showAlert('ข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถทำรายการได้ในขณะนี้');
    } finally {
      setLoading(false);
    }
  };

  // การ์ดสรุป (จำนวนเงิน + บัญชีปลายทาง) ข้อความเตือนให้ตรวจสอบ และปุ่มถอนเงิน
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ตรวจสอบการถอนเงิน</Text>
      </View>

      <View style={styles.content}>
        {/* Main Card */}
        <View style={styles.card}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>จำนวนเงินที่ถอน</Text>
            <Text style={styles.amountValue}>{Number(amount).toLocaleString()} THB</Text>
          </View>
          
          <View style={styles.divider} />
          
          <Text style={styles.bankLabel}>โอนเงินเข้าบัญชี</Text>
          <View style={styles.bankInfoRow}>
            <View style={styles.bankIcon}>
              <Ionicons name="card" size={24} color="#FFF" />
            </View>
            <View style={styles.bankDetails}>
              <Text style={styles.accountName}>{currentWallet?.account_name || 'ชื่อ-นามสกุล'}</Text>
              <Text style={styles.bankName}>{currentWallet?.bank_name || 'ธนาคาร'}</Text>
              <Text style={styles.accountNumber}>{currentWallet?.account_number || 'ไม่มีข้อมูล'}</Text>
            </View>
          </View>
        </View>

        {/* Warning Text */}
        <View style={styles.warningContainer}>
          <Ionicons name="alert-circle-outline" size={24} color="#E74C3C" />
          <Text style={styles.warningText}>ตรวจสอบข้อมูลให้ถูกต้อง ป้องกันการทำรายการ{'\n'}ผิดพลาด</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.submitButton}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>ถอนเงิน</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2FBF4', // เขียวอ่อนมากๆ เหมือนพื้นหลังเดิม
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
    borderBottomColor: '#EEE',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0E6643',
    marginLeft: 16,
  },
  content: {
    padding: 16,
    paddingTop: 24,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  amountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0E6643',
  },
  divider: {
    height: 1,
    backgroundColor: '#CCC',
    marginVertical: 16,
  },
  bankLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 12,
  },
  bankInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankIcon: {
    width: 48,
    height: 36,
    backgroundColor: '#0E6643',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bankDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  bankName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  accountNumber: {
    fontSize: 14,
    color: '#666',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#27AE60',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
