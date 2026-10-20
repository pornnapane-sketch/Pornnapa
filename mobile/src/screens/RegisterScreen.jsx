// หน้าสมัครสมาชิก 3 ขั้น: (1) ข้อมูลส่วนตัว+อีเมล+รหัสผ่าน (2) ธนาคารและเลขบัญชี (3) ยืนยันอีเมลด้วยรหัส OTP แล้วจึงสร้างบัญชีจริงทั้งใน Firebase และฐานข้อมูล
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import apiClient from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

// รายชื่อธนาคารไทย พร้อมจำนวนหลักของเลขบัญชีที่ธนาคารนั้นใช้
const BANKS = [
  { label: 'ธนาคารกสิกรไทย (KBANK)', value: 'KBANK', accountDigits: 10 },
  { label: 'ธนาคารกรุงเทพ (BBL)', value: 'BBL', accountDigits: 10 },
  { label: 'ธนาคารไทยพาณิชย์ (SCB)', value: 'SCB', accountDigits: 10 },
  { label: 'ธนาคารกรุงไทย (KTB)', value: 'KTB', accountDigits: 10 },
  { label: 'ธนาคารกรุงศรีอยุธยา (BAY)', value: 'BAY', accountDigits: 10 },
  { label: 'ธนาคารทหารไทยธนชาต (ttb)', value: 'TTB', accountDigits: 10 },
  { label: 'ธนาคารยูโอบี (UOB)', value: 'UOB', accountDigits: 10 },
  { label: 'ธนาคารซีไอเอ็มบี ไทย (CIMBT)', value: 'CIMBT', accountDigits: 10 },
  { label: 'ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)', value: 'LHBANK', accountDigits: 10 },
  { label: 'ธนาคารไทยเครดิต (Thai Credit)', value: 'TCD', accountDigits: 10 },
  { label: 'ธนาคารอิสลามแห่งประเทศไทย (ISBT)', value: 'ISBT', accountDigits: 10 },
  { label: 'ธนาคารออมสิน (GSB)', value: 'GSB', accountDigits: 12 },
  { label: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)', value: 'BAAC', accountDigits: 12 },
  { label: 'ธนาคารอาคารสงเคราะห์ (ธอส.)', value: 'GHB', accountDigits: 12 },
];

// เนื้อหาข้อตกลงการยินยอมให้ใช้ข้อมูลส่วนบุคคล (แสดงในหน้าต่างอ่านข้อตกลงตอนสมัครสมาชิก)
const CONSENT_SECTIONS = [
  {
    title: '1. ข้อมูลที่เก็บรวบรวม',
    items: [
      'ข้อมูลระบุตัวตน: คำนำหน้า ชื่อ-นามสกุล เลขบัตรประจำตัวประชาชน เบอร์โทรศัพท์ อีเมล และรูปโปรไฟล์',
      'ข้อมูลบัญชีธนาคาร: ชื่อธนาคาร เลขบัญชี และชื่อบัญชี สำหรับโอนรายได้',
      'ข้อมูลการทำงาน: งานที่รับ เวลาเริ่มเดินทางและเริ่มงาน รูปถ่ายก่อน/หลังปฏิบัติงาน คะแนนรีวิว และรายงานปัญหา',
      'ข้อมูลตำแหน่งที่ตั้งของอุปกรณ์ขณะเดินทางไปยังสถานที่ปฏิบัติงาน',
    ],
  },
  {
    title: '2. วัตถุประสงค์การใช้ข้อมูล',
    items: [
      'ยืนยันตัวตนและบริหารบัญชีผู้ใช้งานของแม่บ้าน',
      'จับคู่งานกับลูกค้า แสดงข้อมูลการทำงาน และติดตามสถานะงาน',
      'โอนรายได้เข้าบัญชีธนาคาร และตรวจสอบความถูกต้องของการโอนเงิน',
      'ตรวจสอบข้อพิพาท การแจ้งปัญหา และป้องกันการทุจริต',
      'ปรับปรุงคุณภาพบริการและความปลอดภัยของระบบ',
    ],
  },
  {
    title: '3. การเปิดเผยข้อมูล',
    items: [
      'ลูกค้าที่จ้างงานจะเห็นชื่อ เบอร์โทรศัพท์ และรูปโปรไฟล์ของแม่บ้านที่รับงานนั้น เท่าที่จำเป็นต่อการให้บริการ',
      'ผู้ดูแลระบบจะเข้าถึงข้อมูลเพื่อตรวจสอบงาน การโอนเงิน และแก้ไขปัญหา',
      'ผู้ให้บริการที่จำเป็นต่อการทำงานของระบบ เช่น บริการยืนยันตัวตน แผนที่ และธนาคาร โดยจะไม่ขายหรือเปิดเผยข้อมูลให้บุคคลอื่นเพื่อการตลาด',
    ],
  },
  {
    title: '4. ระยะเวลาเก็บรักษา',
    items: [
      'เก็บข้อมูลตลอดระยะเวลาที่ใช้งานบัญชี และเก็บต่อเท่าที่จำเป็นตามกฎหมายหรือเพื่อการตรวจสอบข้อพิพาทหลังปิดบัญชี',
    ],
  },
  {
    title: '5. สิทธิของเจ้าของข้อมูล',
    items: [
      'ขอเข้าถึง แก้ไข ลบ หรือขอสำเนาข้อมูลส่วนบุคคลของตนเอง',
      'คัดค้านหรือจำกัดการประมวลผล และขอถอนความยินยอมได้ทุกเมื่อ ทั้งนี้การถอนความยินยอมอาจทำให้ไม่สามารถใช้งานบางบริการได้',
      'ติดต่อผู้ดูแลระบบเพื่อใช้สิทธิดังกล่าวผ่านช่องทางที่ระบุในแอปพลิเคชัน',
    ],
  },
];

