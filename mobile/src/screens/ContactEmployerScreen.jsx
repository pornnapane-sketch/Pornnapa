// หน้าติดต่อผู้ว่าจ้าง: แสดงชื่อและเบอร์โทร กดที่เบอร์เพื่อโทรออก
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ContactEmployerScreen({ route, navigation }) {
  const { customerName, customerPhone } = route.params || {};
  const insets = useSafeAreaInsets();

  // เปิดแอปโทรศัพท์ของเครื่องด้วยเบอร์ผู้ว่าจ้าง (ถ้าไม่มีเบอร์จะแจ้งเตือน)
  const handleCall = () => {
    if (customerPhone) {
      Linking.openURL(`tel:${customerPhone}`);
    } else {
      Alert.alert('แจ้งเตือน', 'ไม่พบเบอร์โทรศัพท์ลูกค้า');
    }
  };

  // หัวเรื่องพร้อมปุ่มย้อนกลับ และการ์ดแสดงชื่อผู้ว่าจ้างกับเบอร์โทรที่กดโทรได้
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ติดต่อผู้ว่าจ้าง</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconContainerDark}>
              <Ionicons name="person" size={22} color="#FFF" />
            </View>
            <View style={styles.textWrapper}>
              <Text style={styles.label}>ผู้ว่าจ้าง</Text>
              <Text style={styles.value}>คุณ{customerName || 'ลูกค้า'}</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.row, { marginTop: 25 }]} onPress={handleCall}>
            <View style={styles.iconContainerLight}>
              <Ionicons name="call" size={22} color="#0E6643" />
            </View>
            <View style={styles.textWrapper}>
              <Text style={styles.label}>เบอร์โทรศัพท์</Text>
              <Text style={styles.value}>{customerPhone || '-'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2FBF6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    zIndex: 10
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0E6643'
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainerDark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0E6643',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  iconContainerLight: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#C8E6C9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  textWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  }
});
