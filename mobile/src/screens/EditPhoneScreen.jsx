// หน้าแก้ไขเบอร์โทรศัพท์ของแม่บ้าน ปุ่มบันทึกกดได้เมื่อเบอร์เปลี่ยนไปจากเดิมและยาวอย่างน้อย 9 หลัก
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

export default function EditPhoneScreen({ route, navigation }) {
  const { showAlert } = useAlert();
  // รับข้อมูลเดิมมาจากหน้า Profile
  const { maidData } = route.params;

  // ข้อมูลตั้งต้น
  const initialPhone = maidData?.phone || '';

  // State สำหรับเก็บข้อมูลที่ผู้ใช้พิมพ์
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);

  // ตรวจสอบว่ามีการแก้ไขข้อมูลหรือยัง
  const hasChanges = phone.trim() !== initialPhone;

  // ตรวจสอบความถูกต้องของข้อมูล (ห้ามว่าง และควรมีความยาวประมาณ 10 หลัก)
  const isValid = phone.trim().length >= 9;

  // สามารถกดบันทึกได้ก็ต่อเมื่อ มีการเปลี่ยนแปลง และ ข้อมูลถูกต้อง
  const canSave = hasChanges && isValid;

  // ส่งเบอร์ใหม่ไปบันทึกที่ server โดยใช้อีเมลเป็นตัวอ้างอิง สำเร็จแล้วแสดงป๊อบอัพและกลับหน้าโปรไฟล์
  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      await apiClient.put('/api/members/profile/phone', {
        email: maidData.email,
        phone: phone.trim()
      });

      setSaving(false);
      showAlert('สำเร็จ', 'อัปเดตเบอร์โทรศัพท์เรียบร้อยแล้ว', [
        { 
          text: 'ตกลง', 
          onPress: () => {
            navigation.goBack();
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving phone:', error);
      setSaving(false);
      showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  // การ์ดช่องกรอกเบอร์ (พิมพ์ได้สูงสุด 10 หลัก) แล้วปุ่มบันทึกด้านล่าง
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.card}>
            
            <Text style={styles.label}>หมายเลขโทรศัพท์</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="08X-XXX-XXXX"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              maxLength={10}
            />

          </View>

          {/* ปุ่มบันทึก */}
          <TouchableOpacity 
            style={[styles.saveButton, canSave ? styles.saveButtonActive : styles.saveButtonInactive]}
            disabled={!canSave || saving}
            onPress={handleSave}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveButtonText}>บันทึก</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FAF0',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#333',
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  saveButtonActive: {
    backgroundColor: '#20A855', // สีเขียวเหมือนในรูปเป๊ะ
  },
  saveButtonInactive: {
    backgroundColor: '#D1D5DB', // สีเทา
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
