// แท็บบัญชี: แสดงรูปและชื่อแม่บ้าน เมนูไปโปรไฟล์ / กระเป๋าเงิน / คะแนนรีวิว / ประวัติการรับงาน และปุ่มออกจากระบบ
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableHighlight,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';
import { auth } from '../config/firebaseConfig';
import { signOut } from 'firebase/auth';
import { API_BASE_URL } from '../config/env';
import { useAlert } from '../context/AlertContext';

export default function AccountScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [maidData, setMaidData] = useState(null);
  const { showAlert } = useAlert();

  const [refreshing, setRefreshing] = useState(false);

  // ดึงข้อมูลแม่บ้านจาก server ด้วยอีเมลของผู้ที่ล็อกอินอยู่ (Firebase) เพื่อแสดงผลและส่งต่อให้หน้าอื่นผ่านค่า maidData
  const fetchMaidData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const response = await apiClient.get(`/api/members/profile?email=${currentUser.email}`);
      setMaidData(response.data);
    } catch (error) {
      console.error('Error fetching maid profile in Account:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMaidData();
  }, []);

  // ดึงจอลงเพื่อรีเฟรชข้อมูล
  const onRefresh = () => {
    setRefreshing(true);
    fetchMaidData();
  };

  // ถามยืนยันก่อนออกจากระบบ ถ้ายืนยันจะ signOut จาก Firebase แล้วกลับไปหน้า Login
  const handleLogout = async () => {
    showAlert(
      "ยืนยันการออกจากระบบ",
      "คุณต้องการออกจากระบบใช่หรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        { 
          text: "ออกจากระบบ", 
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              navigation.replace('Login');
            } catch (error) {
              console.error("Logout Error:", error);
              showAlert("ข้อผิดพลาด", "ไม่สามารถออกจากระบบได้");
            }
          }
        }
      ]
    );
  };

  // สร้างปุ่มเมนู 1 แถว (ชื่อเมนู + ลูกศร) ใช้ซ้ำกับทุกเมนู
  const renderMenuItem = (title, onPress) => (
    <TouchableOpacity style={styles.menuCard} onPress={onPress}>
      <Text style={styles.menuText}>{title}</Text>
      <Ionicons name="chevron-forward" size={24} color="#0E6643" />
    </TouchableOpacity>
  );

  // ระหว่างโหลดครั้งแรกแสดงวงกลมหมุนแทนหน้าจอ
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0E6643" />
      </View>
    );
  }

  // หน้าจอหลัก: หัวเรื่อง, การ์ดโปรไฟล์ (กดไปหน้าโปรไฟล์), เมนู 3 อัน และปุ่มออกจากระบบ ดึงจอลงเพื่อรีเฟรชได้
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>บัญชี</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} />
        }
      >
        
        {/* Profile Card */}
        <TouchableOpacity 
          style={styles.profileCard} 
          onPress={() => navigation.navigate('Profile', { maidData })}
        >
          <View style={styles.profileHeaderRow}>
            <Text style={styles.menuText}>โปรไฟล์</Text>
            <Ionicons name="chevron-forward" size={24} color="#0E6643" />
          </View>
          
          <View style={styles.profileContent}>
            {maidData && maidData.profile_pic ? (
              <Image 
                source={{ uri: `${API_BASE_URL}${maidData.profile_pic}` }} 
                style={styles.profileImage} 
              />
            ) : (
              <View style={[styles.profileImage, styles.defaultAvatar]}>
                <Text style={styles.defaultAvatarText}>
                  {maidData && maidData.first_name ? maidData.first_name.charAt(0) : '?'}
                </Text>
              </View>
            )}
            <Text style={styles.profileName}>
              {maidData ? `${maidData.title_prefix}${maidData.first_name} ${maidData.last_name}` : 'กำลังโหลด...'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Menu Items */}
        {renderMenuItem('กระเป๋าเงิน', () => navigation.navigate('Wallet', { maidData }))}
        {renderMenuItem('คะแนนรีวิว', () => navigation.navigate('Review', { maidData }))}
        {renderMenuItem('ประวัติการรับงาน', () => navigation.navigate('History', { maidData }))}

        {/* Logout Button */}
        <TouchableHighlight 
          style={styles.logoutButton} 
          onPress={handleLogout}
          underlayColor="#F5B7B1" // สีชมพูเข้มขึ้นเวลากด
        >
          <View style={styles.logoutContent}>
            <Ionicons name="log-out-outline" size={24} color="#E74C3C" style={styles.logoutIcon} />
            <Text style={styles.logoutText}>ออกจากระบบ</Text>
          </View>
        </TouchableHighlight>

      </ScrollView>
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FAF0',
  },
  container: {
    flex: 1,
    backgroundColor: '#F0FAF0',
  },
  header: {
    backgroundColor: '#0E6643',
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileContent: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eee',
    marginBottom: 12,
  },
  defaultAvatar: {
    backgroundColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  menuCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  menuText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0E6643',
  },
  logoutButton: {
    backgroundColor: '#FDEDED', // สีชมพูอ่อนๆ
    borderRadius: 12, // กลับไปใช้ทรงเดิม
    paddingVertical: 18,
    marginTop: 10,
    overflow: 'hidden',
    elevation: 1, // เพิ่มเงากลับมา
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    marginRight: 8,
    marginTop: 2, // ปรับให้ไอคอนตรงกับตัวอักษรนิดนึง
  },
  logoutText: {
    color: '#E74C3C', // ตัวอักษรสีแดง
    fontSize: 18,
    fontWeight: 'bold',
  }
});
