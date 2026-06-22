import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, FlatList, RefreshControl, Animated, TextInput, Modal, BackHandler, Platform } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { STUDY_ROOMS, fetchStudyRoomStatus, StudyRoom, StudyRoomStatus } from '../../../lib/studyroom';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RoomWithStatus = StudyRoom & {
  status: StudyRoomStatus;
};

export default function StudyRoomsScreen() {
  const { colors, t } = useTheme();
  const navigation = useNavigation();
  const [headerHeight, setHeaderHeight] = useState(142);
  
  const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [favorites, setFavorites] = useState<string[]>([]);
  const FAVORITES_KEY = '@ag_favorite_studyrooms';

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favsJson = await AsyncStorage.getItem(FAVORITES_KEY);
        if (favsJson) {
          setFavorites(JSON.parse(favsJson));
        }
      } catch (e) {
        console.warn('Failed to load favorite studyrooms:', e);
      }
    };
    loadFavorites();
  }, []);

  const toggleFavorite = async (roomId: string) => {
    try {
      let newFavorites = [...favorites];
      const isFav = newFavorites.includes(roomId);
      if (isFav) {
        newFavorites = newFavorites.filter(id => id !== roomId);
        triggerToast('已取消收藏');
      } else {
        newFavorites.push(roomId);
        triggerToast('已收藏并置顶');
      }
      setFavorites(newFavorites);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch (e) {
      console.warn('Failed to save favorite studyrooms:', e);
    }
  };

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCampus, setSelectedCampus] = useState('all');
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [filterBooking, setFilterBooking] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const getRoomCampus = (address: string): string => {
    const addr = address.toLowerCase();
    if (addr.includes('forlì') || addr.includes('forli')) return 'Forlì';
    if (addr.includes('rimini')) return 'Rimini';
    if (addr.includes('ravenna')) return 'Ravenna';
    if (addr.includes('cesena') || addr.includes('cesenatico')) return 'Cesena';
    if (addr.includes('imola')) return 'Imola';
    if (addr.includes('ozzano')) return 'Ozzano';
    return 'Bologna';
  };

  const getCampusLabel = (campus: string) => {
    const c = campus.toLowerCase();
    if (c === 'bologna') return '博洛尼亚';
    if (c === 'forlì' || c === 'forli') return '弗利';
    if (c === 'cesena') return '切塞纳';
    if (c === 'rimini') return '里米尼';
    if (c === 'ravenna') return '拉文纳';
    if (c === 'imola') return '伊莫拉';
    if (c === 'ozzano') return '奥扎诺';
    return campus;
  };

  useEffect(() => {
    const onBackPress = () => {
      if (showSearch) {
        setShowSearch(false);
        setSearchQuery('');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (showSearch) {
        e.preventDefault();
        setShowSearch(false);
        setSearchQuery('');
      }
    });

    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [showSearch, navigation]);

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aFav = favorites.includes(a.id);
      const bFav = favorites.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [rooms, favorites]);

  const filteredRooms = useMemo(() => {
    let result = [...sortedRooms];

    // 1. Campus filter
    if (selectedCampus !== 'all') {
      result = result.filter(room => getRoomCampus(room.address) === selectedCampus);
    }

    // 2. Supports booking filter
    if (filterBooking) {
      result = result.filter(room => room.supportsBooking);
    }

    // 3. Open now filter
    if (filterOpen) {
      result = result.filter(room => room.status.isOpen);
    }

    // 4. Text query filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(room => 
        room.nameCn.toLowerCase().includes(query) || 
        room.nameIt.toLowerCase().includes(query)
      );
    }

    return result;
  }, [sortedRooms, selectedCampus, filterBooking, filterOpen, searchQuery]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<any>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    toastFade.setValue(0);
    
    const isSuccess = msg === '刷新成功';
    const fadeInDuration = isSuccess ? 150 : 250;
    const keepDuration = isSuccess ? 1000 : 2000;
    const fadeOutDuration = 250;

    Animated.timing(toastFade, {
      toValue: 1,
      duration: fadeInDuration,
      useNativeDriver: true,
    }).start();

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastFade, {
        toValue: 0,
        duration: fadeOutDuration,
        useNativeDriver: true,
      }).start(() => {
        setToastMsg(null);
      });
    }, keepDuration);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  async function loadData(isRefresh = false) {
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
      if (isRefresh) {
        triggerToast('刷新成功');
      }
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
    loadData(true);
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
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {showSearch ? (
            <View style={styles.searchHeaderContainer}>
              <Pressable style={styles.backButton} onPress={() => { setShowSearch(false); setSearchQuery(''); }}>
                <MaterialIcons name="arrow-back" size={24} color="#A31621" />
              </Pressable>
              <View style={[styles.searchInputContainer, { backgroundColor: colors.background }]}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  placeholder="搜索名称..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <>
              <Pressable style={styles.backButton} onPress={() => router.back()}>
                <MaterialIcons name="arrow-back" size={24} color="#A31621" />
              </Pressable>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>自习室与图书馆</Text>
              <Pressable style={{ padding: 8 }} onPress={() => setShowSearch(true)}>
                <MaterialCommunityIcons name="magnify" size={22} color={colors.primary} />
              </Pressable>
            </>
          )}
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

        {/* Filter Bar */}
        <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {/* Campus Dropdown */}
          <Pressable 
            style={[styles.filterDropdown, { borderColor: selectedCampus === 'all' ? colors.border : colors.primary }]} 
            onPress={() => setShowCampusModal(true)}
          >
            <Text style={[styles.filterDropdownText, { color: selectedCampus === 'all' ? colors.textPrimary : colors.primary }]}>
              {selectedCampus === 'all' ? '全部校区' : getCampusLabel(selectedCampus)}
            </Text>
            <MaterialCommunityIcons 
              name="chevron-down" 
              size={14} 
              color={selectedCampus === 'all' ? colors.textSecondary : colors.primary} 
            />
          </Pressable>

          {/* Supports Booking Toggle */}
          <Pressable 
            style={[
              styles.filterButton, 
              { 
                borderColor: filterBooking ? colors.primary : colors.border,
                backgroundColor: filterBooking ? colors.primarySoft : 'transparent'
              }
            ]} 
            onPress={() => setFilterBooking(!filterBooking)}
          >
            <Text style={[styles.filterButtonText, { color: filterBooking ? colors.primary : colors.textSecondary }]}>
              支持预约
            </Text>
          </Pressable>

          {/* Open Now Toggle */}
          <Pressable 
            style={[
              styles.filterButton, 
              { 
                borderColor: filterOpen ? colors.primary : colors.border,
                backgroundColor: filterOpen ? colors.primarySoft : 'transparent'
              }
            ]} 
            onPress={() => setFilterOpen(!filterOpen)}
          >
            <Text style={[styles.filterButtonText, { color: filterOpen ? colors.primary : colors.textSecondary }]}>
              开放中
            </Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={[colors.primary]}
              tintColor={colors.primary} 
              progressViewOffset={20}
            />
          }
          renderItem={({ item }) => {
            const barColor = getOccupancyColor(item.status.occupancyPercent);
            const isFav = favorites.includes(item.id);
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
                    style={[
                      styles.favoriteButton,
                      {
                        borderColor: isFav ? colors.primary : colors.border,
                        backgroundColor: isFav ? colors.primarySoft : 'transparent',
                      }
                    ]}
                    onPress={() => toggleFavorite(item.id)}
                  >
                    <MaterialCommunityIcons 
                      name={isFav ? "star" : "star-outline"} 
                      size={20} 
                      color={isFav ? colors.primary : colors.textSecondary} 
                    />
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
                    onPress={() => handleBookSeat(item)}
                  >
                    <MaterialCommunityIcons 
                      name={item.supportsBooking ? "calendar-check" : "eye-outline"} 
                      size={16} 
                      color={colors.primary} 
                    />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                      {item.supportsBooking ? "预约座位" : "查看详情"}
                    </Text>
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
      {/* Campus Selector Modal */}
      <Modal
        visible={showCampusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCampusModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCampusModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>选择校区</Text>
            
            <Pressable 
              style={[
                styles.modalItem, 
                selectedCampus === 'all' && [styles.modalItemActive, { backgroundColor: colors.primarySoft }]
              ]} 
              onPress={() => {
                setSelectedCampus('all');
                setShowCampusModal(false);
              }}
            >
              <Text style={[
                styles.modalItemText, 
                { color: selectedCampus === 'all' ? colors.primary : colors.textPrimary, fontWeight: selectedCampus === 'all' ? 'bold' : 'normal' }
              ]}>
                全部校区
              </Text>
            </Pressable>

            {['Bologna', 'Forlì', 'Cesena', 'Rimini', 'Ravenna', 'Imola', 'Ozzano'].map(camp => {
              const isSelected = selectedCampus === camp;
              return (
                <Pressable 
                  key={camp}
                  style={[
                    styles.modalItem, 
                    isSelected && [styles.modalItemActive, { backgroundColor: colors.primarySoft }]
                  ]} 
                  onPress={() => {
                    setSelectedCampus(camp);
                    setShowCampusModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText, 
                    { color: isSelected ? colors.primary : colors.textPrimary, fontWeight: isSelected ? 'bold' : 'normal' }
                  ]}>
                    {getCampusLabel(camp)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Toast Feedback */}
      {toastMsg && (
        <Animated.View style={[
          toastMsg === '刷新成功' ? [styles.checkmarkBubble, { top: Platform.OS === 'ios' ? headerHeight + 50 : headerHeight + 84 }] : styles.toastContainer, 
          { 
            opacity: toastFade, 
            backgroundColor: toastMsg === '刷新成功' ? '#FFFFFF' : colors.surface,
            borderColor: toastMsg === '刷新成功' ? 'transparent' : colors.primary,
            borderWidth: toastMsg === '刷新成功' ? 0 : 1,
          }
        ]}>
          {toastMsg === '刷新成功' ? (
            <MaterialCommunityIcons name="check" size={24} color={colors.primary} />
          ) : (
            <Text style={[styles.toastText, { color: colors.primary }]}>{toastMsg}</Text>
          )}
        </Animated.View>
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
  favoriteButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
  toastContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 99999,
    borderWidth: 1,
  },
  toastText: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  searchHeaderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  checkmarkBubble: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 80,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 99999,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 30,
    gap: 4,
  },
  filterDropdownText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  modalItemActive: {
    // backgroundColor applied dynamically
  },
  modalItemText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
