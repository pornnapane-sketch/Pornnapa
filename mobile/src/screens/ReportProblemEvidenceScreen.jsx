// แจ้งปัญหาขั้นที่ 2: แนบรูปหลักฐาน 1-4 รูป แล้วส่งสาเหตุกับรูปไป server (สถานะงานเปลี่ยนเป็นกำลังตรวจสอบ) จากนั้นไปหน้ารอตรวจสอบ
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, Dimensions, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';

const { width } = Dimensions.get('window');
const itemWidth = (width - 90) / 2;

export default function ReportProblemEvidenceScreen({ route, navigation }) {
  const { bookingId, reasonType, reasonText } = route.params;
  const insets = useSafeAreaInsets();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alertData, setAlertData] = useState({ visible: false, title: '', message: '', type: 'success', onConfirm: null });

  // เลือกรูปจากคลังได้รวมไม่เกิน 4 รูป (ต้องขออนุญาตเข้าถึงรูปก่อน)
  const pickImage = async () => {
    if (images.length >= 4) {
      setAlertData({
        visible: true,
        type: 'error',
        title: 'แจ้งเตือน',
        message: 'คุณสามารถอัปโหลดรูปภาพได้สูงสุด 4 รูป'
      });
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      setAlertData({
        visible: true,
        type: 'error',
        title: 'แจ้งเตือน',
        message: 'กรุณาอนุญาตการเข้าถึงรูปภาพเพื่อใช้งานส่วนนี้'
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 4 - images.length,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uris = result.assets.map(asset => ({ uri: asset.uri }));
      const allowedUris = uris.slice(0, 4 - images.length);
      setImages([...images, ...allowedUris]);
    }
  };

  // ลบรูปที่กดออกจากรายการ
  const removeImage = (indexToRemove) => {
    setImages(images.filter((_, index) => index !== indexToRemove));
  };

  // ส่งสาเหตุและรูปหลักฐานแบบ multipart ไปที่ /api/jobs/report-problem (ต้องมีรูปอย่างน้อย 1 รูป) สำเร็จแล้วไปหน้า ReportProblemWait
  const handleSubmit = async () => {
    if (images.length === 0) {
      setAlertData({
        visible: true,
        type: 'error',
        title: 'แจ้งเตือน',
        message: 'กรุณาอัปโหลดรูปหลักฐานอย่างน้อย 1 รูป'
      });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('booking_id', bookingId);
      formData.append('reason_type', reasonType);
      formData.append('reason_text', reasonText || '');

      images.forEach((img, index) => {
        const fileExt = img.uri.split('.').pop() || 'jpg';
        const fileName = `evidence_${index}_${Date.now()}.${fileExt}`;
        formData.append('images', {
          uri: img.uri,
          name: fileName,
          type: `image/${fileExt.toLowerCase() === 'png' ? 'png' : 'jpeg'}`,
        });
      });

      await apiClient.post('/api/jobs/report-problem', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setLoading(false);
      setAlertData({
        visible: true,
        type: 'success',
        title: 'สำเร็จ',
        message: 'ส่งรายงานและรูปหลักฐานเรียบร้อยแล้ว ระบบจะดำเนินการตรวจสอบต่อไป',
        onConfirm: () => navigation.navigate('ReportProblemWait', { bookingId })
      });
    } catch (error) {
      console.error('Error submitting problem evidence:', error);
      setLoading(false);
      setAlertData({
        visible: true,
        type: 'error',
        title: 'ข้อผิดพลาด',
        message: error.response?.data?.message || 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
      });
    }
  };

  // รูปที่เลือกแล้วพร้อมปุ่มลบ ปุ่มเพิ่มรูป และปุ่มส่งรายงาน
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แนบรูปหลักฐานปัญหา</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.card}>
          <View style={styles.photoRow}>
            {images.map((img, index) => (
              <View key={index} style={styles.imgWrapper}>
                <TouchableOpacity onPress={() => removeImage(index)}>
                  <Image source={{ uri: img.uri }} style={styles.photoThumbnail} />
                  <View style={styles.deleteIconBadge}>
                    <Ionicons name="close-circle" size={24} color="#E74C3C" />
                  </View>
                </TouchableOpacity>
              </View>
            ))}
            
            {images.length < 4 && (
              <TouchableOpacity 
                style={images.length === 0 ? styles.addBtnFull : styles.addBtn} 
                onPress={pickImage}
              >
                <View style={styles.iconWrapper}>
                  <Ionicons name="camera-outline" size={32} color="#555" />
                  <Ionicons name="add-circle" size={14} color="#555" style={styles.plusIcon} />
                </View>
                <Text style={styles.addBtnText}>เพิ่มรูปภาพ</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.warningContainer}>
          <View style={styles.warningIcon}>
            <Text style={{color: '#F39C12', fontWeight: 'bold'}}>!</Text>
          </View>
          <Text style={styles.warningText}>
            กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป และสูงสุดไม่เกิน 4 รูป เพื่อใช้เป็นหลักฐานยืนยันความเรียบร้อยและป้องกันข้อพิพาท
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, images.length > 0 ? styles.submitButtonActive : styles.submitButtonInactive, { marginTop: 20 }]}
          disabled={loading || images.length === 0}
          onPress={handleSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={[styles.submitButtonText, images.length > 0 ? styles.submitButtonTextActive : styles.submitButtonTextInactive]}>ยืนยันการแจ้งปัญหา</Text>
          )}
        </TouchableOpacity>

      </ScrollView>

      <Modal
        visible={alertData.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAlertData(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            {alertData.type !== 'success' ? (
              <View style={[styles.alertIconBadge, styles.alertErrorBadge]}>
                <Ionicons name="close" size={40} color="#FFF" />
              </View>
            ) : null}
            <Text style={styles.alertTitle}>{alertData.title}</Text>
            <Text style={styles.alertMessage}>{alertData.message}</Text>
            <TouchableOpacity 
              style={[styles.alertButtonOK, alertData.type === 'success' ? styles.alertButtonSuccess : styles.alertButtonError]}
              onPress={() => {
                setAlertData(prev => ({ ...prev, visible: false }));
                if (alertData.onConfirm) alertData.onConfirm();
              }}
            >
              <Text style={styles.alertButtonText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 20,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  addBtn: {
    width: itemWidth,
    aspectRatio: 1.6,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    marginBottom: 10,
  },
  addBtnFull: {
    width: '100%',
    aspectRatio: 3.2,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    marginBottom: 10,
  },
  iconWrapper: {
    position: 'relative',
  },
  plusIcon: {
    position: 'absolute',
    bottom: -2,
    right: -6,
    backgroundColor: '#F9F9F9',
    borderRadius: 7,
    overflow: 'hidden'
  },
  addBtnText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  imgWrapper: {
    width: itemWidth,
    aspectRatio: 1.6,
    marginBottom: 10,
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  deleteIconBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FFF',
    borderRadius: 15,
  },
  warningContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  warningIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FDEBD0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#000',
    lineHeight: 20,
  },
  bottomBar: {
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#F2FBF6',
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 2,
  },
  submitButtonActive: {
    backgroundColor: '#1EAE53',
  },
  submitButtonInactive: {
    backgroundColor: '#DCDCDC',
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  submitButtonTextActive: {
    color: '#FFF',
  },
  submitButtonTextInactive: {
    color: '#FFF',
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    width: '80%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  alertIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -40,
  },
  alertSuccessBadge: {
    backgroundColor: '#1EAE53',
  },
  alertErrorBadge: {
    backgroundColor: '#E74C3C',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  alertButtonOK: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertButtonSuccess: {
    backgroundColor: '#1EAE53',
  },
  alertButtonError: {
    backgroundColor: '#E74C3C',
  },
  alertButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
