// หน้ารายละเอียดงานใหม่: ดูสถานที่ (กดเปิดแผนที่) บริการและรายได้ หมายเหตุลูกค้า ผู้ว่าจ้างและวันเวลานัด แล้วกด รับงาน/ไม่รับงาน (งานที่รับแล้วแต่ยังไม่ชำระเงินจะเปิดดูได้อย่างเดียว ไม่มีปุ่ม)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Image,
  Dimensions,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';
import { auth } from '../config/firebaseConfig';
import { API_BASE_URL } from '../config/env';
import CustomAlert from '../components/CustomAlert';

const { width } = Dimensions.get('window');
const photoWidth = (width - 72) / 2;

export default function NewJobDetailScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const [loading, setLoading] = useState(true);
  const [jobDetail, setJobDetail] = useState(null);
  const [maidId, setMaidId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // โหลดรายละเอียดงานตอนเปิดหน้า
  useEffect(() => {
    fetchJobDetail();
  }, []);

  // ดึงจอลงเพื่อโหลดรายละเอียดงานใหม่
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchJobDetail();
    setRefreshing(false);
  }, []);

  // ดึงรหัสแม่บ้านจากโปรไฟล์ผู้ล็อกอินและรายละเอียดงานจาก server ถ้าไม่สำเร็จแสดงป๊อบอัพ
  const fetchJobDetail = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.email) {
        const profileRes = await apiClient.get(`/api/members/profile?email=${currentUser.email}`);
        setMaidId(profileRes.data.maid_id);
      }

      const res = await apiClient.get(`/api/jobs/detail/${bookingId}`);
      setJobDetail(res.data);
    } catch (error) {
      console.error('Error fetching job detail:', error);
      setAlertTitle('ข้อผิดพลาด');
      setAlertMessage('ไม่สามารถดึงข้อมูลรายละเอียดงานได้');
      setAlertButtons([{ text: 'ตกลง', onPress: () => setAlertVisible(false) }]);
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  // ถามยืนยันก่อนรับ/ไม่รับงาน (ต้องมีรหัสแม่บ้านก่อน)
  const confirmAction = (action) => {
    if (!maidId) {
      setAlertTitle('ข้อผิดพลาด');
      setAlertMessage('ไม่พบข้อมูลแม่บ้าน');
      setAlertButtons([{ text: 'ตกลง', onPress: () => setAlertVisible(false) }]);
      setAlertVisible(true);
      return;
    }
    setPendingAction(action);
    setAlertTitle('ยืนยัน');
    setAlertMessage(action === 'accept' ? 'คุณต้องการรับงานนี้ใช่หรือไม่' : 'คุณต้องการไม่รับงานนี้ใช่หรือไม่');
    setAlertButtons([
      { text: 'ยืนยัน', onPress: () => handleAction(action) },
      { text: 'ยกเลิก', style: 'cancel', onPress: () => setAlertVisible(false) }
    ]);
    setAlertVisible(true);
  };

  // ส่งการตัดสินใจ (accept/reject) ไป server สำเร็จแล้วกลับหน้าก่อนหน้า ถ้า server ปฏิเสธ (เช่น เวลาชน/งานถูกรับไปแล้ว) จะแสดงข้อความจาก server
  const handleAction = async (action) => {
    setAlertVisible(false);
    if (!maidId) {
      setTimeout(() => {
        setAlertTitle('ข้อผิดพลาด');
        setAlertMessage('ไม่พบข้อมูลแม่บ้าน');
        setAlertButtons([{ text: 'ตกลง', onPress: () => setAlertVisible(false) }]);
        setAlertVisible(true);
      }, 300);
      return;
    }

    setProcessing(true);
    try {
      await apiClient.post('/api/jobs/action', {booking_id: bookingId,maid_id: maidId,action: action});
      
      setAlertTitle('สำเร็จ');
      setAlertMessage(action === 'accept' ? 'รับงานเรียบร้อยแล้ว' : 'ปฏิเสธงานเรียบร้อยแล้ว');
      setAlertButtons([{ text: 'ตกลง', onPress: () => { setAlertVisible(false); navigation.goBack(); } }]);
      setAlertVisible(true);
    } catch (error) {
      // 409 = ไม่ผ่านเงื่อนไขการรับงาน (เวลาชน/งานถูกรับไปแล้ว) เป็นกรณีปกติ ไม่ต้อง log เป็น error
      if (error.response?.status !== 409) {
        console.error('Action error:', error);
      }
      setAlertTitle(error.response?.status === 409 ? 'ไม่สามารถรับงานได้' : 'ข้อผิดพลาด');
      setAlertMessage(error.response?.data?.message || 'ไม่สามารถดำเนินการได้ในขณะนี้');
      setAlertButtons([{ text: 'ตกลง', onPress: () => setAlertVisible(false) }]);
      setAlertVisible(true);
    } finally {
      setProcessing(false);
    }
  };

  // เปิดแอปแผนที่ของเครื่องที่พิกัดงาน (ถ้าเปิดไม่ได้ใช้ลิงก์ Google Maps แทน)
  const handleOpenMap = () => {
    if (!jobDetail.lat || !jobDetail.lng) {
      setAlertTitle('แจ้งเตือน');
      setAlertMessage('ไม่พบพิกัดแผนที่สำหรับสถานที่นี้');
      setAlertButtons([{ text: 'ตกลง', onPress: () => setAlertVisible(false) }]);
      setAlertVisible(true);
      return;
    }
    const lat = jobDetail.lat;
    const lng = jobDetail.lng;
    const label = encodeURIComponent(jobDetail.location);
    
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`
    });

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
      }
    }).catch(err => {
      console.error('An error occurred', err);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0E6643" />
      </SafeAreaView>
    );
  }

  if (!jobDetail) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text>ไม่พบข้อมูล</Text>
      </SafeAreaView>
    );
  }

  // แสดงปุ่มรับงาน/ไม่รับงาน เฉพาะงานใหม่ที่ยังไม่มีแม่บ้านรับเท่านั้น
  // (ถ้ารับไปแล้วแต่ลูกค้ายังไม่ชำระเงิน จะเข้ามาดูรายละเอียดได้แต่ไม่มีปุ่มให้กด)
  const showActionButtons = jobDetail.status === 'pending' || jobDetail.status === 'waiting_maid';

  // แยกบริการหลักกับบริการเสริมเพื่อแสดงเป็นสองกลุ่ม
  const normalServices = jobDetail.services?.filter(s => !s.is_addon) || [];
  const addonServices = jobDetail.services?.filter(s => s.is_addon) || [];
  
  // จัดรูปวันที่ (ไทย พ.ศ.) และเวลานัดหมายสำหรับแสดงผล
  const dateObj = new Date(jobDetail.booking_date);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')} ${months[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;
  const formattedTime = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  // รายละเอียดงานแบบเลื่อนดู (ดึงจอลงรีเฟรชได้) และแถบปุ่มรับ/ไม่รับงานด้านล่างเฉพาะงานใหม่ ป๊อบอัพยืนยันใช้ CustomAlert
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายละเอียดงาน</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0E6643"]} tintColor="#0E6643" />
        }
      >
        <TouchableOpacity style={styles.card} onPress={handleOpenMap} activeOpacity={0.7}>
          <View style={styles.row}>
            <Ionicons name="location" size={24} color="#E74C3C" style={styles.icon} />
            <View style={styles.textColumn}>
              <Text style={styles.locationTitle}>ดูเส้นทางบนแผนที่</Text>
              <Text style={styles.locationDetail}>{jobDetail.location}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>พื้นที่ทำความสะอาด</Text>
          {normalServices.length > 0 ? (
            normalServices.map((srv, index) => (
              <View key={index} style={styles.serviceRow}>
                <Text style={styles.serviceText}> •  {srv.zone_name}</Text>
                <Text style={styles.servicePrice}>{Number(srv.price_at_booking)} บาท</Text>
              </View>
            ))
          ) : (
            <View style={styles.serviceRow}>
              <Text style={styles.serviceText}> •  ไม่ระบุพื้นที่</Text>
              <Text style={styles.servicePrice}>- บาท</Text>
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>บริการเสริม</Text>
          {addonServices.length > 0 ? (
            addonServices.map((srv, index) => (
              <View key={index} style={styles.serviceRow}>
                <Text style={styles.serviceText}> •  {srv.zone_name}</Text>
                <Text style={styles.servicePrice}>{Number(srv.price_at_booking)} บาท</Text>
              </View>
            ))
          ) : (
            <View style={styles.serviceRow}>
              <Text style={styles.serviceText}> •  ไม่มีบริการเสริม</Text>
              <Text style={styles.servicePrice}></Text>
            </View>
          )}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>รายได้ที่จะได้รับ :</Text>
            <Text style={styles.totalValue}>{jobDetail.total_price}  บาท</Text>
          </View>
        </View>

        {jobDetail.customer_note && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>หมายเหตุจากลูกค้า:</Text>
            <Text style={styles.noteText}>{jobDetail.customer_note}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="person-circle" size={32} color="#0E6643" style={styles.infoIcon} />
            <View style={styles.textColumn}>
              <Text style={styles.infoLabel}>ผู้ว่าจ้าง</Text>
              <Text style={styles.infoValue}>{jobDetail.customer_name || 'ลูกค้าทั่วไป'}</Text>
            </View>
          </View>
          
          <View style={[styles.infoRow, { marginTop: 16 }]}>
            <View style={[styles.row, { flex: 1 }]}>
              <Ionicons name="calendar" size={32} color="#0E6643" style={styles.infoIcon} />
              <View style={styles.textColumn}>
                <Text style={styles.infoLabel}>วันที่นัดหมาย</Text>
                <Text style={styles.infoValue}>{formattedDate}</Text>
              </View>
            </View>
            <View style={[styles.row, { flex: 1 }]}>
              <Ionicons name="time" size={32} color="#0E6643" style={styles.infoIcon} />
              <View style={styles.textColumn}>
                <Text style={styles.infoLabel}>เวลานัดหมาย</Text>
                <Text style={styles.infoValue}>{formattedTime}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {showActionButtons && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => confirmAction('accept')}
            disabled={processing}
          >
            <Text style={styles.acceptButtonText}>รับงาน</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => confirmAction('reject')}
            disabled={processing}
          >
            <Text style={styles.rejectButtonText}>ไม่รับงาน</Text>
          </TouchableOpacity>
        </View>
      )}

      <CustomAlert 
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
      />
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  centerContainer: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0E6643',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  locationTitle: {
    fontSize: 14,
    color: '#0E6643',
    fontWeight: '600',
    marginBottom: 2,
  },
  locationDetail: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingLeft: 8,
  },
  serviceText: {
    fontSize: 15,
    color: '#333',
  },
  servicePrice: {
    fontSize: 15,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0E6643',
  },
  noteText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    paddingLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#1EAE53',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 8,
    elevation: 2,
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  rejectButtonText: {
    color: '#555',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
