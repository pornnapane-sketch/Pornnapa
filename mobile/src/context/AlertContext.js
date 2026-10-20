// Context กลางของป๊อบอัพ: หน้าไหนก็เรียก showAlert(หัวข้อ, ข้อความ, ปุ่ม) ได้ แล้วแสดงด้วย CustomAlert
import React, { createContext, useState, useContext } from 'react';
import CustomAlert from '../components/CustomAlert';

// Create Context
const AlertContext = createContext();

// Hook to use Alert Context
export const useAlert = () => useContext(AlertContext);

// Provider ครอบทั้งแอปไว้ใน App.js: เก็บสถานะป๊อบอัพและแสดง CustomAlert หนึ่งตัวที่ใช้ร่วมกันทุกหน้า
export const AlertProvider = ({ children }) => {
  // สถานะป๊อบอัพ: แสดงอยู่ไหม, หัวข้อ, ข้อความ และรายการปุ่ม
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  // เปิดป๊อบอัพ: ปุ่มทุกปุ่มถูกห่อให้ปิดป๊อบอัพก่อนแล้วค่อยทำงานเดิมของปุ่ม (ถ้าไม่ส่งปุ่มมาจะมีปุ่ม ตกลง ปุ่มเดียว)
  const showAlert = (title, message, buttons = []) => {
    // Wrap button onPress functions to also close the alert automatically
    // just like React Native's default Alert.alert works.
    const wrappedButtons = buttons.length > 0 ? buttons.map(btn => ({
      ...btn,
      onPress: () => {
        // Close alert first
        setAlertConfig(prev => ({ ...prev, visible: false }));
        // Then run the original onPress if it exists
        if (btn.onPress) {
          // Add a slight delay so the modal closing animation can start 
          // before executing heavy functions (like navigation)
          setTimeout(() => btn.onPress(), 100);
        }
      }
    })) : [
      {
        text: 'ตกลง',
        onPress: () => setAlertConfig(prev => ({ ...prev, visible: false }))
      }
    ];

    setAlertConfig({
      visible: true,
      title,
      message,
      buttons: wrappedButtons
    });
  };

  // ส่ง showAlert ให้ทุกหน้าที่เรียก useAlert และวาง CustomAlert ไว้ท้ายสุดเพื่อให้ทับหน้าจอทุกหน้า
  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
      />
    </AlertContext.Provider>
  );
};
