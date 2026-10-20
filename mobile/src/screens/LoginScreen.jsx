// หน้าเข้าสู่ระบบ: ล็อกอินด้วยอีเมล/รหัสผ่านผ่าน Firebase แล้วไปหน้า Home มีลิงก์ไปลืมรหัสผ่านและสมัครสมาชิก
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// เราใช้ Ionicons สำหรับทำรูปดวงตาปิดเปิดรหัสผ่าน
import { Ionicons } from '@expo/vector-icons'; 
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { useAlert } from '../context/AlertContext';

export default function LoginScreen({ navigation }) {
  const { showAlert } = useAlert();
  // สร้าง State สำหรับเก็บข้อมูลอีเมลและรหัสผ่าน
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);

  // ตรวจสอบว่ากรอกข้อมูลครบหรือยัง
  const isFormValid = email.trim() !== '' && password.trim() !== '';

  // ฟังก์ชันเมื่อกดปุ่มเข้าสู่ระบบ
  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('แจ้งเตือน', 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      return;
    }

    try {
      // เรียกใช้ Firebase เพื่อยืนยันการเข้าสู่ระบบ
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('ล็อกอินสำเร็จ! User ID:', userCredential.user.uid);
      
      // เมื่อสำเร็จให้เปลี่ยนไปหน้า Home
      navigation.replace('Home');
    } catch (error) {
      console.log('Login Error:', error.message);
      setLoginFailed(true);
      showAlert('ข้อผิดพลาด', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  // ฟอร์มกลางจอ (KeyboardAvoidingView ดันฟอร์มขึ้นเมื่อแป้นพิมพ์เปิด) ปุ่มเข้าสู่ระบบกดได้เมื่อกรอกอีเมลและรหัสผ่านครบ
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.innerContainer}>
          
          {/* ส่วนหัว Logo / Title */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>KU CSC Maid</Text>
            <Text style={styles.subtitle}>ระบบแม่บ้าน มก. ฉกส.</Text>
          </View>

          {/* ส่วนช่องกรอกข้อมูลฟอร์ม */}
          <View style={styles.formContainer}>
            
            {/* กล่องข้อความแจ้งเตือน Error */}
            {loginFailed && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={20} color="#E74C3C" style={styles.errorBoxIcon} />
                <Text style={styles.errorBoxText}>กรอกอีเมลหรือรหัสผ่านผิดพลาด</Text>
              </View>
            )}

            {/* ช่องกรอกอีเมล */}
            <Text style={styles.label}>
              อีเมล <Text style={styles.asterisk}></Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="กรอกอีเมล"
              placeholderTextColor="#999"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setLoginFailed(false);
              }}
              keyboardType="email-address"
              autoCapitalize="none" // ป้องกันไม่ให้ตัวอักษรแรกเป็นพิมพ์ใหญ่ตอนพิมพ์อีเมล
            />

            {/* ช่องกรอกรหัสผ่าน */}
            <Text style={styles.label}>
              รหัสผ่าน <Text style={styles.asterisk}></Text>
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="กรอกรหัสผ่าน"
                placeholderTextColor="#999"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setLoginFailed(false);
                }}
                secureTextEntry={!showPassword} // ซ่อน/แสดง รหัสผ่าน
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setShowPassword(!showPassword)}
              >
                {/* ไอคอนดวงตา */}
                <Ionicons 
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>

            {/* ลิงก์ลืมรหัสผ่าน */}
            <TouchableOpacity 
              style={styles.forgotPasswordContainer}
              onPress={() => navigation.navigate('ForgotPasswordEmail')}
            >
              <Text style={styles.forgotPasswordText}>ลืมรหัสผ่าน</Text>
            </TouchableOpacity>

            {/* ปุ่มเข้าสู่ระบบ */}
            <TouchableOpacity 
              style={[styles.loginButton, !isFormValid && styles.loginButtonDisabled]} 
              onPress={handleLogin}
              disabled={!isFormValid}
            >
              <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
            </TouchableOpacity>

            {/* ส่วนสมัครสมาชิกด้านล่าง */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>ยังไม่มีบัญชี? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>สมัครสมาชิกที่นี่</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ส่วนสำหรับตกแต่งหน้าตา (CSS-like)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2FBF4', // สีพื้นหลังเขียวอ่อนตามรูปภาพเป๊ะๆ
  },
  keyboardView: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0E6643', // สีเขียวเข้มสำหรับชื่อแอป
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  asterisk: {
    color: '#E74C3C', // สีแดงสำหรับดอกจัน *
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 10,
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: '#0E6643',
    fontWeight: 'bold',
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEDEC',
    borderWidth: 1,
    borderColor: '#F5B7B1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorBoxIcon: {
    marginRight: 8,
  },
  errorBoxText: {
    color: '#E74C3C',
    fontSize: 14,
    flex: 1,
  },
  loginButton: {
    backgroundColor: '#20A855', // สีเขียวสดสำหรับปุ่มเข้าสู่ระบบ
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#D1D5DB', // สีเทาเมื่อปุ่มยังกดไม่ได้
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerText: {
    color: '#555',
    fontSize: 14,
  },
  registerLink: {
    color: '#0E6643',
    fontWeight: 'bold',
    fontSize: 14,
  }
});