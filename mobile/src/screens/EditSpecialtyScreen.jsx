// หน้าแก้ไขทักษะความชำนาญพิเศษ: เลือกจากรายการแนะนำได้หลายอย่าง เก็บเป็นข้อความคั่นด้วยจุลภาคในฐานข้อมูล
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

// รายการทักษะแนะนำ
const RECOMMENDED_SKILLS = [
  'ซักรีดเสื้อผ้า',
  'ทำอาหาร',
  'จัดสวนเบื้องต้น',
  'ดูแลเด็ก',
  'ดูแลผู้สูงอายุ',
  'ดูแลสัตว์เลี้ยง',
  'ทำความสะอาดแบบล้ำลึก'
];

export default function EditSpecialtyScreen({ route, navigation }) {
  const { showAlert } = useAlert();
  const { maidData } = route.params;

  // แปลงสตริง "ทำอาหาร,จัดสวน" ให้เป็น Array ['ทำอาหาร', 'จัดสวน']
  // ถ้าเป็น NULL หรือว่าง จะได้เป็น Array เปล่า []
  const initialSkills = maidData?.specialty 
    ? maidData.specialty.split(',').map(s => s.trim()).filter(s => s.length > 0) 
    : [];

  const [selectedSkills, setSelectedSkills] = useState(initialSkills);
  const [saving, setSaving] = useState(false);

  // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
  // เช็คด้วยการเรียงลำดับแล้วแปลงเป็นสตริงเทียบกัน เพื่อไม่ให้ลำดับมีผล
  const currentSkillsStr = [...selectedSkills].sort().join(',');
  const initialSkillsStr = [...initialSkills].sort().join(',');
  const hasChanges = currentSkillsStr !== initialSkillsStr;

  // กดชิปทักษะเพื่อสลับ: ถ้าเลือกอยู่แล้วให้เอาออก ถ้ายังไม่เลือกให้เพิ่มเข้า
  const toggleSkill = (skill) => {
    if (selectedSkills.includes(skill)) {
      // ถ้ามีอยู่แล้ว ให้เอาออก
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      // ถ้ายังไม่มี ให้เพิ่มเข้าไป
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  // รวมทักษะที่เลือกเป็นข้อความเดียวส่งไปบันทึกที่ server (ถ้าไม่เลือกเลยจะส่งค่าว่าง) สำเร็จแล้วกลับหน้าโปรไฟล์
  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    try {
      // แปลงกลับเป็น comma-separated string เช่น "ทำอาหาร,จัดสวน"
      // ถ้า array ว่างเปล่า จะได้สตริงว่าง ''
      const specialtyString = selectedSkills.join(',');

      await apiClient.put('/api/members/profile/specialty', {
        email: maidData.email,
        specialty: specialtyString
      });

      setSaving(false);
      showAlert('สำเร็จ', 'อัปเดตทักษะความชำนาญเรียบร้อยแล้ว', [
        { 
          text: 'ตกลง', 
          onPress: () => {
            navigation.goBack();
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving specialty:', error);
      setSaving(false);
      showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  // ชิปทักษะแนะนำที่กดเลือกได้หลายอัน (อันที่เลือกอยู่แสดงสีเข้ม) แล้วปุ่มบันทึกด้านล่าง
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.card}>
          <Text style={styles.instructionText}>
            เลือกทักษะความชำนาญพิเศษของคุณ (สามารถเลือกได้มากกว่า 1 ข้อ หรือไม่ต้องเลือกเลยก็ได้)
          </Text>

          <View style={styles.chipContainer}>
            {RECOMMENDED_SKILLS.map((skill, index) => {
              const isSelected = selectedSkills.includes(skill);
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.chip, isSelected ? styles.chipSelected : styles.chipUnselected]}
                  onPress={() => toggleSkill(skill)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : styles.chipTextUnselected]}>
                    {skill}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ปุ่มบันทึก */}
        <TouchableOpacity 
          style={[styles.saveButton, hasChanges ? styles.saveButtonActive : styles.saveButtonInactive]}
          disabled={!hasChanges || saving}
          onPress={handleSave}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>บันทึก</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FAF0',
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
  instructionText: {
    fontSize: 15,
    color: '#555',
    marginBottom: 20,
    lineHeight: 22,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4, // ชดเชย margin ของ chip
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    margin: 6,
    borderWidth: 1,
  },
  chipUnselected: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  chipSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#20A855', // สีเขียวเข้ม
  },
  chipText: {
    fontSize: 14,
  },
  chipTextUnselected: {
    color: '#666',
  },
  chipTextSelected: {
    color: '#20A855',
    fontWeight: 'bold',
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  saveButtonActive: {
    backgroundColor: '#20A855', // สีเขียว
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
