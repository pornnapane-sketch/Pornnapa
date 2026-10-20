// ลืมรหัสผ่านขั้นที่ 1: กรอกอีเมลเพื่อให้ server ส่งรหัส OTP ไปให้ แล้วไปหน้ากรอกรหัส
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

export default function ForgotPasswordEmailScreen({ navigation }) {
  const { showAlert } = useAlert();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // ฟังก์ชันเช็ครูปแบบอีเมลง่ายๆ
  const isValidEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const isFormValid = isValidEmail(email);

  // ขอรหัส OTP จาก server สำเร็จแล้วไปหน้า ForgotPasswordCode พร้อมส่งอีเมลไปด้วย
  const handleContinue = async () => {
    if (!isFormValid) return;
    
    setLoading(true);
    try {
      const response = await apiClient.post('/api/auth/forgot-password', { email });
      showAlert('สำเร็จ', response.data.message);
      // ไปหน้าถัดไป พร้อมส่งอีเมลไปด้วย
      navigation.navigate('ForgotPasswordCode', { email });
    } catch (error) {
      console.error(error);
      showAlert('ข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถขอรหัส OTP ได้');
    } finally {
      setLoading(false);
    }
  };

  // หัวเรื่องพร้อมปุ่มย้อนกลับ และการ์ดกรอกอีเมล ปุ่มดำเนินการต่อกดได้เมื่อรูปแบบอีเมลถูกต้อง
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={32} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รีเซ็ตรหัสผ่าน</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.label}>อีเมล</Text>
            <TextInput
              style={styles.input}
              placeholder="กรุณากรอกอีเมล"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={[styles.continueBtn, isFormValid ? styles.continueBtnActive : styles.continueBtnInactive]}
              disabled={!isFormValid || loading}
              onPress={handleContinue}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.continueBtnText}>ดำเนินการต่อ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2FBF4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0E6643',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    height: 400, // ความสูงของการ์ดโดยประมาณให้คล้ายรูป
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: 18,
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  continueBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnInactive: {
    backgroundColor: '#D5DBDB',
  },
  continueBtnActive: {
    backgroundColor: '#27AE60',
  },
  continueBtnText: {
    color: '#FFF',
    fontSize: 18,
  }
});
