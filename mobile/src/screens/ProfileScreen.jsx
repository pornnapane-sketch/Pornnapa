// หน้าโปรไฟล์: แสดงรูปและข้อมูลส่วนตัว (ชื่อ / เบอร์ / ทักษะ) กดแต่ละรายการเพื่อไปหน้าแก้ไข และเปลี่ยนรูปประจำตัวได้
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api/apiClient';
import { API_BASE_URL } from '../config/env';
import { useAlert } from '../context/AlertContext';

export default function ProfileScreen({ route, navigation }) {
  const { showAlert } = useAlert();
  // รับข้อมูล maidData ที่ส่งมาจากหน้า Account
  const [maidData, setMaidData] = useState(route.params.maidData);
  
  // รูปโปรไฟล์ที่แสดงบนหน้าจอ: ถ้าในฐานข้อมูลมีพาธรูปอยู่แล้วให้ต่อกับที่อยู่ server เป็น URL เต็ม ถ้าไม่มีเป็น null (แสดงไอคอนแทน)
  const [profilePic, setProfilePic] = useState(
    maidData.profile_pic ? `${API_BASE_URL}${maidData.profile_pic}` : null
  );
  // true ระหว่างอัปโหลดรูป ใช้แสดงวงกลมหมุนและกันกดซ้ำ
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ขั้นที่ 1 ของการเปลี่ยนรูปโปรไฟล์: ขอสิทธิ์ -> เปิดคลังรูปให้เลือกและครอป -> ส่งรูปที่เลือกไปอัปโหลด
  const pickImage = async () => {
    // 1.1 ขออนุญาตเข้าถึงรูปภาพในเครื่อง (ระบบจะขึ้นหน้าต่างถามผู้ใช้ รอจนกดตอบ)
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    // ผู้ใช้ไม่อนุญาต: แจ้งเหตุผลแล้วหยุด ไม่เปิดคลังรูป
    if (permissionResult.granted === false) {
      showAlert('แจ้งเตือน', 'แอปจำเป็นต้องเข้าถึงรูปภาพของคุณเพื่อเปลี่ยนรูปประจำตัว');
      return;
    }

    // 1.2 เปิดแกลลอรี่ให้เลือกรูป (เฉพาะรูปภาพ) แล้วรอจนผู้ใช้เลือก/ครอปเสร็จหรือกดยกเลิก
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // อนุญาตให้ครอปรูป
      aspect: [1, 1], // บังคับสัดส่วนเป็น 1:1
      quality: 0.5, // ลดขนาดรูปลงมาหน่อยเพื่อให้โหลดไวขึ้น
    });

    // 1.3 ถ้าผู้ใช้ไม่ได้กดยกเลิกและมีรูปที่เลือกจริง ให้เอาที่อยู่ไฟล์รูปแรกไปอัปโหลด (กดยกเลิกก็ไม่ทำอะไร)
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedImageUri = result.assets[0].uri;
      uploadProfilePicture(selectedImageUri);
    }
  };

  // ขั้นที่ 2: ส่งรูปที่เลือกขึ้น server (แบบแนบไฟล์) แล้วเปลี่ยนรูปบนหน้าจอเมื่อสำเร็จ
  const uploadProfilePicture = async (uri) => {
    // เปิดสถานะกำลังอัปโหลด
    setUploading(true);
    try {
      // 2.1 ตัดชื่อไฟล์จากท้ายที่อยู่ไฟล์ แล้วดึงนามสกุลมาสร้างชนิดไฟล์ (เช่น image/jpg) ให้ server รู้ว่าเป็นรูป
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      // 2.2 ประกอบข้อมูลแบบ FormData ซึ่งส่งไฟล์ไป server ได้ (ชื่อฟิลด์ profile_pic ต้องตรงกับที่ server รอรับ)
      const formData = new FormData();
      formData.append('profile_pic', {
        uri: uri,
        name: filename,
        type: type,
      });
      formData.append('email', maidData.email); // ส่งอีเมลไปเพื่อใช้อ้างอิงว่าเป็นของใคร

      // 2.3 ส่งไป server แล้วรอผล (server บันทึกไฟล์ลงโฟลเดอร์ uploads และอัปเดตพาธรูปในฐานข้อมูล)
      const response = await apiClient.post('/api/members/profile-pic', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // 2.4 ถ้าสำเร็จให้เปลี่ยนรูปที่แสดงผลบนหน้าจอ (server ตอบพาธรูปใหม่กลับมา) แล้วแจ้งผู้ใช้
      if (response.data && response.data.profile_pic) {
        setProfilePic(`${API_BASE_URL}${response.data.profile_pic}`);
        showAlert('สำเร็จ', 'เปลี่ยนรูปประจำตัวเรียบร้อยแล้ว');
      }

    } catch (error) {
      // ล้มเหลว (เน็ตหลุด ไฟล์ใหญ่เกินเวลา server มีปัญหา ฯลฯ): บันทึกสาเหตุไว้ดูตอนพัฒนา และแจ้งผู้ใช้
      console.error('Upload Error:', error);
      showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถอัปโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      // ทำงานเสมอไม่ว่าสำเร็จหรือล้มเหลว: ปิดสถานะกำลังอัปโหลด
      setUploading(false);
    }
  };

  // ดึงข้อมูลโปรไฟล์ล่าสุดจาก server มาแสดง (เรียกตอนดึงจอลง และตอนกลับมาจากหน้าแก้ไข)
  const fetchUpdatedProfile = async () => {
    try {
      const response = await apiClient.get(`/api/members/profile?email=${maidData.email}`);
      setMaidData(response.data);
      // อย่าลืมให้ AccountScreen อัปเดตด้วยถ้าจำเป็น (อาจจะต้องรีโหลดหน้า Account เมื่อกลับไป)
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUpdatedProfile();
  };

  // โหลดข้อมูลโปรไฟล์ใหม่ทุกครั้งที่กลับมาที่หน้านี้ (เช่น หลังแก้ไขชื่อ/เบอร์/ทักษะ)
  useFocusEffect(
    useCallback(() => {
      fetchUpdatedProfile();
    }, [maidData.email])
  );

  // สร้างแถวข้อมูล 1 รายการ (หัวข้อ + ค่า + ลูกศร) กดแล้วไปหน้าแก้ไขที่เกี่ยวข้อง
  const renderInfoItem = (label, value, onPress) => (
    <TouchableOpacity style={styles.infoCard} onPress={onPress} disabled={!onPress}>
      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '-'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#0E6643" style={styles.chevronIcon} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} />
        }
      >
      {/* 
        ส่วน Header ด้านบน เราอาจจะใช้ของ Stack Navigator เลยก็ได้
        แต่เพื่อความชัวร์ ให้แสดงเนื้อหาหลักตรงนี้ 
      */}
      <View style={styles.innerContainer}>
        
        {/* รูปประจำตัวและปุ่มเปลี่ยนรูป */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={pickImage} disabled={uploading}>
            <View style={styles.imageContainer}>
              {profilePic ? (
                <Image 
                  source={{ uri: profilePic }} 
                  style={styles.profileImage} 
                />
              ) : (
                <View style={[styles.profileImage, styles.defaultAvatar]}>
                  <Text style={styles.defaultAvatarText}>
                    {maidData.first_name ? maidData.first_name.charAt(0) : '?'}
                  </Text>
                </View>
              )}
              {uploading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color="#FFF" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={pickImage} disabled={uploading}>
            <Text style={styles.changePicText}>เปลี่ยนรูปประจำตัว</Text>
          </TouchableOpacity>
        </View>

        {/* ข้อมูลส่วนตัว */}
        <View style={styles.infoSection}>
          {renderInfoItem(
            'ชื่อ-นามสกุล', 
            `${maidData.title_prefix || ''}${maidData.first_name || ''} ${maidData.last_name || ''}`,
            () => navigation.navigate('EditName', { maidData })
          )}
          {renderInfoItem(
            'หมายเลขโทรศัพท์',
            maidData.phone,
            () => navigation.navigate('EditPhone', { maidData })
          )}
          {renderInfoItem(
            'ทักษะความชำนาญพิเศษ',
            maidData.specialty ? maidData.specialty.split(',').join(', ') : '-',
            () => navigation.navigate('EditSpecialty', { maidData })
          )} 
        </View>

      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FAF0',
  },
  innerContainer: {
    padding: 24,
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  defaultAvatar: {
    backgroundColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    color: '#FFF',
    fontSize: 50,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePicText: {
    color: '#0E6643',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoSection: {
    paddingBottom: 10,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  infoTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  chevronIcon: {
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  }
});
