// หน้าแก้ไขชื่อ-นามสกุลของแม่บ้าน (คำนำหน้า / ชื่อ / นามสกุล) ปุ่มบันทึกกดได้เมื่อมีการแก้ไขและไม่เว้นว่างช่องใด
import React, { useState, useEffect } from 'react';
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
import { Picker } from '@react-native-picker/picker';
import apiClient from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

export default function EditNameScreen({ route, navigation }) {
  const { showAlert } = useAlert();
  // รับข้อมูลเดิมมาจากหน้า Profile
  const { maidData } = route.params;

  // ข้อมูลตั้งต้น
  const initialPrefix = maidData?.title_prefix || '';
  const initialFirstName = maidData?.first_name || '';
  const initialLastName = maidData?.last_name || '';

  // State สำหรับเก็บข้อมูลที่ผู้ใช้พิมพ์
  const [titlePrefix, setTitlePrefix] = useState(initialPrefix);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);

  const [saving, setSaving] = useState(false);

  // ตรวจสอบว่ามีการแก้ไขข้อมูลหรือยัง
  const hasChanges = 
    titlePrefix !== initialPrefix || 
    firstName.trim() !== initialFirstName || 
    lastName.trim() !== initialLastName;

  // ตรวจสอบความถูกต้องของข้อมูล (ห้ามว่าง)
  const isValid = titlePrefix !== '' && firstName.trim() !== '' && lastName.trim() !== '';

  // สามารถกดบันทึกได้ก็ต่อเมื่อ มีการเปลี่ยนแปลง และ ข้อมูลไม่ว่าง
  const canSave = hasChanges && isValid;

  // ส่งชื่อใหม่ไปบันทึกที่ server โดยใช้อีเมลเป็นตัวอ้างอิง สำเร็จแล้วแสดงป๊อบอัพและกลับหน้าโปรไฟล์ (หน้าโปรไฟล์โหลดข้อมูลใหม่เอง)
  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      await apiClient.put('/api/members/profile/name', {
        email: maidData.email,
        title_prefix: titlePrefix,
        first_name: firstName.trim(),
        last_name: lastName.trim()
      });

      setSaving(false);
      showAlert('สำเร็จ', 'อัปเดตชื่อ-นามสกุลเรียบร้อยแล้ว', [
        { 
          text: 'ตกลง', 
          onPress: () => {
            navigation.goBack();
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving name:', error);
      setSaving(false);
      showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  // ฟอร์มในการ์ด: เลือกคำนำหน้า, กรอกชื่อ, กรอกนามสกุล แล้วปุ่มบันทึกด้านล่าง (ปุ่มเทาเมื่อกดไม่ได้)
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.card}>
            
            {/* คำนำหน้า */}
            <Text style={styles.label}>คำนำหน้า</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={titlePrefix}
                onValueChange={(itemValue) => setTitlePrefix(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="คำนำหน้า" value="" color="#999" />
                <Picker.Item label="นาย" value="นาย" />
                <Picker.Item label="นาง" value="นาง" />
                <Picker.Item label="นางสาว" value="นางสาว" />
              </Picker>
            </View>

            {/* ชื่อ */}
            <Text style={styles.label}>ชื่อ</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="ชื่อ"
              placeholderTextColor="#999"
            />

            {/* นามสกุล */}
            <Text style={styles.label}>นามสกุล</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="นามสกุล"
              placeholderTextColor="#999"
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
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
    backgroundColor: '#20A855', // สีเขียวเหมือน
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
