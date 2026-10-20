// รายงานก่อนปฏิบัติงาน: ถ่าย/เลือกรูปสภาพห้องก่อนทำความสะอาดแยกตามห้อง/บริการที่จอง (ห้องละ 2-4 รูป) แล้วอัปโหลดไป server จากนั้นไปหน้ารายงานหลังปฏิบัติงาน
// รูปที่เคยอัปไว้แล้วจะถูกดึงกลับมาแสดงเมื่อเปิดหน้านี้อีกครั้ง และอัปโหลดเฉพาะรูปใหม่
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useWorkPhotos from '../hooks/useWorkPhotos';

const { width } = Dimensions.get('window');
const itemWidth = (width - 90) / 2; 

export default function WorkReportBeforeScreen({ route, navigation }) {
  const { bookingId, services } = route.params || {};
  const insets = useSafeAreaInsets();
  
  const { zones, photos, picking, uploading, progress, isComplete, takePhoto, pickImage, removePhoto, uploadPending } =
    useWorkPhotos({ bookingId, services, photoType: 'before' });
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [alertData, setAlertData] = useState({ visible: false, title: '', message: '', type: 'success', onConfirm: null });

  // เปิดหน้าต่างให้เลือกว่าจะถ่ายรูปหรือเลือกจากคลัง สำหรับห้องที่กด
  const handleSelectPhoto = (zone) => {
    setSelectedZone(zone);
    setModalVisible(true);
  };

  // อัปโหลดรูปใหม่ของทุกห้อง (ชนิด before) สำเร็จแล้วไปหน้ารายงานหลังปฏิบัติงาน ถ้าพลาดแสดงข้อความผิดพลาด (กดบันทึกซ้ำจะอัปเฉพาะรูปที่เหลือ)
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await uploadPending();
      setLoading(false);
      setAlertData({
        visible: true,
        type: 'success',
        title: 'สำเร็จ',
        message: 'บันทึกรูปภาพก่อนปฏิบัติงานเรียบร้อยแล้ว',
        onConfirm: () => navigation.navigate('WorkReportAfter', { bookingId, services })
      });
    } catch (error) {
      console.error('Upload error:', error);
      setLoading(false);
      setAlertData({
        visible: true,
        type: 'error',
        title: 'ข้อผิดพลาด',
        message: 'ไม่สามารถอัปโหลดรูปภาพได้ กรุณากดบันทึกอีกครั้ง',
        onConfirm: null
      });
    }
  };


  // หัวเรื่อง รายการห้อง/บริการพร้อมช่องรูป ปุ่มเพิ่มรูป และปุ่มส่งรายงาน (กดได้เมื่อทุกห้องมีรูปครบ)
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายงานการทำงาน</Text>
        <TouchableOpacity style={styles.alertButton} onPress={() => navigation.navigate('ReportProblem', { bookingId })}>
          <Ionicons name="alert-circle-outline" size={24} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.mainTitle}>รูปก่อนปฏิบัติงาน</Text>
          
          {zones.map((zone, idx) => (
            <View key={idx} style={styles.zoneContainer}>
              <Text style={styles.zoneTitle}>{zone} :</Text>
              
              <View style={styles.photoRow}>
                {photos[zone]?.map((photo, imgIdx) => (
                  <View key={photo.uri} style={styles.imgWrapper}>
                    <TouchableOpacity onPress={() => removePhoto(zone, imgIdx)}>
                      <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} resizeMethod="resize" fadeDuration={0} />
                      <View style={styles.deleteIconBadge}>
                        <Ionicons name="close-circle" size={24} color="#E74C3C" />
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
                
                {(!photos[zone] || photos[zone].length < 4) ? (
                  <TouchableOpacity 
                    style={(!photos[zone] || photos[zone].length === 0) ? styles.addBtnFull : styles.addBtn} 
                    onPress={() => handleSelectPhoto(zone)}
                  >
                    <View style={styles.iconWrapper}>
                      <Ionicons name="camera-outline" size={32} color="#555" />
                      <Ionicons name="add-circle" size={14} color="#555" style={styles.plusIcon} />
                    </View>
                    <Text style={styles.addBtnText}>เพิ่มรูปภาพ</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.warningContainer}>
          <View style={styles.warningIcon}>
            <Text style={{color: '#F39C12', fontWeight: 'bold'}}>!</Text>
          </View>
          <Text style={styles.warningText}>
            กรุณาอัปโหลดรูปภาพอย่างน้อยพื้นที่ละ 2 รูป เพื่อใช้เป็นหลักฐานยืนยันความเรียบร้อยและป้องกันข้อพิพาท
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity 
          style={[styles.submitButton, isComplete && !loading ? styles.submitButtonActive : styles.submitButtonInactive]}
          disabled={!isComplete || loading}
          onPress={handleSubmit}
        >
          {loading ? (
            <View style={styles.submitLoadingRow}>
              <ActivityIndicator color="#FFF" />
              {uploading && progress.total > 0 ? (
                <Text style={styles.submitProgressText}>กำลังอัปโหลด {progress.done}/{progress.total}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.submitButtonText, isComplete ? styles.submitButtonTextActive : styles.submitButtonTextInactive]}>
              บันทึกรูปภาพ
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {picking ? (
        <View style={styles.pickingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      ) : null}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เพิ่มรูปภาพ</Text>
            <Text style={styles.modalSubtitle}>เลือกวิธีที่คุณต้องการเพิ่มรูปภาพ</Text>
            <View style={styles.modalOptions}>
              <TouchableOpacity style={styles.modalOptionBtn} onPress={() => { setModalVisible(false); takePhoto(selectedZone); }}>
                <Ionicons name="camera" size={36} color="#0E6643" />
                <Text style={styles.modalOptionText}>ถ่ายรูป</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOptionBtn} onPress={() => { setModalVisible(false); pickImage(selectedZone); }}>
                <Ionicons name="images" size={36} color="#0E6643" />
                <Text style={styles.modalOptionText}>เลือกจากอัลบั้ม</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancelText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
  alertButton: {
    padding: 5,
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
  mainTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  zoneContainer: {
    marginBottom: 20,
  },
  zoneTitle: {
    fontSize: 14,
    color: '#000',
    marginBottom: 10,
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
  submitLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitProgressText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  pickingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  modalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  modalOptionBtn: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#F2FBF6',
    width: '48%',
    borderWidth: 1,
    borderColor: '#E8F5EE'
  },
  modalOptionText: {
    marginTop: 12,
    fontSize: 15,
    color: '#0E6643',
    fontWeight: 'bold',
  },
  modalCancelBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
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
