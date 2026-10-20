// หน้าถอนเงิน: แสดงยอดที่ถอนได้และบัญชีรับเงิน ให้กรอกจำนวน (ขั้นต่ำ 100 และไม่เกินยอดที่ถอนได้) หรือกดปุ่มลัด แล้วไปหน้าตรวจสอบ
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';

export default function WithdrawScreen({ route, navigation }) {
  const { maidData, currentWallet, availableBalance } = route.params;
  // ยอดที่ถอนได้ส่งมาจากหน้ากระเป๋าเงิน (หักยอดที่ขอถอนค้างอยู่แล้ว)
  const balance = Number(availableBalance || 0);

  const [amountStr, setAmountStr] = useState('');
  const [loading, setLoading] = useState(false);

  // คำนวณจำนวนเงินที่ถอน
  const amount = Number(amountStr.replace(/,/g, ''));
  
  // ตรวจสอบความถูกต้อง
  const isValid = amount >= 100 && amount <= balance;

  // เซนเซอร์เลขบัญชี
  const maskAccountNumber = (accNumber) => {
    if (!accNumber || accNumber === 'ไม่มีข้อมูล') return '**** ****';
    const last4 = accNumber.slice(-4);
    return `**** **** ${last4}`;
  };

  // จัดรูปแบบตัวเลขที่พิมพ์: เก็บเฉพาะตัวเลขกับจุดทศนิยม (ไม่เกิน 1 จุด) และใส่จุลภาคคั่นหลักพัน
  const formatAmount = (text) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return parts.join('.');
  };

  // ปุ่มลัดเติมจำนวนเงิน: 100 / 500 / 1,000 หรือ 'all' = ถอนทั้งหมดเท่าที่ถอนได้
  const handleQuickAmount = (val) => {
    if (val === 'all') {
      setAmountStr(formatAmount(balance.toString()));
    } else {
      setAmountStr(formatAmount(val.toString()));
    }
  };

  // ไปหน้าตรวจสอบการถอนเงิน (ยังไม่ส่งคำขอจริง) พร้อมส่งข้อมูลแม่บ้าน บัญชี และจำนวนเงินไปด้วย
  const handleWithdraw = () => {
    if (!isValid) return;
    navigation.navigate('WithdrawConfirm', {
      maidData,
      currentWallet,
      amount: amount
    });
  };

  // ฟอร์มเลื่อนดูได้ มีปุ่มดำเนินการต่อค้างอยู่ด้านล่าง ปุ่มกดได้เมื่อจำนวนเงินอยู่ในช่วงที่ถอนได้
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={28} color="#0E6643" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>ถอนเงิน</Text>
          </View>

          {/* Top Section */}
          <View style={styles.topSection}>
            <Text style={styles.balanceLabel}>ยอดเงินสะสมที่สามารถถอนได้</Text>
            <Text style={styles.balanceText}>{balance.toLocaleString()} THB</Text>
          </View>

          <View style={styles.contentPad}>
            {/* Bank Info Section */}
            <Text style={styles.sectionTitle}>โอนเงินเข้าบัญชี</Text>
            <View style={styles.bankCard}>
              <View style={styles.bankIcon}>
                <Ionicons name="card" size={24} color="#FFF" />
              </View>
              <View style={styles.bankDetails}>
                <Text style={styles.bankName}>{currentWallet?.bank_name || 'ธนาคาร'}</Text>
                <Text style={styles.accountNumber}>{maskAccountNumber(currentWallet?.account_number)}</Text>
                <Text style={styles.accountName}>{currentWallet?.account_name || 'ชื่อ-นามสกุล'}</Text>
              </View>
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark-circle-outline" size={28} color="#27AE60" />
              </View>
            </View>

            {/* Amount Section */}
            <View style={styles.amountHeader}>
              <Text style={styles.sectionTitle}>ระบุจำนวนเงิน</Text>
              <Text style={styles.minAmountText}>ขั้นต่ำ 100 บาท</Text>
            </View>

            <View style={styles.amountCard}>
              <TextInput
                style={[styles.amountInput, amount > balance && { color: '#E74C3C' }]}
                value={amountStr}
                onChangeText={(text) => setAmountStr(formatAmount(text))}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#999"
              />
              <View style={styles.inputDivider} />

              {amount > balance && (
                <Text style={{ color: '#E74C3C', fontSize: 14, textAlign: 'center', marginBottom: 16, marginTop: -12 }}>
                  ยอดเงินในวอเลทไม่เพียงพอ
                </Text>
              )}

              <View style={styles.quickButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.quickButton, { flex: 1 }, amount === 100 && styles.quickButtonActive]} 
                  onPress={() => handleQuickAmount(100)}
                >
                  <Text style={[styles.quickButtonText, amount === 100 && styles.quickButtonTextActive]}>100</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickButton, { flex: 1 }, amount === 500 && styles.quickButtonActive]} 
                  onPress={() => handleQuickAmount(500)}
                >
                  <Text style={[styles.quickButtonText, amount === 500 && styles.quickButtonTextActive]}>500</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickButton, { flex: 1 }, amount === 1000 && styles.quickButtonActive]} 
                  onPress={() => handleQuickAmount(1000)}
                >
                  <Text style={[styles.quickButtonText, amount === 1000 && styles.quickButtonTextActive]}>1,000</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickButton, { flex: 1.5 }, amount === balance && balance > 0 && styles.quickButtonActive]} 
                  onPress={() => handleQuickAmount('all')}
                >
                  <Text style={[styles.quickButtonText, amount === balance && balance > 0 && styles.quickButtonTextActive]}>ถอนทั้งหมด</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Info Message */}
            <View style={styles.infoBox}>
              <Ionicons name="alert-circle-outline" size={20} color="#BDC3C7" />
              <Text style={styles.infoText}>เงินจะเข้าบัญชีของคุณภายใน 1-2 วัน</Text>
            </View>

          </View>
        </ScrollView>
        
        {/* Footer Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.continueButton, isValid ? styles.continueButtonActive : styles.continueButtonInactive]}
            disabled={!isValid || loading}
            onPress={handleWithdraw}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.continueButtonText}>ดำเนินการต่อ</Text>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2FBF4', // เขียวอ่อน
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
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
  topSection: {
    backgroundColor: '#0E6643',
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  balanceLabel: {
    color: '#A7F3D0',
    fontSize: 16,
    marginBottom: 12,
  },
  balanceText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: 'bold',
  },
  contentPad: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 12,
  },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  bankIcon: {
    width: 40,
    height: 30,
    backgroundColor: '#0E6643',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bankDetails: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  accountNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  accountName: {
    fontSize: 14,
    color: '#888',
  },
  checkIcon: {
    marginLeft: 10,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  minAmountText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 12,
  },
  amountCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    paddingVertical: 10,
  },
  inputDivider: {
    height: 1,
    backgroundColor: '#95A5A6',
    marginBottom: 20,
    marginHorizontal: 10,
  },
  quickButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickButton: {
    borderWidth: 1,
    borderColor: '#7F8C8D',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9F9F9',
  },
  quickButtonActive: {
    borderColor: '#0E6643',
    backgroundColor: '#D5F5E3', // สีเขียวอ่อนๆ
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
  },
  quickButtonTextActive: {
    color: '#0E6643',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonActive: {
    backgroundColor: '#27AE60', // สีเขียว
  },
  continueButtonInactive: {
    backgroundColor: '#D5DBDB', // สีเทา
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
