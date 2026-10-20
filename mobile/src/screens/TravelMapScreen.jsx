// หน้านำทางหลังกดเริ่มเดินทาง: แผนที่แสดงตำแหน่งแม่บ้านและเส้นทางขับรถไปสถานที่ทำงาน พร้อมระยะทาง/เวลา ปุ่มโทรหาผู้ว่าจ้าง ปุ่มแจ้งปัญหา และปุ่มถึงสถานที่แล้ว
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TravelMapScreen({ route, navigation }) {
  const { bookingId, lat, lng, location, customerName, customerPhone } = route.params;
  const insets = useSafeAreaInsets();
  
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);

  // ใส่ API KEY ตรงนี้
  const GOOGLE_MAPS_APIKEY = 'AIzaSyBJmQqDKSj9cZGZzWzCS2dtmKZ-ThTlddE';

  // ขอสิทธิ์ใช้ตำแหน่งแล้วอ่านตำแหน่งปัจจุบันของแม่บ้าน (ถ้าไม่อนุญาตจะแจ้งเตือนและหยุดโหลด)
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('แจ้งเตือน', 'กรุณาอนุญาตให้เข้าถึงตำแหน่งที่ตั้ง เพื่อนำทาง');
        setLoading(false);
        return;
      }

      let locationResult = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
      });
      setLoading(false);
    })();
  }, []);

  // ไปหน้าติดต่อผู้ว่าจ้าง (แสดงชื่อและเบอร์ให้กดโทร)
  const handleCall = () => {
    navigation.navigate('ContactEmployer', {
      customerName: customerName,
      customerPhone: customerPhone
    });
  };

  // ถึงสถานที่ปฏิบัติงานแล้ว: ไปหน้ารายงานงานก่อนปฏิบัติงาน พร้อมส่งรายการบริการไปด้วย
  const handleArrived = () => {
    navigation.navigate('WorkReportBefore', {
      bookingId: bookingId,
      services: route.params.services
    });
  };

  // ระหว่างยังหาตำแหน่งของแม่บ้านไม่ได้ แสดงวงกลมหมุนและข้อความรอ
  if (loading || !currentLocation) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0E6643" />
        <Text style={{ marginTop: 10 }}>กำลังค้นหาตำแหน่งของคุณ...</Text>
      </View>
    );
  }

  // พิกัดปลายทางจากข้อมูลงาน (แปลงเป็นตัวเลข)
  const destination = {
    latitude: parseFloat(lat),
    longitude: parseFloat(lng)
  };

  // แผนที่เต็มจอ: หมุดปลายทาง + เส้นทางขับรถจากตำแหน่งปัจจุบัน (Google Directions) และการ์ดด้านล่างที่มีปุ่มโทรกับปุ่มถึงสถานที่แล้ว
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>กำลังเดินทาง</Text>
        <TouchableOpacity style={styles.alertButton} onPress={() => navigation.navigate('ReportProblem', { bookingId })}>
          <Ionicons name="alert-circle-outline" size={24} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: (currentLocation.latitude + destination.latitude) / 2,
          longitude: (currentLocation.longitude + destination.longitude) / 2,
          latitudeDelta: Math.abs(currentLocation.latitude - destination.latitude) * 1.5 || 0.02,
          longitudeDelta: Math.abs(currentLocation.longitude - destination.longitude) * 1.5 || 0.02,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        <Marker coordinate={destination} title={location} description="เป้าหมาย" />

        {currentLocation && destination && (
          <MapViewDirections
            origin={currentLocation}
            destination={destination}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor="#1E3A8A" // สีน้ำเงินเข้มแบบในตัวอย่าง
            language="th"
            mode="DRIVING"
            onError={(errorMessage) => {
              console.log('Directions error: ', errorMessage);
              Alert.alert('Directions Error', String(errorMessage));
            }}
            onReady={(result) => {
              setDistance(result.distance);
              setDuration(result.duration);
            }}
          />
        )}
      </MapView>

      <View style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.infoRow}>
          <View style={styles.textContainer}>
            <Text style={styles.locationTitle}>{location}</Text>
            {distance > 0 ? (
              <Text style={styles.distanceText}>
                ระยะทาง {distance.toFixed(1)} กม. • เดินทาง {Math.ceil(duration)} นาที
              </Text>
            ) : null}
            <Text style={styles.customerName}>คุณ{customerName || 'ลูกค้า'}</Text>
          </View>
          <TouchableOpacity style={styles.phoneButton} onPress={handleCall}>
            <Ionicons name="call" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.arrivedButton} onPress={handleArrived}>
          <Text style={styles.arrivedButtonText}>ถึงสถานที่ปฏิบัติงานแล้ว</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF'
  },
  centerContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center'
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
  map: {
    flex: 1,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  textContainer: {
    flex: 1,
    paddingRight: 10
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5
  },
  distanceText: {
    fontSize: 14,
    color: '#0E6643',
    fontWeight: '500',
    marginBottom: 5
  },
  customerName: {
    fontSize: 14,
    color: '#666'
  },
  phoneButton: {
    backgroundColor: '#A8E6CF', // สีเขียวอ่อนแบบวงกลม
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center'
  },
  arrivedButton: {
    backgroundColor: '#27AE60',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center'
  },
  arrivedButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