// รูปแบบอีเมลที่ยอมรับ: ต้องมีตัวอักษรก่อน @ , ตัว @ , ชื่อโดเมน, จุด และส่วนท้ายโดเมน และห้ามมีช่องว่าง (ใช้กฎเดียวกับฝั่ง server)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// หน้าสมัครสมาชิก: ทำงานเป็น 3 ขั้นด้วยตัวแปร step (1 = ข้อมูลส่วนตัว, 2 = บัญชีธนาคาร, 3 = ยืนยันอีเมลด้วยรหัส OTP)
export default function RegisterScreen({ navigation }) {
  // ฟังก์ชันแสดงป๊อบอัพแจ้งผล (ใช้แจ้งข้อผิดพลาดและแจ้งสมัครสำเร็จ)
  const { showAlert } = useAlert();
  // ขั้นที่กำลังแสดงอยู่ของฟอร์ม
  const [step, setStep] = useState(1);
  
  // ===== ข้อมูลขั้นที่ 1: เก็บค่าที่ผู้ใช้พิมพ์ด้วย state (ช่องกรอกแต่ละช่องผูกกับตัวแปรเหล่านี้ผ่าน value/onChangeText) =====
  const [titlePrefix, setTitlePrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // false = ยังไม่โชว์กรอบแดง/ข้อความเตือน จะเปลี่ยนเป็น true เมื่อกดดำเนินการต่อแล้วข้อมูลไม่ผ่าน
  const [showErrors, setShowErrors] = useState(false);
  // true ระหว่างรอ server ตอบ ใช้ปิดปุ่มและแสดงวงกลมหมุน กันกดซ้ำ
  const [loading, setLoading] = useState(false);

  // Step 2 Data
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountName, setAccountName] = useState('');
  // ความยินยอมให้เก็บ/ใช้ข้อมูลส่วนบุคคล (ต้องติ๊กยินยอมก่อนจึงกดสมัครสมาชิกได้) และหน้าต่างอ่านข้อตกลง
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentModalVisible, setConsentModalVisible] = useState(false);

  // Step 3 Data (ยืนยันอีเมลด้วย OTP)
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // นับถอยหลังปุ่มส่งรหัสอีกครั้ง ลดทีละ 1 วินาทีจนเหลือ 0
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // จำนวนหลักเลขบัญชีสูงสุดตามธนาคารที่เลือก
  const selectedBank = BANKS.find((b) => b.value === bankName);
  const bankAccountMaxLength = selectedBank ? selectedBank.accountDigits : 12;

  // เลือกธนาคาร: ถ้าเลขบัญชีที่พิมพ์ไว้ยาวเกินที่ธนาคารใหม่รองรับ ให้ตัดส่วนเกินออก
  const handleSelectBank = (itemValue) => {
    setBankName(itemValue);
    const bank = BANKS.find((b) => b.value === itemValue);
    if (bank && bankAccount.length > bank.accountDigits) {
      setBankAccount(bankAccount.slice(0, bank.accountDigits));
    }
  };

  // ตรวจรูปแบบอีเมล (ตัดช่องว่างหัวท้ายก่อนตรวจ)
  const isEmailValid = EMAIL_PATTERN.test(email.trim());

  // ตรวจสอบว่ากรอกครบทุกช่องหรือยัง (ใช้ตัดสินสีปุ่ม ไม่ได้เช็ครูปแบบ)
  // ครบทุกช่อง = ปุ่มดำเนินการต่อเป็นสีเขียวและกดได้ แต่ยังไม่ได้แปลว่าข้อมูลถูกต้อง
  const isStep1Filled =
    titlePrefix !== '' &&
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    nationalId.trim() !== '' &&
    phone.trim() !== '' &&
    email.trim() !== '' &&
    password.trim() !== '' &&
    confirmPassword.trim() !== '';

  // ตรวจสอบว่าข้อมูล Step 1 ถูกต้องตามเงื่อนไขหรือไม่ (ใช้ตอนกดดำเนินการต่อ)
  // เงื่อนไข: กรอกครบ / บัตรประชาชน 13 หลัก / เบอร์ขึ้นต้น 0 ยาว 10 หลัก / อีเมลถูกรูปแบบ / รหัสผ่านกับยืนยันรหัสผ่านตรงกัน
  const isStep1Valid =
    titlePrefix !== '' &&
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    nationalId.trim().length === 13 &&
    phone.trim().startsWith('0') && phone.trim().length === 10 &&
    isEmailValid &&
    password.trim() !== '' &&
    confirmPassword.trim() !== '' &&
    password === confirmPassword;

  // ขั้นที่ 1 -> 2: ถ้าข้อมูลไม่ถูกต้องให้แสดงกรอบแดงและข้อความเตือนใต้ช่อง ถ้าถูกต้องตั้งชื่อบัญชีเริ่มต้นเป็นชื่อ-นามสกุลแล้วไปขั้นที่ 2
  const handleNext = () => {
    // ข้อมูลไม่ผ่าน: เปิดโหมดแสดงข้อผิดพลาดแล้วหยุด (ไม่ไปขั้นต่อไป)
    if (!isStep1Valid) {
      setShowErrors(true);
      return;
    }
    // ข้อมูลผ่าน: เติมชื่อบัญชีเริ่มต้นให้ในขั้นที่ 2 (ผู้ใช้แก้เองได้) แล้วเปลี่ยนไปขั้นที่ 2
    setAccountName(`${titlePrefix}${firstName} ${lastName}`);
    setStep(2);
  };

  // อีเมลที่ตัดช่องว่างหัวท้ายแล้ว ใช้กับ OTP, Firebase และฐานข้อมูลให้ตรงกันทุกที่
  const emailTrimmed = email.trim();

  // ขอรหัส OTP ไปที่อีเมล คืนค่า true ถ้าควรอยู่หน้ากรอกรหัสต่อ
  const requestOtp = async () => {
    try {
      const res = await apiClient.post('/api/auth/register-otp/send', { email: emailTrimmed });
      setResendCooldown(res.data?.retry_after || 60);
      return true;
    } catch (error) {
      // 429 = เพิ่งส่งรหัสไปแล้ว ยังใช้รหัสเดิมได้ ให้เข้าหน้ากรอกรหัสต่อ
      if (error.response?.status === 429) {
        setResendCooldown(error.response.data?.retry_after || 60);
        return true;
      }
      showAlert('ข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่อีกครั้ง');
      return false;
    }
  };

  // Step 2 -> กดสมัครสมาชิก: ส่ง OTP แล้วไปหน้ายืนยันอีเมล
  const handleRequestOtp = async () => {
    if (!bankName || !bankAccount || !accountName) {
      showAlert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลบัญชีธนาคารให้ครบถ้วน');
      return;
    }
    if (!consentAccepted) {
      showAlert('ข้อผิดพลาด', 'กรุณายินยอมข้อตกลงการใช้ข้อมูลส่วนบุคคลก่อนสมัครสมาชิก');
      return;
    }

    setLoading(true);
    const ok = await requestOtp();
    setLoading(false);
    if (ok) {
      setOtp('');
      setStep(3);
    }
  };

  // ขอรหัสใหม่ได้เมื่อครบเวลานับถอยหลังแล้วเท่านั้น
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    const ok = await requestOtp();
    setLoading(false);
    if (ok) {
      setOtp('');
      showAlert('ส่งรหัสใหม่แล้ว', `เราส่งรหัสยืนยันชุดใหม่ไปที่ ${emailTrimmed} แล้ว`);
    }
  };

  // Step 3 -> ตรวจรหัส OTP ถ้าถูกต้องค่อยสร้างบัญชีจริง
  const handleVerifyAndRegister = async () => {
    if (otp.length !== 6 || loading) return;

    setLoading(true);
    try {
      await apiClient.post('/api/auth/register-otp/verify', { email: emailTrimmed, code: otp });
    } catch (error) {
      setLoading(false);
      showAlert('ข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถตรวจสอบรหัสได้ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    await handleRegister();
  };

  // สร้างบัญชีจริง (หลังยืนยัน OTP แล้ว): สร้างผู้ใช้ใน Firebase แล้วบันทึกข้อมูลแม่บ้านและกระเป๋าเงินลงฐานข้อมูล สำเร็จแล้วไปหน้า Login และแปลงข้อผิดพลาดเป็นข้อความไทย
  const handleRegister = async () => {
    // ตรวจซ้ำว่าข้อมูลบัญชีธนาคารครบก่อนเรียกบริการสร้างบัญชี
    if (!bankName || !bankAccount || !accountName) {
      showAlert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลบัญชีธนาคารให้ครบถ้วน');
      return;
    }

    setLoading(true);

    try {
      // 1. สร้างบัญชีใน Firebase Auth (เก็บอีเมลกับรหัสผ่านสำหรับล็อกอิน ถ้าอีเมลซ้ำ/รหัสผ่านอ่อนจะ throw error ไปที่ catch)
      const userCredential = await createUserWithEmailAndPassword(auth, emailTrimmed, password);
      console.log('Firebase User Created:', userCredential.user.uid);

      // 2. บันทึกข้อมูลแม่บ้านลงฐานข้อมูลผ่าน API ของเรา (server บันทึกลงตาราง maids, maid_wallets และ users)
      // หมายเหตุ: ไม่ส่งรหัสผ่านไปเก็บที่ server รหัสผ่านอยู่ที่ Firebase เท่านั้น
      const payload = {
        title_prefix: titlePrefix,
        first_name: firstName,
        last_name: lastName,
        national_id: nationalId,
        phone: phone,
        email: emailTrimmed,
        bank_name: bankName,
        bank_account: bankAccount,
        account_name: accountName
      };
      
      await apiClient.post('/api/members/register', payload);
      
      // 3. สำเร็จทั้งสองส่วน: หยุดวงกลมหมุน แจ้งผล แล้วพาไปหน้าล็อกอิน (replace = ไม่ให้กดย้อนกลับมาหน้าสมัครอีก)
      setLoading(false);
      showAlert('สำเร็จ', 'สมัครสมาชิกเรียบร้อยแล้ว', [
        { text: 'ตกลง', onPress: () => navigation.replace('Login') }
      ]);
      
    } catch (error) {
      // ล้มเหลวที่ขั้นใดขั้นหนึ่ง: หยุดวงกลมหมุน แล้วแปลงรหัสข้อผิดพลาดเป็นข้อความไทยที่ผู้ใช้เข้าใจ
      console.log('Registration Error:', error);
      setLoading(false);
      
      let errorMsg = 'ไม่สามารถสมัครสมาชิกได้ โปรดลองใหม่อีกครั้ง';
      
      // จับ Error จาก Firebase
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'อีเมลนี้ถูกใช้งานแล้ว';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'รหัสผ่านอ่อนเกินไป';
      } 
      // จับ Error จาก API Backend
      else if (error.response && error.response.data && error.response.data.message) {
        errorMsg = error.response.data.message;
      }
      
      showAlert('ข้อผิดพลาด', errorMsg);
    }
  };

  // ฟอร์มตามขั้น: 1 = ข้อมูลส่วนตัว, 2 = ธนาคาร/เลขบัญชี, 3 = กรอกรหัส OTP โดยปุ่ม < ย้อนกลับทีละขั้น
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => {
              if (step === 3) setStep(2);
              else if (step === 2) setStep(1);
              else navigation.goBack();
            }}
          >
            <Ionicons name="chevron-back" size={32} color="#0E6643" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ลงชื่อสมัครใช้</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.cardContainer}>
            
            {step === 1 ? (
              <View>
                {/* ================= STEP 1 ================= */}
                {/* คำนำหน้า */}
                <Text style={styles.label}>คำนำหน้า</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={titlePrefix}
                    onValueChange={(itemValue) => setTitlePrefix(itemValue)}
                    style={styles.picker}
                  >
                    <Picker.Item label="คำนำหน้า" value="" color="#999" />
                    <Picker.Item label="นาง" value="นาง" />
                    <Picker.Item label="นาย" value="นาย" />
                    <Picker.Item label="นางสาว" value="นางสาว" />
                  </Picker>
                </View>

                {/* ชื่อ & นามสกุล */}
                <View style={styles.row}>
                  <View style={[styles.col, { marginRight: 10 }]}>
                    <Text style={styles.label}>ชื่อ</Text>
                    <TextInput
                      style={styles.input}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="ชื่อจริง"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>นามสกุล</Text>
                    <TextInput
                      style={styles.input}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="นามสกุล"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                <Text style={styles.label}>เลขบัตรประชาชน</Text>
                <TextInput
                  style={[styles.input, (showErrors && nationalId.trim().length !== 13) && styles.inputError]}
                  value={nationalId}
                  onChangeText={setNationalId}
                  keyboardType="number-pad"
                  placeholder="123456789"
                  placeholderTextColor="#999"
                  maxLength={13}
                />
                {showErrors && nationalId.trim().length !== 13 && (
                  <Text style={styles.errorText}>ต้องกรอกให้ครบ 13 หลัก</Text>
                )}

                <Text style={styles.label}>หมายเลขโทรศัพท์</Text>
                <TextInput
                  style={[styles.input, (showErrors && (!phone.trim().startsWith('0') || phone.trim().length !== 10)) && styles.inputError]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="0914567891"
                  placeholderTextColor="#999"
                  maxLength={10}
                />
                {showErrors && (!phone.trim().startsWith('0') || phone.trim().length !== 10) && (
                  <Text style={styles.errorText}>เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 10 หลัก</Text>
                )}

                <Text style={styles.label}>อีเมล</Text>
                {/* ช่องกรอกอีเมล: value ผูกกับ state email, onChangeText อัปเดต state ทุกครั้งที่พิมพ์ (controlled input) */}
                <TextInput
                  style={[styles.input, (showErrors && !isEmailValid) && styles.inputError]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="test@gmail.com"
                  placeholderTextColor="#999"
                />
                {showErrors && !isEmailValid && (
                  <Text style={styles.errorText}>รูปแบบอีเมลไม่ถูกต้อง เช่น name@gmail.com</Text>
                )}

                <Text style={styles.label}>รหัสผ่าน 6-12 ตัวไม่เว้นวรรค</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="*******"
                    placeholderTextColor="#999"
                    maxLength={12}
                  />
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
                <View style={[
                  styles.passwordContainer, 
                  (showErrors && password !== confirmPassword) && styles.inputError
                ]}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="*******"
                    placeholderTextColor="#999"
                    maxLength={12}
                  />
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                {showErrors && password !== confirmPassword && (
                  <Text style={styles.errorText}>รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน</Text>
                )}

                {/* ปุ่มดำเนินการต่อ */}
                <TouchableOpacity
                  style={[styles.primaryButton, !isStep1Filled && styles.disabledButton]}
                  onPress={handleNext}
                  disabled={!isStep1Filled}
                >
                  <Text style={styles.primaryButtonText}>ดำเนินการต่อ</Text>
                </TouchableOpacity>
              </View>
            ) : step === 2 ? (
              <View>
                {/* ================= STEP 2 ================= */}
                <Text style={styles.label}>ธนาคาร</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={bankName}
                    onValueChange={handleSelectBank}
                    style={styles.picker}
                  >
                    <Picker.Item label="เลือกธนาคาร" value="" color="#999" />
                    {BANKS.map((bank) => (
                      <Picker.Item key={bank.value} label={bank.label} value={bank.value} />
                    ))}
                  </Picker>
                </View>

                <Text style={styles.label}>เลขบัญชีธนาคาร</Text>
                <TextInput
                  style={styles.input}
                  value={bankAccount}
                  onChangeText={(text) => setBankAccount(text.replace(/[^0-9]/g, '').slice(0, bankAccountMaxLength))}
                  keyboardType="number-pad"
                  maxLength={bankAccountMaxLength}
                  placeholder="1547896574"
                  placeholderTextColor="#999"
                />

                <Text style={styles.label}>ชื่อบัญชี</Text>
                <TextInput
                  style={styles.input}
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="นางนวลจันทร์ ใจดี"
                  placeholderTextColor="#999"
                />

                {/* กล่องข้อความแจ้งเตือน */}
                <View style={styles.warningBox}>
                  <View style={styles.warningIcon}>
                    <Ionicons name="shield-checkmark" size={20} color="#B45309" />
                  </View>
                  <View style={styles.warningTextContainer}>
                    <Text style={styles.warningTitle}>เพื่อความปลอดภัยของรายได้</Text>
                    <Text style={styles.warningDesc}>
                      ชื่อบัญชีต้อง<Text style={styles.boldText}>ตรงกับชื่อ-นามสกุลที่ลงทะเบียนไว้ในแอปพลิเคชัน</Text> หากใช้บัญชีของผู้อื่น ระบบอาจระงับการโอนเงินเพื่อตรวจสอบ
                    </Text>
                  </View>
                </View>

                {/* ความยินยอมข้อมูลส่วนบุคคล: ไม่ติ๊ก = ไม่ยินยอม ปุ่มสมัครสมาชิกจะเป็นสีเทาและกดไม่ได้ */}
                <View style={styles.consentRow}>
                  <TouchableOpacity
                    style={styles.consentCheckArea}
                    activeOpacity={0.7}
                    onPress={() => setConsentAccepted(!consentAccepted)}
                  >
                    <View style={[styles.consentCheckbox, consentAccepted && styles.consentCheckboxChecked]}>
                      {consentAccepted ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.consentText}>
                    ข้าพเจ้าได้อ่านและยินยอมตาม{' '}
                    <Text style={styles.consentLink} onPress={() => setConsentModalVisible(true)}>
                      ข้อตกลงการยินยอมให้ใช้ข้อมูลส่วนบุคคล
                    </Text>
                  </Text>
                </View>

                {/* ปุ่มสมัครสมาชิก */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!bankName || !bankAccount || !accountName || !consentAccepted) && styles.disabledButton
                  ]}
                  onPress={handleRequestOtp}
                  disabled={!bankName || !bankAccount || !accountName || !consentAccepted || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>สมัครสมาชิก</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {/* ================= STEP 3 ================= */}
                <View style={styles.otpIconCircle}>
                  <Ionicons name="mail-outline" size={36} color="#0E6643" />
                </View>
                <Text style={styles.otpTitle}>ยืนยันอีเมลของคุณ</Text>
                <Text style={styles.otpDesc}>
                  เราส่งรหัสยืนยัน 6 หลักไปที่{'\n'}
                  <Text style={styles.boldText}>{emailTrimmed}</Text>
                  {'\n'}กรุณากรอกรหัสเพื่อสมัครสมาชิก (รหัสมีอายุ 10 นาที)
                </Text>

                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="------"
                  placeholderTextColor="#CCC"
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.primaryButton, otp.length !== 6 && styles.disabledButton]}
                  onPress={handleVerifyAndRegister}
                  disabled={otp.length !== 6 || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>ยืนยันและสมัครสมาชิก</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                >
                  <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextDisabled]}>
                    {resendCooldown > 0 ? `ส่งรหัสอีกครั้งได้ใน ${resendCooldown} วินาที` : 'ส่งรหัสอีกครั้ง'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* หน้าต่างข้อตกลงการยินยอมให้ใช้ข้อมูลส่วนบุคคล: กดยินยอมในนี้จะติ๊กให้อัตโนมัติ */}
      <Modal
        visible={consentModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setConsentModalVisible(false)}
      >
        <View style={styles.consentOverlay}>
          <View style={styles.consentSheet}>
            <Text style={styles.consentSheetTitle}>ข้อตกลงการยินยอมให้ใช้ข้อมูลส่วนบุคคล</Text>
            <ScrollView style={styles.consentScroll} showsVerticalScrollIndicator>
              {CONSENT_SECTIONS.map((section) => (
                <View key={section.title} style={styles.consentSection}>
                  <Text style={styles.consentSectionTitle}>{section.title}</Text>
                  {section.items.map((item) => (
                    <Text key={item} style={styles.consentSectionItem}>• {item}</Text>
                  ))}
                </View>
              ))}
            </ScrollView>
            <View style={styles.consentButtons}>
              <TouchableOpacity style={styles.consentCloseBtn} onPress={() => setConsentModalVisible(false)}>
                <Text style={styles.consentCloseText}>ปิด</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.consentAcceptBtn}
                onPress={() => { setConsentAccepted(true); setConsentModalVisible(false); }}
              >
                <Text style={styles.consentAcceptText}>ยินยอม</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2FBF4', // พื้นหลังเขียวอ่อน
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    elevation: 2, // เงา Android
    shadowColor: '#000', // เงา iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0E6643',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  cardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB', // สีเทาอ่อนๆ ในช่อง
    borderWidth: 1,
    borderColor: '#D1D5DB', // ขอบสีเทา
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 58, // สูงเท่าช่องเลือก (Picker) ทุกช่องในฟอร์ม
    fontSize: 16,
    marginBottom: 16,
    color: '#333',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 16,
    marginLeft: 4,
  },
  inputError: {
    borderColor: '#E74C3C', // กรอบสีแดงเมื่อมี Error
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginBottom: 16,
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
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    // สูงพอให้สระและวรรณยุกต์ภาษาไทยไม่ถูกตัด (เช่น "กรุงไทย")
    height: 58,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#20A855', // สีเขียว
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  disabledButton: {
    backgroundColor: '#D1D5DB', // สีเทาเมื่อกดไม่ได้
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  otpIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  otpTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0E6643',
    textAlign: 'center',
    marginBottom: 8,
  },
  otpDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  otpInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 10,
    textAlign: 'center',
    color: '#333',
    marginBottom: 16,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    color: '#3498DB',
  },
  resendTextDisabled: {
    color: '#999',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  warningIcon: {
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  warningDesc: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: 'bold',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 6,
  },
  consentCheckArea: {
    paddingRight: 10,
    paddingVertical: 2,
  },
  consentCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentCheckboxChecked: {
    backgroundColor: '#20A855',
    borderColor: '#20A855',
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  consentLink: {
    color: '#0E6643',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  consentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  consentSheet: {
    maxHeight: '85%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  consentSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0E6643',
    textAlign: 'center',
    marginBottom: 12,
  },
  consentScroll: {
    marginBottom: 12,
  },
  consentSection: {
    marginBottom: 14,
  },
  consentSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  consentSectionItem: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    paddingLeft: 6,
  },
  consentButtons: {
    flexDirection: 'row',
  },
  consentCloseBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    marginRight: 8,
  },
  consentCloseText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  consentAcceptBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#20A855',
    alignItems: 'center',
    marginLeft: 8,
  },
  consentAcceptText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  }
});
