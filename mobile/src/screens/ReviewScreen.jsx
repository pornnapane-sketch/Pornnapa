// หน้าคะแนนรีวิว: สรุปคะแนนเฉลี่ยและจำนวนรีวิว แถบกรองตามจำนวนดาว และรายการรีวิวจากลูกค้า
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';

export default function ReviewScreen({ route, navigation }) {
  const { maidData } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewData, setReviewData] = useState({
    avgRating: 0,
    totalReviews: 0,
    reviews: []
  });
  const [filter, setFilter] = useState('all'); // 'all', 5, 4, 3, 2, 1

  useEffect(() => {
    fetchReviews();
  }, []);

  // ดึงรีวิวทั้งหมดและคะแนนเฉลี่ยของแม่บ้านคนนี้จาก server
  const fetchReviews = async () => {
    try {
      // ดึงข้อมูลจาก API ที่สร้างไว้
      const response = await apiClient.get(`/api/members/profile/reviews?maid_id=${maidData.maid_id}`);
      setReviewData(response.data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReviews();
  };

  // กรองรีวิวตามแท็บที่เลือก
  const filteredReviews = reviewData.reviews.filter(r => {
    if (filter === 'all') return true;
    return r.rating === filter;
  });

  // แปลงวันที่เป็นข้อความไทย (ปี พ.ศ.)
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  };

  // วาดดาว 5 ดวง ดวงที่ไม่เกินคะแนนเป็นสีเหลือง ที่เหลือเป็นเส้นขอบ
  const renderStars = (rating, size = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={size}
          color={i <= rating ? "#FDE047" : "#E5E7EB"}
          style={{ marginHorizontal: 2 }}
        />
      );
    }
    return <View style={styles.starRow}>{stars}</View>;
  };

  // การ์ดสรุป: คะแนนเฉลี่ย ดาว และจำนวนรีวิวทั้งหมด
  const renderSummaryCard = () => (
    <View style={styles.summaryCard}>
      <Text style={styles.avgScore}>{reviewData.avgRating.toFixed(1)}</Text>
      <View style={{ marginBottom: 12 }}>
        {renderStars(Math.round(reviewData.avgRating), 32)}
      </View>
      <Text style={styles.summaryText}>
        คะแนนเฉลี่ยจาก {reviewData.totalReviews} งานที่ให้บริการ
      </Text>
    </View>
  );

  const getReviewCount = (ratingId) => {
    if (ratingId === 'all') {
      return reviewData.reviews.length;
    }
    return reviewData.reviews.filter(r => Math.round(r.rating) === ratingId).length;
  };

  // แท็บกรองรีวิวตามจำนวนดาว (ทั้งหมด / 5 / 4 / 3 / 2 / 1)
  const renderFilterTabs = () => {
    const tabs = [
      { id: 'all', label: 'ทั้งหมด' },
      { id: 5, label: '5' },
      { id: 4, label: '4' },
      { id: 3, label: '3' },
      { id: 2, label: '2' },
      { id: 1, label: '1' }
    ];

    return (
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={tabs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                filter === item.id && styles.filterTabActive
              ]}
              onPress={() => setFilter(item.id)}
            >
              {item.id !== 'all' && (
                <Ionicons name="star" size={16} color="#FDE047" style={{ marginRight: 4 }} />
              )}
              <Text style={[
                styles.filterTabText,
                filter === item.id && styles.filterTabTextActive
              ]}>
                {item.label} ({getReviewCount(item.id)})
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  // วาดรีวิว 1 รายการ: ชื่อลูกค้า วันที่ ดาว และข้อความรีวิว
  const renderReviewItem = ({ item }) => {
    // ใช้ตัวอักษรแรกของชื่อเป็นอวาตาร์
    const initial = item.fullname ? item.fullname.charAt(0).toUpperCase() : 'U';
    
    // สร้างสีสุ่มแบบสวยๆ สำหรับพื้นหลังอวาตาร์
    const colors = ['#81C784', '#64B5F6', '#BA68C8', '#FF8A65', '#4DB6AC'];
    const bgColor = colors[item.review_id % colors.length] || colors[0];

    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={[styles.avatar, { backgroundColor: bgColor }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.reviewInfo}>
            <Text style={styles.reviewerName}>{item.fullname || 'ลูกค้า'}</Text>
            <Text style={styles.reviewDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View>
            {renderStars(item.rating, 16)}
          </View>
        </View>
        {item.review_text ? (
          <Text style={styles.reviewComment}>{item.review_text}</Text>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0E6643" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#0E6643" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>คะแนนรีวิว</Text>
      </View>

      <FlatList
        data={filteredReviews}
        keyExtractor={(item) => item.review_id.toString()}
        renderItem={renderReviewItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E6643']} tintColor="#0E6643" />
        }
        ListHeaderComponent={() => (
          <>
            {renderSummaryCard()}
            {renderFilterTabs()}
          </>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>ยังไม่มีคะแนนรีวิว</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

// สไตล์ของหน้านี้: สี ขนาด และระยะห่างของแต่ละส่วนประกอบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2FBF4', // สีพื้นหลังเขียวอ่อน
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2FBF4',
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  avgScore: {
    fontSize: 48,
    fontWeight: '300',
    color: '#000',
    marginBottom: 8,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#A7F3D0', // พื้นหลังเขียวอ่อนตอนเลือก
    borderWidth: 1,
    borderColor: '#0E6643',
  },
  filterTabText: {
    fontSize: 14,
    color: '#555',
  },
  filterTabTextActive: {
    color: '#0E6643',
    fontWeight: 'bold',
  },
  reviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reviewInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#888',
  },
  reviewComment: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  }
});
