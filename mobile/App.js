// (บรรทัดคอมเมนต์ด้านล่างเป็นโค้ดตัวอย่างเริ่มต้นของ Expo ที่ไม่ได้ใช้แล้ว)
// import { StatusBar } from 'expo-status-bar';
// import { StyleSheet, Text, View } from 'react-native';

// export default function App() {
//   return (
//     <View style={styles.container}>
//       <Text>Open up App.js to start working on your app!</Text>
//       <StatusBar style="auto" />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#fff',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
// });
// ไฟล์หลักของแอป: กำหนดการเปลี่ยนหน้า (navigation) ของทุกหน้าจอ
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AlertProvider } from './src/context/AlertContext';

import LoginScreen from './src/screens/LoginScreen'; 
import MainTabScreen from './src/screens/MainTabScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditNameScreen from './src/screens/EditNameScreen';
import EditPhoneScreen from './src/screens/EditPhoneScreen';
import EditSpecialtyScreen from './src/screens/EditSpecialtyScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import WalletScreen from './src/screens/WalletScreen';
import EditBankAccountScreen from './src/screens/EditBankAccountScreen';
import WithdrawScreen from './src/screens/WithdrawScreen';
import ForgotPasswordEmailScreen from './src/screens/ForgotPasswordEmailScreen';
import ForgotPasswordCodeScreen from './src/screens/ForgotPasswordCodeScreen';
import ForgotPasswordResetScreen from './src/screens/ForgotPasswordResetScreen';
import NewJobDetailScreen from './src/screens/NewJobDetailScreen';
import AcceptedJobDetailScreen from './src/screens/AcceptedJobDetailScreen';
import TravelMapScreen from './src/screens/TravelMapScreen';
import ContactEmployerScreen from './src/screens/ContactEmployerScreen';
import WorkReportBeforeScreen from './src/screens/WorkReportBeforeScreen';
import WorkReportAfterScreen from './src/screens/WorkReportAfterScreen';
import HistoryDetailScreen from './src/screens/HistoryDetailScreen';
import ReportProblemScreen from './src/screens/ReportProblemScreen';
import ReportProblemEvidenceScreen from './src/screens/ReportProblemEvidenceScreen';
import ReportProblemWaitScreen from './src/screens/ReportProblemWaitScreen';
import WithdrawHistoryScreen from './src/screens/WithdrawHistoryScreen';
import WithdrawConfirmScreen from './src/screens/WithdrawConfirmScreen';
// Stack navigator: หน้าใหม่จะซ้อนทับหน้าเดิม และกดย้อนกลับเพื่อกลับไปหน้าก่อนหน้า
const Stack = createNativeStackNavigator();

// ครอบแอปด้วย AlertProvider (ให้ทุกหน้าเรียกป๊อบอัพได้) และ NavigationContainer แล้วลงทะเบียนทุกหน้าจอ โดยเริ่มที่หน้า Login
export default function App() {
  return (
    <AlertProvider>
      <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        
        {/* กลุ่มเข้าสู่ระบบ / สมัครสมาชิก */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }} 
        />

        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }} 
        />
        
        {/* หน้าหลักหลังล็อกอิน: เมนูแท็บ 4 อัน (หน้าหลัก / งานใหม่ / ตารางงาน / บัญชี) อยู่ใน MainTabScreen */}
        <Stack.Screen
          name="Home"
          component={MainTabScreen}
          options={{ headerShown: false }} 
        />
        
        {/* กลุ่มโปรไฟล์: ดูและแก้ไขข้อมูลส่วนตัว (ชื่อ / เบอร์โทร / ทักษะ) */}
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ 
            title: 'โปรไฟล์',
            headerTintColor: '#0E6643', // สีเขียวตามในดีไซน์
            headerTitleStyle: { fontWeight: 'bold' }
          }}
        />
        <Stack.Screen
          name="EditName"
          component={EditNameScreen}
          options={{ 
            title: 'ชื่อ-นามสกุล',
            headerTintColor: '#0E6643', // สีเขียวเหมือนในแบบ
            headerTitleStyle: { fontWeight: 'bold' }
          }}
        />
        <Stack.Screen
          name="EditPhone"
          component={EditPhoneScreen}
          options={{ 
            title: 'หมายเลขโทรศัพท์',
            headerTintColor: '#0E6643',
            headerTitleStyle: { fontWeight: 'bold' }
          }}
        />
        <Stack.Screen
          name="EditSpecialty"
          component={EditSpecialtyScreen}
          options={{ 
            title: 'ทักษะความชำนาญพิเศษ',
            headerTintColor: '#0E6643',
            headerTitleStyle: { fontWeight: 'bold' }
          }}
        />
        {/* คะแนนรีวิว */}
        <Stack.Screen
          name="Review"
          component={ReviewScreen}
          options={{ headerShown: false }} 
        />
        {/* ประวัติการรับงานและรายละเอียดงานในประวัติ */}
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="HistoryDetail"
          component={HistoryDetailScreen}
          options={{ headerShown: false }} 
        />
        {/* กลุ่มการเงิน: กระเป๋าเงิน, แก้บัญชีรับเงิน, ถอนเงิน (กรอก -> ตรวจสอบ) และประวัติการถอน */}
        <Stack.Screen
          name="Wallet"
          component={WalletScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="EditBankAccount"
          component={EditBankAccountScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="Withdraw"
          component={WithdrawScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="WithdrawConfirm"
          component={WithdrawConfirmScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="WithdrawHistory"
          component={WithdrawHistoryScreen}
          options={{ headerShown: false }} 
        />
        {/* กลุ่มลืมรหัสผ่าน: กรอกอีเมล -> กรอกรหัส OTP -> ตั้งรหัสผ่านใหม่ */}
        <Stack.Screen
          name="ForgotPasswordEmail"
          component={ForgotPasswordEmailScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="ForgotPasswordCode"
          component={ForgotPasswordCodeScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="ForgotPasswordReset"
          component={ForgotPasswordResetScreen}
          options={{ headerShown: false }} 
        />
        {/* กลุ่มทำงานจริง: ดูงานใหม่ -> งานที่รับแล้ว -> เดินทาง (แผนที่/โทรหาผู้ว่าจ้าง) -> รายงานก่อนทำงาน -> รายงานหลังทำงาน */}
        <Stack.Screen
          name="NewJobDetail"
          component={NewJobDetailScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="AcceptedJobDetail"
          component={AcceptedJobDetailScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="TravelMap"
          component={TravelMapScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="ContactEmployer"
          component={ContactEmployerScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="WorkReportBefore"
          component={WorkReportBeforeScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="WorkReportAfter"
          component={WorkReportAfterScreen}
          options={{ headerShown: false }} 
        />
        {/* กลุ่มแจ้งปัญหาระหว่างงาน: เลือกเหตุผล -> แนบรูปหลักฐาน -> รอระบบตรวจสอบ */}
        <Stack.Screen
          name="ReportProblem"
          component={ReportProblemScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="ReportProblemEvidence"
          component={ReportProblemEvidenceScreen}
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="ReportProblemWait"
          component={ReportProblemWaitScreen}
          options={{ headerShown: false }} 
        />
      </Stack.Navigator>
      </NavigationContainer>
    </AlertProvider>
  );
}

