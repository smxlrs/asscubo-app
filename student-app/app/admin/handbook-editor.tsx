import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { TypedDeleteConfirmationModal } from '../../components/TypedDeleteConfirmationModal';

type Chapter = {
  id: string;
  title: string;
  order_index: number;
  content_type: 'pdf' | 'richtext';
  content_url: string | null;
  content_body: string | null;
  parent_id: string | null;
  is_published: boolean;
};

export default function HandbookEditorScreen() {
  const params = useLocalSearchParams<{ chapterId?: string; parentId?: string }>();
  const chapterId = typeof params.chapterId === 'string' ? params.chapterId : undefined;
  const initialParentId = typeof params.parentId === 'string' ? params.parentId : null;
  const { colors, isDark } = useTheme();
  const activeSwitchColor = isDark ? colors.primaryLight : colors.primary;
  const inactiveSwitchThumb = isDark ? '#737373' : '#FFFFFF';

  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [title, setTitle] = useState('');
  const [orderIndex, setOrderIndex] = useState('1');
  const [contentType, setContentType] = useState<'pdf' | 'richtext'>('richtext');
  const [contentUrl, setContentUrl] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parentModalVisible, setParentModalVisible] = useState(false);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState('');

  const roots = useMemo(() => allChapters
    .filter((chapter) => !chapter.parent_id && chapter.id !== chapterId)
    .sort((a, b) => a.order_index - b.order_index), [allChapters, chapterId]);

  const currentChapter = allChapters.find((chapter) => chapter.id === chapterId);
  const hasChildren = chapterId ? allChapters.some((chapter) => chapter.parent_id === chapterId) : false;
  const parentTitle = parentId ? allChapters.find((chapter) => chapter.id === parentId)?.title || '未知目录' : '一级目录';

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('handbook_chapters')
          .select('id, title, order_index, content_type, content_url, content_body, parent_id, is_published')
          .order('order_index', { ascending: true });
        if (error) throw error;

        const chapters = (data || []) as Chapter[];
        setAllChapters(chapters);

        if (chapterId) {
          const chapter = chapters.find((item) => item.id === chapterId);
          if (!chapter) throw new Error('章节不存在或已被删除。');
          setTitle(chapter.title);
          setOrderIndex(String(chapter.order_index));
          setContentType(chapter.content_type);
          setContentUrl(chapter.content_url || '');
          setContentBody(chapter.content_body || '');
          setParentId(chapter.parent_id);
          setPublished(chapter.is_published);
          setInitialSnapshot(JSON.stringify({
            title: chapter.title,
            orderIndex: String(chapter.order_index),
            contentType: chapter.content_type,
            contentUrl: chapter.content_url || '',
            contentBody: chapter.content_body || '',
            parentId: chapter.parent_id,
            published: chapter.is_published,
          }));
        } else {
          const siblings = chapters.filter((item) => item.parent_id === initialParentId);
          const nextOrder = siblings.reduce((max, item) => Math.max(max, item.order_index), 0) + 1;
          setOrderIndex(String(nextOrder));
          setInitialSnapshot(JSON.stringify({
            title: '', orderIndex: String(nextOrder), contentType: 'richtext',
            contentUrl: '', contentBody: '', parentId: initialParentId, published: true,
          }));
        }
      } catch (error: any) {
        Alert.alert('加载失败', error.message || '无法加载章节编辑器。', [{ text: '返回', onPress: () => router.back() }]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [chapterId, initialParentId]);

  const currentSnapshot = JSON.stringify({ title, orderIndex, contentType, contentUrl, contentBody, parentId, published });
  const isDirty = initialSnapshot !== '' && currentSnapshot !== initialSnapshot;

  const cancelEditing = () => {
    if (!isDirty) {
      router.back();
      return;
    }
    Alert.alert('放弃修改', '尚未保存的修改将会丢失。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃修改', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const selectParent = (nextParentId: string | null) => {
    if (hasChildren && nextParentId !== null) {
      Alert.alert('无法调整', '包含子章节的一级目录不能移动到另一个目录下。');
      return;
    }
    setParentId(nextParentId);
    setParentModalVisible(false);
  };

  const saveChapter = async () => {
    const normalizedTitle = title.trim();
    const normalizedOrder = Number.parseInt(orderIndex, 10);
    if (!normalizedTitle) {
      Alert.alert('请填写标题', '章节标题不能为空。');
      return;
    }
    if (!Number.isInteger(normalizedOrder) || normalizedOrder < 0) {
      Alert.alert('排序号无效', '排序号必须是大于或等于 0 的整数。');
      return;
    }
    if (contentType === 'pdf' && !contentUrl.trim()) {
      Alert.alert('请填写 PDF 地址', 'PDF 类型章节需要有效的文件地址。');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: normalizedTitle,
        order_index: normalizedOrder,
        content_type: contentType,
        content_url: contentType === 'pdf' ? contentUrl.trim() : null,
        content_body: contentType === 'richtext' ? contentBody : null,
        parent_id: parentId,
        is_published: published,
        updated_at: new Date().toISOString(),
      };

      const response = chapterId
        ? await supabase.from('handbook_chapters').update(payload).eq('id', chapterId)
        : await supabase.from('handbook_chapters').insert(payload);
      if (response.error) throw response.error;

      Alert.alert('保存成功', chapterId ? '章节内容已更新。' : '新章节已创建。', [
        { text: '返回目录', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('保存失败', error.message || '无法保存章节内容。');
    } finally {
      setSaving(false);
    }
  };

  const performDeleteChapter = async () => {
    if (!chapterId) return;
    setSaving(true);
    const { error } = await supabase.from('handbook_chapters').delete().eq('id', chapterId);
    setSaving(false);
    if (error) {
      Alert.alert('删除失败', error.message || '无法删除该章节。');
    } else {
      setDeleteConfirmationVisible(false);
      Alert.alert('已删除', '章节已从手册中删除。', [{ text: '返回目录', onPress: () => router.back() }]);
    }
  };

  const deleteChapter = () => {
    if (!chapterId || !currentChapter) return;
    const childCount = allChapters.filter((chapter) => chapter.parent_id === chapterId).length;
    const message = childCount > 0
      ? `该目录包含 ${childCount} 个子章节，删除后子章节也会永久删除。`
      : '该章节将被永久删除，此操作无法撤销。';

    Alert.alert('删除章节（1/3）', message, [
      { text: '取消', style: 'cancel' },
      {
        text: '继续',
        style: 'destructive',
        onPress: () => Alert.alert(
          '再次确认（2/3）',
          childCount > 0
            ? `“${currentChapter.title}”及其 ${childCount} 个子章节都会被永久删除，且无法恢复。`
            : `“${currentChapter.title}”的内容会被永久删除，且无法恢复。`,
          [
            { text: '取消', style: 'cancel' },
            { text: '进入最终确认', style: 'destructive', onPress: () => setDeleteConfirmationVisible(true) },
          ],
        ),
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.headerButton} onPress={cancelEditing}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primaryLight} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{chapterId ? '编辑手册章节' : '新增手册章节'}</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FieldLabel label="章节标题" colors={colors} />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
          value={title}
          onChangeText={setTitle}
          placeholder="输入章节标题"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.twoColumns}>
          <View style={styles.column}>
            <FieldLabel label="所属目录" colors={colors} />
            <Pressable style={[styles.select, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setParentModalVisible(true)}>
              <Text style={[styles.selectText, { color: colors.textPrimary }]} numberOfLines={1}>{parentTitle}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.orderColumn}>
            <FieldLabel label="排序号" colors={colors} />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={orderIndex}
              onChangeText={setOrderIndex}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <FieldLabel label="内容类型" colors={colors} />
        <View style={[styles.segmented, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <SegmentButton label="Markdown" selected={contentType === 'richtext'} onPress={() => setContentType('richtext')} colors={colors} />
          <SegmentButton label="PDF" selected={contentType === 'pdf'} onPress={() => setContentType('pdf')} colors={colors} />
        </View>

        {contentType === 'richtext' ? (
          <>
            <FieldLabel label="Markdown 正文" colors={colors} />
            <TextInput
              style={[styles.bodyInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={contentBody}
              onChangeText={setContentBody}
              placeholder="输入手册正文"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        ) : (
          <>
            <FieldLabel label="PDF 文件地址" colors={colors} />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={contentUrl}
              onChangeText={setContentUrl}
              placeholder="https://..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </>
        )}

        <View style={[styles.publishRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.publishCopy}>
            <Text style={[styles.publishTitle, { color: colors.textPrimary }]}>对用户显示</Text>
            <Text style={[styles.publishDescription, { color: colors.textSecondary }]}>{published ? '保存后用户可在新生手册中看到' : '保存后章节将从用户端隐藏'}</Text>
          </View>
          <Switch
            value={published}
            onValueChange={setPublished}
            trackColor={{ false: colors.border, true: activeSwitchColor }}
            thumbColor={published ? '#FFFFFF' : inactiveSwitchThumb}
            ios_backgroundColor={colors.border}
          />
        </View>

        <View style={styles.formActions}>
          <Pressable style={[styles.cancelButton, { borderColor: colors.border }]} disabled={saving} onPress={cancelEditing}>
            <Text style={[styles.cancelText, { color: colors.textPrimary }]}>取消</Text>
          </Pressable>
          <Pressable style={[styles.saveButton, { backgroundColor: colors.primary }]} disabled={saving} onPress={saveChapter}>
            {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
              <><MaterialCommunityIcons name="content-save-outline" size={20} color="#FFFFFF" /><Text style={styles.saveText}>保存</Text></>
            )}
          </Pressable>
        </View>

        {chapterId && (
          <Pressable style={[styles.deleteButton, { borderColor: '#EF4444' }]} disabled={saving} onPress={deleteChapter}>
            <MaterialCommunityIcons name="delete-outline" size={20} color="#EF4444" />
            <Text style={styles.deleteText}>删除章节</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={parentModalVisible} transparent animationType="fade" onRequestClose={() => setParentModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setParentModalVisible(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface }]} onPress={() => undefined}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>选择所属目录</Text>
            <Pressable style={[styles.parentOption, { borderBottomColor: colors.border }]} onPress={() => selectParent(null)}>
              <MaterialCommunityIcons name="book-outline" size={20} color={colors.primaryLight} />
              <Text style={[styles.parentText, { color: colors.textPrimary }]}>一级目录</Text>
              {!parentId && <MaterialCommunityIcons name="check" size={20} color={colors.primaryLight} />}
            </Pressable>
            {roots.map((root) => (
              <Pressable key={root.id} style={[styles.parentOption, { borderBottomColor: colors.border }]} onPress={() => selectParent(root.id)}>
                <MaterialCommunityIcons name="folder-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.parentText, { color: colors.textPrimary }]} numberOfLines={2}>{root.title}</Text>
                {parentId === root.id && <MaterialCommunityIcons name="check" size={20} color={colors.primaryLight} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <TypedDeleteConfirmationModal
        visible={deleteConfirmationVisible}
        subject={`删除章节：${currentChapter?.title || ''}`}
        description={hasChildren ? '该目录及其所有子章节会被永久删除，此操作无法撤销。' : '该章节会被永久删除，此操作无法撤销。'}
        confirmationPhrase="确认删除该章节"
        busy={saving}
        onCancel={() => setDeleteConfirmationVisible(false)}
        onConfirm={performDeleteChapter}
      />
    </SafeAreaView>
  );
}

function FieldLabel({ label, colors }: { label: string; colors: any }) {
  return <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>;
}

function SegmentButton({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable style={[styles.segmentButton, selected && { backgroundColor: colors.surface }]} onPress={onPress}>
      <Text style={[styles.segmentText, { color: selected ? colors.primaryLight : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerButton: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 15, marginBottom: 7 },
  input: { height: 44, borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, fontSize: 15 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  orderColumn: { width: 92 },
  select: { height: 44, borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  selectText: { flex: 1, fontSize: 14 },
  segmented: { height: 42, borderWidth: 1, borderRadius: 7, padding: 3, flexDirection: 'row' },
  segmentButton: { flex: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '700' },
  bodyInput: { minHeight: 360, borderWidth: 1, borderRadius: 7, padding: 12, fontSize: 14, lineHeight: 21 },
  publishRow: { minHeight: 64, borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, marginTop: 18, flexDirection: 'row', alignItems: 'center' },
  publishCopy: { flex: 1 },
  publishTitle: { fontSize: 15, fontWeight: '700' },
  publishDescription: { fontSize: 11, marginTop: 3 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, height: 46, borderWidth: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700' },
  saveButton: { flex: 1, height: 46, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  deleteButton: { height: 46, borderWidth: 1, borderRadius: 7, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '75%', borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingBottom: 24 },
  modalTitle: { fontSize: 17, fontWeight: '700', padding: 16 },
  parentOption: { minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  parentText: { flex: 1, fontSize: 14 },
});
