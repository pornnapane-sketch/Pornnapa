// หน้าแก้ไขบัญชีรับเงิน: เลือกธนาคาร กรอกเลขบัญชีและชื่อบัญชี ปุ่มบันทึกกดได้เมื่อมีการเปลี่ยนแปลงและกรอกครบ
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

export default function EditBankAccountScreen({ route, navigation }) {
  const { maidData, currentWallet } = route.params;
  const { showAlert } = useAlert();

  // ข้อมูลเดิม
  const initialBank = currentWallet?.bank_name || 'ธนาคารกรุงไทย';
  const initialAccount = currentWallet?.account_number || '';
  const initialName = currentWallet?.account_name || '';

  const [bankName, setBankName] = useState(initialBank);
  const [accountNumber, setAccountNumber] = useState(initialAccount);
  const [accountName, setAccountName] = useState(initialName);
  
  const [isChanged, setIsChanged] = useState(false);
  const [loading, setLoading] = useState(false);

  // รายชื่อธนาคาร
  const banks = [
    'ธนาคารกรุงไทย',
    'ธนาคารกรุงเทพ',
    'ธนาคารกสิกรไทย',
    'ธนาคารไทยพาณิชย์',
    'ธนาคารกรุงศรีอยุธยา',
    'ธนาคารทหารไทยธนชาต',
    'ธนาคารออมสิน'
  ];

  // เซนเซอร์เลขบัญชีเดิม
  const maskAccountNumber = (accNumber) => {
    if (!accNumber || accNumber === 'ไม่มีข้อมูล') return '**** ****';
    const last4 = accNumber.slice(-4);
    return `**** ${last4}`;
  };

  useEffect(() => {
    // ตรวจสอบว่ามีการเปลี่ยนแปลงข้อมูลหรือไม่
    if (
      bankName !== initialBank ||
      accountNumber !== initialAccount ||
      accountName !== initialName
    ) {
      // ต้องกรอกให้ครบถึงจะให้กดได้
      if (bankName && accountNumber && accountName) {
        setIsChanged(true);
      } else {
        setIsChanged(false);
      }
    } else {
      setIsChanged(false);
    }
  }, [bankName, accountNumber, accountName]);

  // บันทึกบัญชีรับเงินใหม่ที่ server (ถ้ายังไม่มีกระเป๋าเงินจะสร้างให้) สำเร็จแล้วแสดงป๊อบอัพและกลับหน้ากระเป๋าเงิน
  const handleSave = async () => {
    if (!isChanged) return;
    
    setLoading(true);
    try {
      await apiClient.put('/api/wallets/account', {
        maid_id: maidData.maid_id,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName
      });
      
      showAlert('สำเร็จ', 'อัปเดตข้อมูลบัญชีรับเงินเรียบร้อยแล้ว', [
        { text: 'ตกลง', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error updating bank account:', error);
      showAlert('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  // ฟอร์มเลือกธนาคาร + เลขบัญชี + ชื่อบัญชี พร้อมข้อความเตือนว่าชื่อต้องตรงกับชื่อที่ลงทะเบียน และปุ่มบันทึก
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={32} color="#0E6643" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>บัญชีรับเงิน</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Current Account Card */}
          <View style={styles.currentAccountCard}>
            <View style={styles.bankIcon}>
              <Ionicons name="card" size={24} color="#FFF" />
            </View>
            <View>
              <Text style={styles.currentAccountLabel}>บัญชีปัจจุบัน</Text>
              <Text style={styles.currentAccountText}>
                {initialBank.replace('ธนาคาร', '')} {maskAccountNumber(initialAccount)}
              </Text>
            </View>
          </View>

          {/* Edit Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>ระบุบัญชีใหม่</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>ธนาคาร</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={bankName}
                  onValueChange={(itemValue) => setBankName(itemValue)}
                  style={styles.picker}
                  dropdownIconColor="#333"
                >
                  {banks.map((bank, index) => (
                    <Picker.Item key={index} label={bank} value={bank} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>เลขบัญชีธนาคาร</Text>
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
                placeholder="1234567890"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>ชื่อบัญชี</Text>
              <TextInput
                style={styles.input}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="ชื่อ-นามสกุล"
              />
            </View>
          </View>

          {/* Warning Box */}
          <View style={styles.warningBox}>
            <View style={styles.warningIconContainer}>
              <Ionicons name="shield-checkmark" size={20} color="#B45309" />
            </View>
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>เพื่อความปลอดภัยของรายได้</Text>
              <Text style={styles.warningSubtitle}>
                ชื่อบัญชีต้อง<Text style={styles.warningBold}>ตรงกับชื่อ-นามสกุลที่ลงทะเบียนไว้ในแอปพลิเคชัน</Text> หากใช้บัญชีของผู้อื่น ระบบอาจระงับการโอนเงินเพื่อตรวจสอบ
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity 
            style={[styles.saveButton, isChanged ? styles.saveButtonActive : styles.saveButtonInactive]}
            disabled={!isChanged || loading}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>บันทึกบัญชีใหม่</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2FBF4', // พื้นหลังเขียวอ่อน
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0E6643',
  },
  currentAccountCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  bankIcon: {
    width: 48,
    height: 32,
    backgroundColor: '#0E6643',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  currentAccountLabel: {
    fontSize: 14,
    color: '#777',
    marginBottom: 4,
  },
  currentAccountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  formCard: {
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
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    // สูงพอให้สระและวรรณยุกต์ภาษาไทยไม่ถูกตัด (เช่น "กรุงไทย")
    height: 58,
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 58, // สูงเท่าช่องเลือกธนาคาร
    fontSize: 16,
    color: '#000',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB', // สีเหลืองอำพันอ่อน
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 30,
  },
  warningIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#92400E', // สีน้ำตาลอำพัน
    marginBottom: 4,
  },
  warningSubtitle: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 21,
  },
  warningBold: {
    fontWeight: 'bold',
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonActive: {
    backgroundColor: '#27AE60', // สีเขียว
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  saveButtonInactive: {
    backgroundColor: '#BDC3C7', // สีเทา
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
