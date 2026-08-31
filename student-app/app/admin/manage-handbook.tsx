import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

type Chapter = {
  id: string;
  title: string;
  order_index: number;
  content_type: 'pdf' | 'richtext';
  parent_id: string | null;
  is_published: boolean;
  updated_at: string;
};

export default function ManageHandbookScreen() {
  const { colors } = useTheme();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChapters = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('handbook_chapters')
        .select('id, title, order_index, content_type, parent_id, is_published, updated_at')
        .order('order_index', { ascending: true });
      if (error) throw error;
      setChapters((data || []) as Chapter[]);
    } catch (error: any) {
      Alert.alert('加载失败', error.message || '无法获取新生手册目录。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  useFocusEffect(useCallback(() => {
    if (!loading) fetchChapters();
  }, [fetchChapters, loading]));

  const roots = useMemo(() => chapters
    .filter((chapter) => !chapter.parent_id)
    .sort((a, b) => a.order_index - b.order_index), [chapters]);

  const childrenFor = (parentId: string) => chapters
    .filter((chapter) => chapter.parent_id === parentId)
    .sort((a, b) => a.order_index - b.order_index);

  const openEditor = (chapterId?: string, parentId?: string) => {
    router.push({
      pathname: '/admin/handbook-editor',
      params: {
        ...(chapterId ? { chapterId } : {}),
        ...(parentId ? { parentId } : {}),
      },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primaryLight} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>新生手册管理</Text>
        <Pressable style={styles.headerButton} onPress={() => openEditor()} accessibilityLabel="新增一级目录">
          <MaterialCommunityIcons name="plus" size={25} color={colors.primaryLight} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChapters(); }} tintColor={colors.primary} />}
        >
          {roots.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="book-open-blank-variant-outline" size={44} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无手册章节</Text>
            </View>
          ) : roots.map((root) => {
            const children = childrenFor(root.id);
            return (
              <View key={root.id} style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.rootRow, { borderBottomColor: colors.border }]}>
                  <Pressable style={styles.chapterMain} onPress={() => openEditor(root.id)}>
                    <MaterialCommunityIcons name="folder-outline" size={22} color={colors.primaryLight} />
                    <View style={styles.chapterCopy}>
                      <Text style={[styles.rootTitle, { color: colors.textPrimary }]} numberOfLines={2}>{root.title}</Text>
                      <Text style={[styles.meta, { color: colors.textSecondary }]}>{children.length} 个子章节 · 排序 {root.order_index}</Text>
                    </View>
                    {!root.is_published && <Text style={[styles.draftBadge, { color: '#D97706' }]}>未发布</Text>}
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => openEditor(undefined, root.id)} accessibilityLabel="新增子章节">
                    <MaterialCommunityIcons name="plus" size={22} color={colors.primaryLight} />
                  </Pressable>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} style={styles.rowArrow} />
                </View>

                {children.map((child, childIndex) => (
                  <View key={child.id} style={[styles.childRow, { borderBottomColor: colors.border }, childIndex === children.length - 1 && { borderBottomWidth: 0 }]}>
                    <Pressable style={styles.chapterMain} onPress={() => openEditor(child.id)}>
                      <MaterialCommunityIcons name={child.content_type === 'pdf' ? 'file-pdf-box' : 'text-box-outline'} size={20} color={colors.textSecondary} />
                      <View style={styles.chapterCopy}>
                        <Text style={[styles.childTitle, { color: colors.textPrimary }]} numberOfLines={2}>{child.title}</Text>
                        <Text style={[styles.meta, { color: colors.textSecondary }]}>{child.content_type === 'pdf' ? 'PDF' : 'Markdown'} · 排序 {child.order_index}</Text>
                      </View>
                      {!child.is_published && <Text style={[styles.draftBadge, { color: '#D97706' }]}>未发布</Text>}
                    </Pressable>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} style={styles.rowArrow} />
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerButton: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 36 },
  group: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  rootRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  childRow: { minHeight: 62, marginLeft: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  chapterMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  chapterCopy: { flex: 1, minWidth: 0 },
  rootTitle: { fontSize: 16, fontWeight: '700' },
  childTitle: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 11, marginTop: 3 },
  draftBadge: { fontSize: 10, fontWeight: '700', marginLeft: 6 },
  iconButton: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },
  rowArrow: { marginRight: 10 },
  emptyState: { alignItems: 'center', paddingTop: 72 },
  emptyText: { marginTop: 10, fontSize: 14 },
});
