// หน้ารายละเอียดงานในประวัติ: สาเหตุการยกเลิก (ถ้ามี) ข้อมูลการให้บริการ (ผู้ว่าจ้าง สถานที่ วันเวลา) รูปหลักฐานการแจ้งปัญหา พื้นที่ทำความสะอาด หมายเหตุจากลูกค้า และรูปก่อน/หลังทำงานที่ส่งมอบ
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';
import { API_BASE_URL } from '../config/env';

const { width } = Dimensions.get('window');
const photoWidth = (width - 72) / 2; // (padding 16*2 + inner card padding 16 + gap 8)

export default function HistoryDetailScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobDetail, setJobDetail] = useState(null);
  const [photos, setPhotos] = useState({});

  // Image Viewer State
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // โหลดรายละเอียดงานและรูปภาพพร้อมกันตอนเปิดหน้า
  useEffect(() => {
    fetchJobDetail();
    fetchPhotos();
  }, []);

  // ดึงรายละเอียดงานจาก server (รวมเหตุผลการยกเลิกถ้างานถูกยกเลิก)
  const fetchJobDetail = async () => {
    try {
      const res = await apiClient.get(`/api/jobs/detail/${bookingId}`);
      setJobDetail(res.data);
    } catch (error) {
      console.error('Error fetching job detail:', error);
    } finally {
      setLoading(false);
    }
  };

  // ดึงรูปของงานนี้ แล้วจัดกลุ่มตามห้อง/บริการ และแยกเป็นรูปก่อน (before) กับหลัง (after) ทำงาน
  const fetchPhotos = async () => {
    try {
      const res = await apiClient.get(`/api/jobs/photos/${bookingId}`);
      const grouped = {};
      res.data.forEach(p => {
        if (!grouped[p.service_zone]) {
          grouped[p.service_zone] = { before: [], after: [] };
        }
        grouped[p.service_zone][p.photo_type].push(p.photo_path);
      });
      setPhotos(grouped);
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  // ดึงจอลงเพื่อโหลดทั้งรายละเอียดและรูปใหม่
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchJobDetail(), fetchPhotos()]);
    setRefreshing(false);
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

  const normalServices = jobDetail.services?.filter(s => !s.is_addon) || [];
  const addonServices = jobDetail.services?.filter(s => s.is_addon) || [];
  
  const dateObj = new Date(jobDetail.booking_date);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')} ${months[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;
  const formattedTime = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  // กดรูปเพื่อเปิดดูภาพขยาย (เริ่มจากรูปที่กด)
  const handleImageClick = (paths, index) => {
    const uris = paths.map(path => `${API_BASE_URL}${path}`);
    setViewerImages(uris);
    setViewerIndex(index);
    setImageViewerVisible(true);
  };

  // วาดรูปของแต่ละห้อง/บริการ แยกกลุ่มก่อนทำงาน (ป้าย Before) และหลังทำงาน (ป้าย After) กดรูปเพื่อดูขยาย
  const renderPhotosZone = (zoneName, zonePhotos, index) => {
    return (
      <View key={index} style={styles.photoZoneContainer}>
        <Text style={styles.zoneLabel}>{zoneName} :</Text>
        
        {/* Before Photos */}
        {zonePhotos.before && zonePhotos.before.length > 0 && (
          <View style={styles.photoGrid}>
            {zonePhotos.before.slice(0, 2).map((path, idx) => {
              const hasMore = zonePhotos.before.length > 2;
              const remainingCount = zonePhotos.before.length - 2;
              
              return (
                <TouchableOpacity 
                  key={`b-${idx}`} 
                  style={styles.imageWrapper}
                  activeOpacity={0.8}
                  onPress={() => handleImageClick(zonePhotos.before, idx)}
                >
                  <Image
                    source={{ uri: `${API_BASE_URL}${path}` }}
                    style={styles.jobImage}
                    resizeMode="cover"
                    resizeMethod="resize"
                    fadeDuration={0}
                  />
                  {idx === 0 && (
                    <View style={[styles.badge, styles.beforeBadge]}>
                      <Text style={styles.badgeText}>Before</Text>
                    </View>
                  )}
                  {idx === 1 && hasMore && (
                    <View style={styles.moreOverlay}>
                      <Text style={styles.moreText}>+{remainingCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* After Photos */}
        {zonePhotos.after && zonePhotos.after.length > 0 && (
          <View style={[styles.photoGrid, { marginTop: 8 }]}>
            {zonePhotos.after.slice(0, 2).map((path, idx) => {
              const hasMore = zonePhotos.after.length > 2;
              const remainingCount = zonePhotos.after.length - 2;

              return (
                <TouchableOpacity 
                  key={`a-${idx}`} 
                  style={styles.imageWrapper}
                  activeOpacity={0.8}
                  onPress={() => handleImageClick(zonePhotos.after, idx)}
                >
                  <Image
                    source={{ uri: `${API_BASE_URL}${path}` }}
                    style={styles.jobImage}
                    resizeMode="cover"
                    resizeMethod="resize"
                    fadeDuration={0}
                  />
                  {idx === 0 && (
                    <View style={[styles.badge, styles.afterBadge]}>
                      <Text style={styles.badgeText}>After</Text>
                    </View>
                  )}
                  {idx === 1 && hasMore && (
                    <View style={styles.moreOverlay}>
                      <Text style={styles.moreText}>+{remainingCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  // งานที่ถูกยกเลิกเพราะแม่บ้านไม่มาตามนัด ไม่มีการทำงานจริง จึงไม่แสดงภาพหลักฐานการส่งมอบ
  const isNoShowCancelled =
    jobDetail.status === 'cancelled' &&
    (jobDetail.no_show_status === 'reported' || jobDetail.no_show_status === 'resolved');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายละเอียดงาน</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} tintColor="#0E6643" />
        }
      >
        
        {/* สาเหตุการยกเลิก (แสดงเมื่อถูกยกเลิก) */}
        {(jobDetail.status === 'cancelled' || jobDetail.status === 'cancelled_no_maid') && jobDetail.cancel_reason && (
          <View style={[styles.card, { borderLeftWidth: 6, borderLeftColor: '#E74C3C', paddingLeft: 12, overflow: 'hidden' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="alert-circle-outline" size={24} color="#E74C3C" />
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#E74C3C', marginLeft: 8 }}>สาเหตุการยกเลิก</Text>
            </View>
            <Text style={{ fontSize: 15, color: '#333' }}>
              <Text style={{ fontWeight: 'bold' }}>เหตุผล : </Text>
              {jobDetail.cancel_reason}
            </Text>
          </View>
        )}

        {/* ค่าชดเชยที่แม่บ้านได้รับกรณีงานถูกยกเลิก */}
        {(jobDetail.status === 'cancelled' || jobDetail.status === 'cancelled_no_maid') && Number(jobDetail.compensation_amount) > 0 && (
          <View style={[styles.card, { borderLeftWidth: 6, borderLeftColor: '#27AE60', paddingLeft: 12, overflow: 'hidden' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="wallet-outline" size={24} color="#27AE60" />
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#27AE60', marginLeft: 8 }}>ค่าชดเชยการยกเลิกงาน</Text>
            </View>
            <Text style={{ fontSize: 15, color: '#333' }}>
              <Text style={{ fontWeight: 'bold' }}>ได้รับ : </Text>
              + {Number(jobDetail.compensation_amount).toLocaleString()} บาท (เข้ากระเป๋าเงินแล้ว)
            </Text>
          </View>
        )}

        {/* ข้อมูลการให้บริการ */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ข้อมูลการให้บริการ</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="person-circle" size={36} color="#0E6643" />
            </View>
            <View style={styles.textColumn}>
              <Text style={styles.infoLabel}>ผู้ว่าจ้าง</Text>
              <Text style={styles.infoValue}>{jobDetail.customer_name || 'ผู้เยี่ยมชมไม่ได้ระบุ'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="location" size={30} color="#0E6643" style={{marginLeft: 2}} />
            </View>
            <View style={styles.textColumn}>
              <Text style={styles.infoLabel}>สถานที่</Text>
              <Text style={styles.infoValue}>{jobDetail.location}</Text>
            </View>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="calendar-clock" size={32} color="#0E6643" style={{marginLeft: 1}} />
            </View>
            <View style={styles.textColumn}>
              <Text style={styles.infoLabel}>วันที่และเวลาทำการ</Text>
              <Text style={styles.infoValue}>{formattedDate}</Text>
              <Text style={styles.infoTime}>{formattedTime} น.</Text>
            </View>
          </View>
        </View>

        {/* รูปภาพหลักฐานปัญหา (ย้ายมาไว้ใต้ข้อมูลบริการ) */}
        {(jobDetail.status === 'cancelled' || jobDetail.status === 'cancelled_no_maid') && jobDetail.cancel_images && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>รูปภาพหลักฐานปัญหา</Text>
            <View style={styles.photoGrid}>
              {(() => {
                try {
                  const images = JSON.parse(jobDetail.cancel_images);
                  return images.slice(0, 2).map((img, idx) => {
                    const hasMore = images.length > 2;
                    const remainingCount = images.length - 2;
                    
                    return (
                      <TouchableOpacity 
                        key={`cancel-${idx}`} 
                        style={styles.imageWrapper}
                        activeOpacity={0.8}
                        onPress={() => handleImageClick(images, idx)}
                      >
                        <Image
                          source={{ uri: `${API_BASE_URL}${img}` }}
                          style={styles.jobImage}
                          resizeMode="cover"
                          resizeMethod="resize"
                          fadeDuration={0}
                        />
                        {idx === 1 && hasMore && (
                          <View style={styles.moreOverlay}>
                            <Text style={styles.moreText}>+{remainingCount}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  });
                } catch(e) { return null; }
              })()}
            </View>
          </View>
        )}

        {jobDetail.status !== 'cancelled' && jobDetail.status !== 'cancelled_no_maid' && (
          <>
            {/* พื้นที่ทำความสะอาด */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>พื้นที่ทำความสะอาด</Text>
              
              {normalServices.map((srv, index) => (
                <View key={index} style={styles.serviceRow}>
                  <Text style={styles.serviceText}>  • {srv.zone_name}</Text>
                  <Text style={styles.servicePrice}>{Number(srv.price_at_booking)} บาท</Text>
                </View>
              ))}
              {addonServices.map((srv, index) => (
                <View key={`addon-${index}`} style={styles.serviceRow}>
                  <Text style={styles.serviceText}>  • {srv.zone_name}</Text>
                  <Text style={styles.servicePrice}>{Number(srv.price_at_booking)} บาท</Text>
                </View>
              ))}

              <View style={styles.divider} />
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>รายได้ที่ได้รับ :</Text>
                <Text style={styles.totalValue}>{jobDetail.total_price} บาท</Text>
              </View>
            </View>

            {/* หมายเหตุจากลูกค้า */}
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>หมายเหตุจากลูกค้า:</Text>
              <Text style={styles.noteContent}>{jobDetail.customer_note || 'ไม่มีหมายเหตุ'}</Text>
            </View>
          </>
        )}

        {/* ภาพหลักฐานที่ส่งมอบ */}
        {!isNoShowCancelled && Object.keys(photos).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ภาพหลักฐานที่ส่งมอบ</Text>
            {Object.keys(photos).map((zone, idx) => renderPhotosZone(zone, photos[zone], idx))}
          </View>
        )}

      </ScrollView>

      {/* Fullscreen Image Viewer Modal */}
      <Modal 
        visible={imageViewerVisible} 
        transparent={true} 
        statusBarTranslucent={true}
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity style={styles.closeViewerButton} onPress={() => setImageViewerVisible(false)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: viewerIndex * width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setViewerIndex(Math.round(x / width));
            }}
          >
            {viewerImages.map((uri, idx) => (
              <View key={idx} style={styles.viewerImageWrapper}>
                <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" fadeDuration={0} />
              </View>
            ))}
          </ScrollView>
          <View style={styles.imageViewerFooter}>
            <Text style={styles.imageViewerCount}>{viewerIndex + 1} / {viewerImages.length}</Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2FBF6',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2FBF6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0E6643',
    marginLeft: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 8,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  infoTime: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  serviceText: {
    fontSize: 16,
    color: '#333',
  },
  servicePrice: {
    fontSize: 16,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0E6643',
  },
  noteCard: {
    backgroundColor: '#F0F0F0', // สีเทาอ่อนเหมือนในแบบ
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  noteContent: {
    fontSize: 16,
    color: '#333',
  },
  photoZoneContainer: {
    marginBottom: 20,
  },
  zoneLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  imageWrapper: {
    width: photoWidth,
    aspectRatio: 1.5,
    marginBottom: 8,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  jobImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EAEAEA',
  },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  beforeBadge: {
    backgroundColor: 'rgba(100, 100, 100, 0.7)',
  },
  afterBadge: {
    backgroundColor: 'rgba(46, 204, 113, 0.8)',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  moreText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeViewerButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  viewerImageWrapper: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
  imageViewerFooter: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imageViewerCount: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
