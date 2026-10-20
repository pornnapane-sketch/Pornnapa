// หน้ารายละเอียดงานที่รับแล้วและชำระเงินแล้ว: แผนที่ย่อ ผู้ว่าจ้างและเบอร์โทร วันเวลานัด บริการ และปุ่มเริ่มเดินทาง มีปุ่มแจ้งปัญหามุมขวาบน
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
  Dimensions,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import apiClient from '../api/apiClient';
import { auth } from '../config/firebaseConfig';
import { API_BASE_URL } from '../config/env';
import { useAlert } from '../context/AlertContext';

const { width } = Dimensions.get('window');
const photoWidth = (width - 72) / 2;

export default function AcceptedJobDetailScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobDetail, setJobDetail] = useState(null);
  const [maidId, setMaidId] = useState(null);
  const [processing, setProcessing] = useState(false);
  // เวลา (ของเครื่อง) ที่โหลดข้อมูลล่าสุด ใช้คู่กับจำนวนวินาทีที่ server บอก เพื่อนับเวลาที่เหลือโดยไม่พึ่งนาฬิกาเครื่อง
  const [loadedAt, setLoadedAt] = useState(Date.now());
  // ตัวกระตุ้นให้หน้าคำนวณสถานะปุ่มใหม่ทุก 15 วินาที ปุ่มจะปลดล็อกเองเมื่อถึงเวลา
  const [, setTick] = useState(0);

  // โหลดรายละเอียดงานตอนเปิดหน้า
  useEffect(() => {
    fetchJobDetail();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
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
      setLoadedAt(Date.now());
    } catch (error) {
      console.error('Error fetching job detail:', error);
      showAlert('ข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลรายละเอียดงานได้');
    } finally {
      setLoading(false);
    }
  };

  // เปิดแอปแผนที่ของเครื่องที่พิกัดงาน (ถ้าเปิดไม่ได้ใช้ลิงก์ Google Maps แทน)
  const handleOpenMap = () => {
    if (!jobDetail.lat || !jobDetail.lng) {
      showAlert('แจ้งเตือน', 'ไม่พบพิกัดแผนที่สำหรับสถานที่นี้');
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

  // ดึงจอลงเพื่อโหลดรายละเอียดงานใหม่
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobDetail();
    setRefreshing(false);
  };

  // กดเริ่มเดินทาง: บอก server ก่อน (กันงานถูกยกเลิกอัตโนมัติ) แล้วค่อยเปิดหน้าแผนที่
  const handleStartTravel = async () => {
    if (processing) return;
    if (!maidId) {
      showAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลแม่บ้าน กรุณาลองใหม่อีกครั้ง');
      return;
    }

    setProcessing(true);
    try {
      await apiClient.post('/api/jobs/start-travel', { booking_id: jobDetail.booking_id, maid_id: maidId });
    } catch (error) {
      setProcessing(false);
      const message = error.response?.data?.message || 'ไม่สามารถเริ่มเดินทางได้ กรุณาลองใหม่อีกครั้ง';
      const code = error.response?.data?.code;
      if (code === 'CANCELLED') {
        // งานถูกยกเลิกไปแล้ว กลับไปหน้าก่อนหน้า
        showAlert('ไม่สามารถเริ่มเดินทางได้', message, [{ text: 'ตกลง', onPress: () => navigation.goBack() }]);
      } else if (error.response?.status === 409) {
        // ยังไม่ถึงเวลา/ยังไม่พร้อม: แจ้งแล้วรีเฟรชข้อมูลให้ปุ่มตรงกับ server
        showAlert('ไม่สามารถเริ่มเดินทางได้', message);
        fetchJobDetail();
      } else {
        showAlert('ข้อผิดพลาด', message);
      }
      return;
    }
    setProcessing(false);

    navigation.navigate('TravelMap', {
      bookingId: jobDetail.booking_id,
      lat: jobDetail.lat,
      lng: jobDetail.lng,
      location: jobDetail.location,
      customerName: jobDetail.customer_name,
      customerPhone: jobDetail.customer_phone,
      services: jobDetail.services
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

  // แยกบริการหลักกับบริการเสริมเพื่อแสดงเป็นสองกลุ่ม
  const normalServices = jobDetail.services?.filter(s => !s.is_addon) || [];
  const addonServices = jobDetail.services?.filter(s => s.is_addon) || [];
  
  // จัดรูปวันที่ (ไทย พ.ศ.) และเวลานัดหมายสำหรับแสดงผล
  const dateObj = new Date(jobDetail.booking_date);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')} ${months[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;
  const formattedTime = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  // ปุ่มเริ่มเดินทางถูกล็อกจนกว่าจะถึงช่วงเวลาที่เปิดให้กด (นับจากวินาทีที่ server ส่งมา หักเวลาที่ผ่านไปตั้งแต่โหลด)
  // ถ้าเริ่มเดินทางไปแล้ว (มี job_started_at) ปุ่มไม่ล็อก เพื่อให้กลับเข้าหน้าแผนที่ได้
  const remainingSeconds = Number(jobDetail.start_travel_wait_seconds || 0) - (Date.now() - loadedAt) / 1000;
  const startLocked = !jobDetail.job_started_at && remainingSeconds > 0;
  // ข้อความบอกช่วงที่กดเริ่มเดินทางได้ (คิดจากเวลาที่ server ส่งมา ไม่แสดงถ้า server ไม่จำกัดช่วงเวลา)
  let startWindowNote = '';
  if (jobDetail.start_travel_opens_at) {
    const windowMinutes = Math.round((dateObj.getTime() - new Date(jobDetail.start_travel_opens_at).getTime()) / 60000);
    if (windowMinutes > 0) {
      const windowText = windowMinutes % 60 === 0 ? `${windowMinutes / 60} ชั่วโมง` : `${windowMinutes} นาที`;
      startWindowNote = `สามารถกดเริ่มเดินทางได้ก่อนเวลานัดหมายไม่เกิน ${windowText}`;
    }
  }

  // รายละเอียดงานแบบเลื่อนดู (ดึงจอลงรีเฟรชได้) และปุ่มเริ่มเดินทางค้างอยู่ด้านล่าง
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายละเอียดงาน</Text>
        <TouchableOpacity style={styles.alertButton} onPress={() => navigation.navigate('ReportProblem', { bookingId })}>
          <Ionicons name="alert-circle-outline" size={24} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} tintColor="#0E6643" />
        }
      >
        <View style={styles.card}>
          <View style={styles.mapLabelRow}>
            <Text style={styles.mapButtonTextAccepted}>ดูเส้นทางบนแผนที่</Text>
          </View>

          {jobDetail.lat && jobDetail.lng ? (
            <TouchableOpacity style={styles.mapPreview} onPress={handleOpenMap} activeOpacity={0.85}>
              <MapView
                style={styles.mapPreviewMap}
                pointerEvents="none"
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                initialRegion={{
                  latitude: parseFloat(jobDetail.lat),
                  longitude: parseFloat(jobDetail.lng),
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: parseFloat(jobDetail.lat),
                    longitude: parseFloat(jobDetail.lng),
                  }}
                />
              </MapView>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.locationDetailAccepted}>{jobDetail.location}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="person-circle" size={32} color="#0E6643" style={styles.infoIcon} />
            <View style={styles.textColumn}>
              <Text style={styles.infoLabel}>ผู้ว่าจ้าง</Text>
              <Text style={styles.infoValue}>{jobDetail.customer_name || 'ลูกค้าทั่วไป'}</Text>
            </View>
          </View>
          <View style={[styles.divider, { marginTop: 12, marginBottom: 12 }]} />
          <View style={styles.infoRow}>
            <TouchableOpacity 
              style={[styles.infoIcon, { backgroundColor: '#1EAE53', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }]}
              onPress={() => {
                if (jobDetail.customer_phone) {
                  Linking.openURL(`tel:${jobDetail.customer_phone}`);
                } else {
                  showAlert('แจ้งเตือน', 'ไม่พบเบอร์โทรศัพท์ของลูกค้า');
                }
              }}
            >
              <Ionicons name="call" size={20} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.textColumn}>
              <Text style={styles.infoLabel}>เบอร์โทรศัพท์</Text>
              <Text style={styles.infoValue}>{jobDetail.customer_phone || 'ไม่มีข้อมูล'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.infoRow}>
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
          <View style={styles.noticeBox}>
            <View style={styles.noticeHeader}>
              <Ionicons name="alert-circle" size={18} color="#B45309" />
              <Text style={styles.noticeTitle}>ข้อควรทราบ</Text>
            </View>
            <View style={styles.noticeRow}>
              <Text style={styles.noticeBullet}>•</Text>
              <Text style={styles.noticeText}>ควรเดินทางไปถึงหน้างานก่อนเวลานัดหมาย 10–15 นาที</Text>
            </View>
            <View style={styles.noticeRow}>
              <Text style={styles.noticeBullet}>•</Text>
              <Text style={styles.noticeText}>หากเลยเวลานัดหมาย 20 นาทีแล้วยังไม่กดเริ่มเดินทาง ระบบจะยกเลิกงานโดยอัตโนมัติ</Text>
            </View>
          </View>
        </View>

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

        {startLocked && startWindowNote ? (
          <View style={styles.windowNote}>
            <Ionicons name="information-circle" size={18} color="#0E6643" />
            <Text style={styles.windowNoteText}>{startWindowNote}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={[styles.acceptButton, { marginRight: 0 }, startLocked && styles.acceptButtonLocked]}
          onPress={handleStartTravel}
          disabled={processing || startLocked}
        >
          {processing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.acceptButtonText}>เริ่มเดินทาง</Text>
          )}
        </TouchableOpacity>
      </View>
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
  alertButton: {
    padding: 4,
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
  acceptButtonLocked: {
    backgroundColor: '#CBD5E1',
    elevation: 0,
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
  },
  mapLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12
  },
  mapButtonTextAccepted: {
    color: '#888',
    fontSize: 14
  },
  mapPreview: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  mapPreviewMap: {
    flex: 1,
  },
  locationDetailAccepted: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  noticeBox: {
    marginTop: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  noticeTitle: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#B45309',
  },
  noticeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  noticeBullet: {
    width: 14,
    fontSize: 14,
    lineHeight: 20,
    color: '#92400E',
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#92400E',
  },
  windowNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  windowNoteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#0E6643',
  }
});
