import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Alert, ActivityIndicator, Modal } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type Article = {
  id: string;
  title: string;
  category: string | null;
  link: string | null;
  created_at: string;
  is_pinned: boolean;
};

const ARTICLE_CATEGORIES: Record<string, { label: string; color: string }> = {
  event_news: { label: '学联活动', color: '#EF4444' },
  notice: { label: '学术资讯', color: '#3B82F6' },
  news: { label: '生活辅助', color: '#10B981' },
  column: { label: '原创专栏', color: '#F59E0B' },
  reprint: { label: '转载', color: '#6B7280' },
  general: { label: '综合公告', color: '#8B5CF6' }
};

export default function ManageArticlesScreen() {
  const { colors } = useTheme();
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, category, link, created_at, is_pinned')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (data) {
        setArticles(data as Article[]);
      }
    } catch (e) {
      console.error('Error fetching articles:', e);
      Alert.alert('加载失败', '无法拉取文章列表，请刷新重试。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleCategoryChange = async (articleId: string, newCategory: string | null) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ category: newCategory })
        .eq('id', articleId);

      if (error) throw error;

      setArticles(prev => prev.map(art => art.id === articleId ? { ...art, category: newCategory } : art));
    } catch (err: any) {
      console.error(err);
      Alert.alert('修改失败', err.message || '修改分类失败，请重试。');
    }
  };

  const handleTogglePin = async (article: Article) => {
    try {
      const newPinned = !article.is_pinned;
      const { error } = await supabase
        .from('articles')
        .update({ is_pinned: newPinned })
        .eq('id', article.id);

      if (error) throw error;

      setArticles(prev => {
        const updated = prev.map(art => art.id === article.id ? { ...art, is_pinned: newPinned } : art);
        return [...updated].sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
    } catch (err: any) {
      console.error(err);
      Alert.alert('操作失败', err.message || '切换置顶状态失败，请重试。');
    }
  };

  const showCategoryPicker = (article: Article) => {
    setActiveArticle(article);
    setSelectedCategory((!article.category || article.category === 'general') ? null : article.category);
    setPickerVisible(true);
  };

  const handleDelete = (article: Article) => {
    Alert.alert(
      '确认删除',
      `确定要彻底删除文章《${article.title.slice(0, 20)}...》吗？此操作无法撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from articles table
              const { error: artError } = await supabase
                .from('articles')
                .delete()
                .eq('id', article.id);

              if (artError) throw artError;

              setArticles(prev => prev.filter(art => art.id !== article.id));
              Alert.alert('删除成功', '文章已成功删除。');
            } catch (err: any) {
              console.error(err);
              Alert.alert('删除失败', err.message || '删除出错，请重试。');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Article }) => {
    const cat = (item.category && item.category !== 'general') ? ARTICLE_CATEGORIES[item.category] : null;
    const catColor = cat ? cat.color : '#8A8A8F';
    const catLabel = cat ? cat.label : '未分类';
    const formattedDate = new Date(item.created_at).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <View style={[styles.itemRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={[styles.itemDate, { color: colors.textMuted }]}>{formattedDate}</Text>
            <Pressable 
              style={[styles.categoryTag, { backgroundColor: catColor + '15', borderColor: catColor + '40' }]}
              onPress={() => showCategoryPicker(item)}
            >
              <Text style={[styles.categoryTagText, { color: catColor }]}>
                {catLabel} ▾
              </Text>
            </Pressable>
          </View>
        </View>
        
        <View style={styles.actionButtons}>
          <Pressable style={styles.pinButton} onPress={() => handleTogglePin(item)}>
            <MaterialCommunityIcons 
              name={item.is_pinned ? "pin" : "pin-outline"} 
              size={22} 
              color={item.is_pinned ? "#F59E0B" : colors.textMuted} 
            />
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={() => handleDelete(item)}>
            <MaterialCommunityIcons name="trash-can-outline" size={22} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>管理已有文章</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={articles}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchArticles();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="folder-open-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>暂无文章数据</Text>
            </View>
          }
        />
      )}

      {/* Category Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setPickerVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>修改文章分类</Text>
            {activeArticle && (
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                修改《{activeArticle.title}》的分类为：
              </Text>
            )}
            
            <View style={styles.modalButtonsContainer}>
              {Object.entries(ARTICLE_CATEGORIES).map(([key, cat]) => {
                if (key === 'general') return null;
                const isSelected = selectedCategory === key;
                return (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.modalCategoryButton,
                      { 
                        borderColor: isSelected ? cat.color : cat.color + '30',
                        backgroundColor: isSelected ? cat.color + '15' : (pressed ? cat.color + '05' : 'transparent'),
                        borderWidth: isSelected ? 1.5 : 1
                      }
                    ]}
                    onPress={() => {
                      setSelectedCategory(prev => prev === key ? null : key);
                    }}
                  >
                    <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                    <Text style={[
                      styles.modalCategoryText, 
                      { 
                        color: colors.textPrimary,
                        fontWeight: isSelected ? 'bold' : 'normal' 
                      }
                    ]}>
                      {cat.label}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons 
                        name="check-circle" 
                        size={16} 
                        color={cat.color} 
                        style={{ marginLeft: 'auto' }} 
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable 
                style={[styles.modalActionButton, { backgroundColor: colors.border }]}
                onPress={() => setPickerVisible(false)}
              >
                <Text style={[styles.modalActionButtonText, { color: colors.textPrimary }]}>取消</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.modalActionButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  if (activeArticle) {
                    setPickerVisible(false);
                    await handleCategoryChange(activeArticle.id, selectedCategory);
                  }
                }}
              >
                <Text style={[styles.modalActionButtonText, { color: '#FFFFFF' }]}>确认</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
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
    paddingBottom: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 16,
    gap: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemDate: {
    fontSize: 12,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtonsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  modalCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  modalCategoryText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalActionButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
