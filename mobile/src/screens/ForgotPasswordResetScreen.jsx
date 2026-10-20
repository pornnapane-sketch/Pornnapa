// ลืมรหัสผ่านขั้นที่ 3: ตั้งรหัสผ่านใหม่ (6-12 ตัว ไม่มีช่องว่าง และกรอกซ้ำให้ตรงกัน) เสร็จแล้วกลับไปหน้า Login
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

export default function ForgotPasswordResetScreen({ route, navigation }) {
  const { email, code } = route.params;
  const { showAlert } = useAlert();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // เช็คเงื่อนไข: 6-12 ตัว, ไม่เว้นวรรค, และรหัสผ่านทั้งสองช่องตรงกัน
  const isValidPassword = (pwd) => {
    return pwd.length >= 6 && pwd.length <= 12 && !/\s/.test(pwd);
  };

  const isFormValid = isValidPassword(password) && password === confirmPassword;

  // ส่งอีเมล รหัส OTP และรหัสผ่านใหม่ไปให้ server เปลี่ยนรหัส สำเร็จแล้วแสดงป๊อบอัพและล้างประวัติหน้า กลับไปที่ Login
  const handleConfirm = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      await apiClient.post('/api/auth/reset-password', { email, code, newPassword: password });
      
      showAlert(
        'สำเร็จ',
        'รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่',
        [
          {
            text: 'ตกลง',
            onPress: () => {
              // กลับไปหน้า Login
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error(error);
      showAlert('ข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
    } finally {
      setLoading(false);
    }
  };

  // สองช่องรหัสผ่านที่กดตาเพื่อซ่อน/แสดงได้ ปุ่มยืนยันกดได้เมื่อรหัสผ่านถูกเงื่อนไขและตรงกันทั้งสองช่อง
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
            <Text style={styles.label}>ตั้งรหัสใหม่ 6-12 ตัวไม่เว้นวรรค</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder=""
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                maxLength={12}
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>ยืนยันรหัสใหม่</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder=""
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                maxLength={12}
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons 
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
            
            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={[styles.continueBtn, isFormValid ? styles.continueBtnActive : styles.continueBtnInactive]}
              disabled={!isFormValid || loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.continueBtnText}>ยืนยัน</Text>
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
    fontSize: 16,
    color: '#000',
    marginBottom: 8,
    marginTop: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 10,
  },
  continueBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
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
