// แจ้งปัญหาขั้นที่ 1: เลือกสาเหตุที่ไม่สามารถปฏิบัติงานได้ (ถ้าเลือก อื่นๆ ต้องพิมพ์รายละเอียด) แล้วไปหน้าแนบรูปหลักฐาน
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';

export default function ReportProblemScreen({ route, navigation }) {
  const { bookingId } = route.params || {};
  const insets = useSafeAreaInsets();
  
  const [selectedReason, setSelectedReason] = useState('');
  const [otherDetail, setOtherDetail] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertData, setAlertData] = useState({ visible: false, title: '', message: '', type: 'success', onConfirm: null });

  // รายการสาเหตุให้เลือก
  const reasons = [
    'ติดต่อผู้ว่าจ้างไม่ได้ / ไม่มีผู้เปิดประตู',
    'หาพิกัดสถานที่ปฏิบัติงานไม่พบ',
    'สภาพหน้างานไม่ปลอดภัย / ไม่ตรงกับที่ระบุ',
    'ผู้ว่าจ้างขอยกเลิกกะทันหันที่หน้างาน',
    'อื่นๆ'
  ];

  // ตรวจว่าเลือกสาเหตุแล้ว (และกรอกรายละเอียดถ้าเลือก อื่นๆ) แล้วไปหน้าแนบรูปหลักฐาน ตอนนี้ยังไม่ส่งข้อมูลไป server
  const handleSubmit = async () => {
    if (!selectedReason) {
      setAlertData({
        visible: true,
        type: 'error',
        title: 'แจ้งเตือน',
        message: 'กรุณาเลือกสาเหตุที่ไม่สามารถปฏิบัติงานได้',
        onConfirm: null
      });
      return;
    }

    if (selectedReason === 'อื่นๆ' && !otherDetail.trim()) {
      setAlertData({
        visible: true,
        type: 'error',
        title: 'แจ้งเตือน',
        message: 'กรุณาระบุรายละเอียดเพิ่มเติมสำหรับสาเหตุอื่นๆ',
        onConfirm: null
      });
      return;
    }

    navigation.navigate('ReportProblemEvidence', {
      bookingId: bookingId,
      reasonType: selectedReason,
      reasonText: otherDetail.trim()
    });
  };

  // รายการสาเหตุแบบเลือกได้ทีละข้อ ช่องรายละเอียดเพิ่มเติมเมื่อเลือก อื่นๆ และปุ่มดำเนินการต่อ
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แจ้งปัญหา</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.mainTitle}>สาเหตุที่ไม่สามารถปฏิบัติงานได้</Text>
          
          {reasons.map((reason, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.radioContainer}
              onPress={() => setSelectedReason(reason)}
            >
              <View style={styles.radioCircle}>
                {selectedReason === reason ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={styles.radioText}>{reason}</Text>
            </TouchableOpacity>
          ))}

          {selectedReason === 'อื่นๆ' && (
            <>
              <Text style={styles.detailTitle}>รายละเอียดเพิ่มเติม</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder="โปรดระบุรายละเอียดเพิ่มเติม..."
                placeholderTextColor="#999"
                value={otherDetail}
                onChangeText={setOtherDetail}
                textAlignVertical="top"
              />
            </>
          )}
          
          <TouchableOpacity 
            style={[styles.submitButton, selectedReason ? styles.submitButtonActive : styles.submitButtonInactive]}
            disabled={loading || !selectedReason}
            onPress={handleSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>ดำเนินการต่อ</Text>
            )}
          </TouchableOpacity>
        </View>
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
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0E6643',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0E6643',
  },
  radioText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 20,
    marginBottom: 10,
  },
  textArea: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    height: 120,
    marginBottom: 30,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonActive: {
    backgroundColor: '#1EAE53',
  },
  submitButtonInactive: {
    backgroundColor: '#DCDCDC',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
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
  }
});
