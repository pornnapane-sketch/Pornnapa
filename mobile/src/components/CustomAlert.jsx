// ป๊อบอัพกลางจอของแอป (กล่องขอบมน มีหัวข้อ / ข้อความ / ปุ่ม) ใช้แทน Alert.alert ของระบบ โดยรับค่ามาจาก AlertContext
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated
} from 'react-native';

export default function CustomAlert({ visible, title, message, buttons }) {
  // ยังไม่สั่งเปิดป๊อบอัพ ก็ไม่ต้องแสดงอะไร
  if (!visible) return null;

  return (
    // Modal โปร่งใส แสดงทับหน้าจอปัจจุบัน (เฟดเข้า) พื้นหลังหรี่มืดลง
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          
          {/* Title */}
          {title ? <Text style={styles.title}>{title}</Text> : null}
          
          {/* Message */}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          
          {/* Buttons Area */}
          <View style={styles.buttonContainer}>
            {buttons && buttons.length > 0 ? (
              buttons.map((btn, index) => {
                
                // Style selection based on button style
                let buttonStyle = styles.buttonDefault;
                let textStyle = styles.buttonTextDefault;

                if (btn.style === 'cancel') {
                  buttonStyle = styles.buttonCancel;
                  textStyle = styles.buttonTextCancel;
                } else if (btn.style === 'destructive') {
                  buttonStyle = styles.buttonDestructive;
                  textStyle = styles.buttonTextDestructive;
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      buttonStyle,
                      { flex: 1, marginHorizontal: 4 }
                    ]}
                    onPress={btn.onPress}
                    activeOpacity={0.7}
                  >
                    <Text style={textStyle}>{btn.text || 'ตกลง'}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              // Default OK button if none provided
              <TouchableOpacity
                style={[styles.button, styles.buttonDefault, { flex: 1 }]}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonTextDefault}>ตกลง</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dim background
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16, // ขอบมน
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0E6643', // สีเขียวแอป
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#444',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Default Style (Green)
  buttonDefault: {
    backgroundColor: '#0E6643',
  },
  buttonTextDefault: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Cancel Style (Grey)
  buttonCancel: {
    backgroundColor: '#E5E7EB',
  },
  buttonTextCancel: {
    color: '#555',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Destructive Style (Red)
  buttonDestructive: {
    backgroundColor: '#E74C3C',
  },
  buttonTextDestructive: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
