// ลืมรหัสผ่านขั้นที่ 2: กรอกรหัส OTP ที่ได้รับทางอีเมล ให้ server ตรวจว่าถูกต้องและยังไม่หมดอายุ แล้วไปหน้าตั้งรหัสใหม่
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

export default function ForgotPasswordCodeScreen({ route, navigation }) {
  const { email } = route.params;
  const { showAlert } = useAlert();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // จำลองว่ารหัสผ่านต้องมี 5 ตัวขึ้นไป
  const isFormValid = code.length >= 5;

  // ส่งอีเมลกับรหัสไปตรวจที่ server ถ้าผ่านจะไปหน้า ForgotPasswordReset (ส่งรหัสไปด้วยเพื่อให้ server ตรวจซ้ำตอนตั้งรหัสใหม่)
  const handleContinue = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      await apiClient.post('/api/auth/verify-otp', { email, code });
      // ไปหน้าถัดไปเพื่อตั้งรหัสใหม่
      navigation.navigate('ForgotPasswordReset', { email, code });
    } catch (error) {
      console.error(error);
      showAlert('ข้อผิดพลาด', error.response?.data?.message || 'รหัสไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  // หัวเรื่องพร้อมปุ่มย้อนกลับ และการ์ดกรอกรหัส (ตัวเลขไม่เกิน 6 หลัก) ปุ่มกดได้เมื่อกรอกครบตามเงื่อนไข
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
            <Text style={styles.label}>รหัส</Text>
            <TextInput
              style={styles.input}
              placeholder="กรุณากรอกรหัส"
              placeholderTextColor="#999"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
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
                <Text style={styles.continueBtnText}>{isFormValid ? 'ยืนยัน' : 'ดำเนินการต่อ'}</Text>
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
    height: 400,
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
