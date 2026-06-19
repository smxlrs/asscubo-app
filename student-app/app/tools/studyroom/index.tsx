import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { STUDY_ROOMS, fetchStudyRoomStatus, StudyRoom, StudyRoomStatus } from '../../../lib/studyroom';

type RoomWithStatus = StudyRoom & {
  status: StudyRoomStatus;
};

export default function StudyRoomsScreen() {
  const { colors, t } = useTheme();
  
  const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const roomPromises = STUDY_ROOMS.map(async (room) => {
        const status = await fetchStudyRoomStatus(room);
        return {
          ...room,
          status,
        };
      });
      const resolved = await Promise.all(roomPromises);
      setRooms(resolved);
    } catch (e) {
      console.error('Failed to load study room occupancies:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getOccupancyColor = (percent: number) => {
    if (percent < 50) return '#10B981'; // Green (Safe)
    if (percent < 85) return '#F59E0B'; // Orange (Medium)
    return '#EF4444'; // Red (Busy)
  };

  const handleBookSeat = (room: RoomWithStatus) => {
    // Open the reservation page inside the app using our clean in-app WebView
    router.push(`/article/web?url=${encodeURIComponent(room.affluencesUrl)}&title=${encodeURIComponent(room.nameCn)}` as any);
  };

  const handleNavigate = (room: RoomWithStatus) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(room.address + ', ' + room.nameIt)}`;
    Linking.openURL(url).catch(err => console.log('Failed to open maps:', err));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>自习室与图书馆</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Disclaimer Banner */}
      <View style={[styles.disclaimerBanner, { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          仅供参考，数据和预约服务来自{' '}
          <Text
            style={[styles.disclaimerLink, { color: colors.primary }]}
            onPress={() => router.push('/article/web?url=https%3A%2F%2Faffluences.com%2Fit%2Fsites%3Fplaylist_id%3D32&title=Affluences' as any)}
          >
            affluences
          </Text>
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const barColor = getOccupancyColor(item.status.occupancyPercent);
            return (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Header Information */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.titleText, { color: colors.textPrimary }]}>{item.nameCn}</Text>
                    <Text style={[styles.subTitleText, { color: colors.textSecondary }]}>{item.nameIt}</Text>
                  </View>
                  <View style={[
                    styles.statusTag, 
                    { backgroundColor: item.status.isOpen ? '#10B9811A' : '#EF44441A' }
                  ]}>
                    <Text style={[
                      styles.statusTagText, 
                      { color: item.status.isOpen ? '#10B981' : '#EF4444' }
                    ]}>
                      {item.status.isOpen ? '开放中' : '已关闭'}
                    </Text>
                  </View>
                </View>

                {/* Meta details */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.status.openingHours}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{item.address}</Text>
                  </View>
                </View>

                {item.status.isOpen && (
                  <View style={styles.occupancySection}>
                    <View style={styles.occupancyHeader}>
                      <Text style={[styles.occupancyLabel, { color: colors.textSecondary }]}>
                        上座率：<Text style={{ fontWeight: 'bold', color: barColor }}>{item.status.occupancyPercent}%</Text>
                      </Text>
                      <Text style={[styles.occupancyLabel, { color: colors.textSecondary }]}>
                        剩余 <Text style={{ fontWeight: 'bold', color: barColor }}>{item.status.availableSeats}</Text> / {item.capacity} 个座位
                      </Text>
                    </View>
                    
                    {/* Progress Bar */}
                    <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
                      <View style={[
                        styles.progressBarFill, 
                        { width: `${item.status.occupancyPercent}%`, backgroundColor: barColor }
                      ]} />
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
                    onPress={() => handleBookSeat(item)}
                  >
                    <MaterialCommunityIcons name="calendar-check" size={16} color={colors.primary} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>预约座位</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleNavigate(item)}
                  >
                    <MaterialCommunityIcons name="navigation" size={16} color="#FFFFFF" />
                    <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>前往</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <View style={{ height: 20 }} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 8,
    marginVertical: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 50,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  titleText: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
    marginBottom: 2,
  },
  subTitleText: {
    fontSize: 12,
    lineHeight: 16,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  metaRow: {
    gap: 4,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  occupancySection: {
    marginBottom: 16,
  },
  occupancyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  occupancyLabel: {
    fontSize: 12,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  disclaimerBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  disclaimerLink: {
    textDecorationLine: 'underline',
    fontWeight: 'bold',
  },
});
