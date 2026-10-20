// เมนูแท็บด้านล่างหลังล็อกอิน: หน้าหลัก / งานใหม่ / ตารางงาน / บัญชี พร้อมตัวเลขแดงจำนวนงานใหม่บนแท็บ
import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

import HomeScreen from './HomeScreen';
import AccountScreen from './AccountScreen';
import JobScreen from './JobScreen';
import ScheduleScreen from './ScheduleScreen';

import apiClient from '../api/apiClient';
import { auth } from '../config/firebaseConfig';

const Tab = createBottomTabNavigator();

// --- หน้าจอจำลองชั่วคราวสำหรับเมนูที่ยังไม่ได้สร้างจริง ---
const PlaceholderScreen = ({ title }) => (
  <View style={styles.center}>
    <Text style={styles.title}>หน้าจอ {title}</Text>
    <Text style={styles.subtitle}>ระบบกำลังอยู่ในช่วงพัฒนา</Text>
  </View>
);

export default function MainTabScreen() {
  // จำนวนงานใหม่ที่แสดงบนแท็บ (null = ซ่อนตัวเลข)
  const [badgeCount, setBadgeCount] = useState(null);

  useEffect(() => {
    // นับงานใหม่ที่แม่บ้านรับได้ เฉพาะตอนเปิดสถานะพร้อมรับงาน โดยใช้ API เดียวกับหน้างานใหม่ ตัวเลขจึงตรงกับรายการเสมอ
    const fetchBadgeCount = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        // 1. ตรวจสอบสถานะออนไลน์
        const profileRes = await apiClient.get(`/api/members/profile?email=${currentUser.email}`);
        const isOnline = profileRes.data.is_online === 1;

        if (isOnline) {
          // 2. ถ้าออนไลน์ ให้ดึงข้อมูลงานใหม่เพื่อใช้นับจำนวน
          const jobsRes = await apiClient.get(`/api/jobs/new?maid_id=${profileRes.data.maid_id}`);
          const count = jobsRes.data.length;
          // ถ้ามีงานใหม่ ให้แสดงตัวเลข แต่ถ้าไม่มีให้เป็น null (ซ่อน)
          setBadgeCount(count > 0 ? count : null);
        } else {
          // 3. ถ้าปิดออนไลน์ ไม่ต้องแสดงตัวเลข
          setBadgeCount(null);
        }
      } catch (error) {
        console.log('Error fetching badge count:', error);
      }
    };

    // ดึงข้อมูลครั้งแรกทันที
    fetchBadgeCount();

    // ดึงข้อมูลซ้ำทุกๆ 5 วินาที เพื่ออัปเดต Badge อัตโนมัติ
    const interval = setInterval(fetchBadgeCount, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    // ตั้งค่าแท็บ: ไอคอนทึบ = กำลังเลือก, ไอคอนเส้นขอบ = ไม่ได้เลือก และกำหนดสีกับขนาดของแถบด้านล่าง
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // ซ่อน Header ของ Tab 
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'NewJobTab') {
            // เปลี่ยนเป็นไอคอนกระดิ่ง
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'ScheduleTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'AccountTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          // คืนค่าไอคอน Ionicons
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0E6643', // สีเขียวเข้มตอนกดเลือก
        tabBarInactiveTintColor: 'gray', // สีเทาตอนไม่ได้เลือก
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60, // เพิ่มความสูงให้สวยขึ้น
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        }
      })}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen} 
        options={{ tabBarLabel: 'หน้าหลัก' }} 
      />
      <Tab.Screen 
        name="NewJobTab" 
        component={JobScreen} 
        options={{ 
          tabBarLabel: 'งานใหม่',
          tabBarBadge: badgeCount, // ใส่จำนวนงานที่รอรับ
          tabBarBadgeStyle: { backgroundColor: '#E74C3C', color: '#FFF' }
        }} 
      />
      <Tab.Screen 
        name="ScheduleTab" 
        component={ScheduleScreen} 
        options={{ tabBarLabel: 'ตารางงาน' }} 
      />
      <Tab.Screen 
        name="AccountTab" 
        component={AccountScreen} 
        options={{ tabBarLabel: 'บัญชี' }} 
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FAF0'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0E6643'
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 10
  }
});
