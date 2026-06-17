import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

type Chapter = {
  id: string;
  title: string;
  order_index: number;
  content_type: 'pdf' | 'richtext';
  parent_id: string | null;
  children?: Chapter[];
};

export default function HandbookScreen() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('handbook_chapters')
        .select('id, title, order_index, content_type, parent_id')
        .eq('is_published', true)
        .order('order_index', { ascending: true });

      if (data) {
        // Build tree structure
        const roots = data.filter(c => !c.parent_id);
        const withChildren = roots.map(root => ({
          ...root,
          children: data.filter(c => c.parent_id === root.id),
        }));
        setChapters(withChildren as Chapter[]);
      }
      setLoading(false);
    }
    fetch();
  }, []);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>📖 电子学生手册</Text>
        <Text style={styles.subtitle}>在线查阅学生手册内容</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : chapters.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyText}>手册内容即将上线</Text>
          <Text style={styles.emptySubText}>管理员正在整理中，敬请期待</Text>
        </View>
      ) : (
        <FlatList
          data={chapters}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={styles.chapterGroup}>
              {/* Parent chapter */}
              <TouchableOpacity
                style={styles.parentChapter}
                onPress={() => {
                  if (item.children && item.children.length > 0) {
                    toggleExpand(item.id);
                  } else {
                    router.push(`/handbook/${item.id}` as any);
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={styles.chapterNumber}>
                  <Text style={styles.chapterNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.chapterInfo}>
                  <Text style={styles.chapterTitle}>{item.title}</Text>
                  <View style={styles.chapterMeta}>
                    <Text style={styles.contentTypeText}>
                      {item.content_type === 'pdf' ? '📄 PDF文档' : '📝 富文本'}
                    </Text>
                    {item.children && item.children.length > 0 && (
                      <Text style={styles.subCount}>{item.children.length} 个小节</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.chevron}>
                  {item.children && item.children.length > 0
                    ? (expanded.has(item.id) ? '▲' : '▼')
                    : '→'}
                </Text>
              </TouchableOpacity>

              {/* Sub-chapters */}
              {expanded.has(item.id) && item.children && item.children.map((child, ci) => (
                <TouchableOpacity
                  key={child.id}
                  style={styles.subChapter}
                  onPress={() => router.push(`/handbook/${child.id}` as any)}
                  activeOpacity={0.85}
                >
                  <View style={styles.subLine} />
                  <Text style={styles.subChapterTitle}>{index + 1}.{ci + 1} {child.title}</Text>
                  <Text style={styles.subChapterType}>
                    {child.content_type === 'pdf' ? '📄' : '📝'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, paddingBottom: SPACING.base },
  title: { fontSize: SIZES.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  subtitle: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 20 },
  chapterGroup: { marginBottom: SPACING.xs },
  parentChapter: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  chapterNumber: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterNumberText: { fontSize: SIZES.base, fontFamily: FONTS.bold, color: '#FFFFFF' },
  chapterInfo: { flex: 1 },
  chapterTitle: { fontSize: SIZES.base, fontFamily: FONTS.semiBold, color: COLORS.textPrimary },
  chapterMeta: { flexDirection: 'row', gap: SPACING.sm, marginTop: 2 },
  contentTypeText: { fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  subCount: { fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textMuted },
  chevron: { fontSize: SIZES.sm, color: COLORS.textSecondary },
  subChapter: {
    backgroundColor: COLORS.surfaceElevated,
    marginTop: 2,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingLeft: SPACING.xl + SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: SPACING.base,
  },
  subLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    marginRight: SPACING.xs,
  },
  subChapterTitle: { flex: 1, fontSize: SIZES.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  subChapterType: { fontSize: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 64, marginBottom: SPACING.base },
  emptyText: { fontSize: SIZES.lg, fontFamily: FONTS.semiBold, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  emptySubText: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textMuted },
});
