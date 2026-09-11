import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { showCustomAlert } from '../lib/customAlert';
import { HandbookTableComposer } from './HandbookTableComposer';

export function HandbookMarkdownEditor({ value, onChange, onBusyChange, chapters, disabled = false }: {
  value: string; onChange: (value: string) => void; onBusyChange: (busy: boolean) => void;
  chapters: { id: string; title: string; is_published: boolean }[];
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const selection = useRef({ start: 0, end: 0 });
  const [cursor, setCursor] = useState<{ start: number; end: number }>();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [tableVisible, setTableVisible] = useState(false);
  const tableAnchor = useRef(0);
  const [linkMode, setLinkMode] = useState<'web' | 'chapter' | 'map' | 'email' | 'phone' | null>(null);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [query, setQuery] = useState('');
  const [linkError, setLinkError] = useState('');
  const openLink = () => {
    if (disabled) return;
    setLinkLabel(value.slice(selection.current.start, selection.current.end));
    setLinkUrl(''); setQuery(''); setLinkError(''); setLinkMode('web');
  };
  const commitLink = (url: string, fallback: string) => {
    const label = (linkLabel.trim() || fallback).replace(/[\[\]\n\r]/g, ' ');
    const text = `[${label}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
    const { start, end } = selection.current;
    replace(start, end, text, start + text.length, start + text.length);
    setLinkMode(null);
  };
  const insertWebLink = () => {
    let url = linkUrl.trim();
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
      url = parsed.href;
    } catch {
      setLinkError('请输入以 https:// 或 http:// 开头的完整网址。'); return;
    }
    commitLink(url, url);
  };
  const insertMapLink = () => {
    const location = (linkUrl.trim() || linkLabel.trim()).replace(/[\n\r]/g, ' ');
    if (!location) {
      setLinkError('请输入地图搜索词，或先选择要设置为地图链接的文字。');
      return;
    }
    commitLink(`map://${encodeURIComponent(location)}`, location);
  };
  const insertEmailLink = () => {
    const email = linkUrl.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLinkError('请输入完整的邮箱地址。');
      return;
    }
    commitLink(`mailto:${email}`, email);
  };
  const insertPhoneLink = () => {
    const displayPhone = linkUrl.trim();
    const phone = displayPhone.replace(/[()\s-]/g, '');
    if (!/^\+?\d{5,15}$/.test(phone)) {
      setLinkError('请输入完整的电话号码，可包含国家区号。');
      return;
    }
    commitLink(`tel:${phone}`, displayPhone);
  };
  const blockFormat = (kind: 'bullet' | 'number' | 'quote' | 'divider') => {
    if (disabled) return;
    const { start, end } = selection.current;
    if (kind === 'divider') {
      const text = '\n\n---\n\n';
      replace(start, start, text, start + text.length, start + text.length);
      return;
    }
    const first = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
    const last = value.indexOf('\n', end);
    const stop = last < 0 ? value.length : last;
    const lines = (value.slice(first, stop) || '内容').split('\n');
    const body = lines.map((line, i) =>
      (kind === 'bullet' ? '- ' : kind === 'number' ? `${i + 1}. ` : '> ') + line.replace(/^(?:- |\d+\. |> )/, '')).join('\n');
    const text = '\n\n' + body + '\n\n';
    replace(first, stop, text, first + 2, first + 2 + body.length);
  };

  const insertDetails = () => {
    if (disabled) return;
    const start = Math.min(selection.current.start, value.length);
    const end = Math.min(selection.current.end, value.length);
    const selected = value.slice(start, end).trim() || '- 列表内容';
    const text = `<details>\n<summary>点击展开</summary>\n\n${selected}\n\n</details>`;
    replace(start, end, text, start + 19, start + 23);
  };

  const replace = (start: number, end: number, text: string, selectedStart: number, selectedEnd: number) => {
    onChange(value.slice(0, start) + text + value.slice(end));
    const next = { start: selectedStart, end: selectedEnd };
    selection.current = next;
    setCursor(next);
    input.current?.focus();
  };
  const format = (marker: string, heading = false) => {
    if (disabled) return;
    const start = Math.min(selection.current.start, value.length);
    const end = Math.min(selection.current.end, value.length);
    if (heading) {
      const lineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = value.indexOf('\n', end);
      const stop = lineEnd < 0 ? value.length : lineEnd;
      const text = value.slice(lineStart, stop).replace(/^#{1,6}\s+/gm, '');
      const replacement = '\n\n' + (text || '标题').split('\n').map(line => marker + line).join('\n\n') + '\n\n';
      replace(lineStart, stop, replacement, lineStart + 2 + marker.length, lineStart + replacement.length - 2);
    } else {
      const text = value.slice(start, end) || '文字';
      if (start >= marker.length && value.slice(start - marker.length, start) === marker && value.slice(end, end + marker.length) === marker) {
        replace(start - marker.length, end + marker.length, text, start - marker.length, end - marker.length);
        return;
      }
      replace(start, end, marker + text + marker, start + marker.length, start + marker.length + text.length);
    }
  };
  const upload = async () => {
    if (locked.current || disabled) return;
    locked.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mime = asset.mimeType || 'image/jpeg';
      const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
      if (!extensions[mime]) throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片。');
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB。');
      const bytes = Platform.OS === 'web'
        ? await (await fetch(asset.uri)).arrayBuffer()
        : await new File(asset.uri).arrayBuffer();
      if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB。');
      const path = `handbook/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensions[mime]}`;
      const { error } = await supabase.storage.from('covers').upload(path, bytes, { contentType: mime, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('covers').getPublicUrl(path);
      const start = Math.min(selection.current.start, value.length);
      const text = `\n\n![图片](${data.publicUrl})\n\n`;
      // Insert without replacing selected prose.
      replace(start, start, text, start + text.length, start + text.length);
    } catch (error) {
      showCustomAlert('上传失败', error instanceof Error ? error.message : '图片上传失败，请重试。');
    } finally {
      locked.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };
  return (
    <View>
      <View pointerEvents={disabled ? 'none' : 'auto'} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, opacity: disabled ? 0.5 : 1 }}>
        {[['加粗', '**'], ['斜体', '*'], ['删除线', '~~'], ['行内代码', '`'], ['H1', '# '], ['H2', '## '], ['H3', '### ']].map(([label, marker]) => (
          <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={busy}
            onPress={() => format(marker, marker.startsWith('#'))}
            style={{ padding: 12, borderRadius: 7, backgroundColor: colors.surfaceElevated }}>
            <Text style={{ color: colors.textPrimary }}>{label}</Text>
          </Pressable>
        ))}
        {([['无序列表', 'bullet'], ['有序列表', 'number'], ['引用', 'quote'], ['分隔线', 'divider']] as const).map(([label, kind]) => (
          <Pressable key={kind} accessibilityRole="button" disabled={busy} onPress={() => blockFormat(kind)}
            style={{ padding: 12, borderRadius: 7, backgroundColor: colors.surfaceElevated }}>
            <Text style={{ color: colors.textPrimary }}>{label}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" disabled={busy} onPress={openLink} style={{ padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 7 }}>
          <Text style={{ color: colors.primaryLight }}>添加链接</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={() => {
          tableAnchor.current = Math.min(selection.current.start, value.length);
          setTableVisible(true);
        }} style={{ padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 7 }}>
          <Text style={{ color: colors.primaryLight }}>插入表格</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="插入收起区块" disabled={busy} onPress={insertDetails}
          style={{ padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 7 }}>
          <Text style={{ color: colors.primaryLight }}>收起区块</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={upload}
          style={{ padding: 12, borderRadius: 7, backgroundColor: colors.surfaceElevated }}>
          {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primaryLight }}>上传图片</Text>}
        </Pressable>
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>选中文字设置格式，或在光标处插入。收起区块会把选中内容放入可展开区域。</Text>
      <TextInput ref={input} value={value} editable={!busy && !disabled} multiline textAlignVertical="top"
        selection={cursor} onSelectionChange={({ nativeEvent }) => { selection.current = nativeEvent.selection; setCursor(undefined); }}
        onChangeText={onChange} placeholder="输入手册正文" placeholderTextColor={colors.textMuted}
        autoCapitalize="none" autoCorrect={false}
        style={{ minHeight: 360, borderWidth: 1, borderRadius: 7, padding: 12, fontSize: 14, lineHeight: 21,
          backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }} />
      {tableVisible && <HandbookTableComposer onCancel={() => setTableVisible(false)} onInsert={markdown => {
        const start = tableAnchor.current;
        const text = `\n\n${markdown}\n\n`;
        replace(start, start, text, start + text.length, start + text.length);
        setTableVisible(false);
      }} />}
      <Modal visible={linkMode !== null} transparent animationType="slide" onRequestClose={() => setLinkMode(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ maxHeight: '85%', padding: 18, borderRadius: 12, backgroundColor: colors.surface }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>添加链接</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12, columnGap: 20 }}>
              {(['web', 'chapter', 'map', 'email', 'phone'] as const).map(mode => <Pressable key={mode} onPress={() => {
                setLinkMode(mode); setLinkUrl(''); setLinkError('');
              }} style={{ paddingVertical: 10 }}>
                <Text style={{ color: linkMode === mode ? colors.primaryLight : colors.textSecondary }}>
                  {mode === 'web' ? '网址' : mode === 'chapter' ? '手册章节' : mode === 'map' ? '地图地点' : mode === 'email' ? '邮箱' : '电话'}
                </Text>
              </Pressable>)}
            </View>
            <TextInput value={linkLabel} onChangeText={setLinkLabel} placeholder="显示文字（可选）" placeholderTextColor={colors.textMuted}
              style={{ color: colors.textPrimary, borderColor: colors.border, borderWidth: 1, padding: 12, marginBottom: 10 }} />
            {linkMode === 'web' ? <>
              {linkError !== '' && <Text accessibilityRole="alert" style={{ color: '#EF4444', marginBottom: 8 }}>{linkError}</Text>}
              <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="https://..." placeholderTextColor={colors.textMuted}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
              <Pressable onPress={insertWebLink} style={{ padding: 14 }}><Text style={{ color: colors.primaryLight }}>插入网址链接</Text></Pressable>
            </> : linkMode === 'chapter' ? <>
              <TextInput value={query} onChangeText={setQuery} placeholder="搜索章节" placeholderTextColor={colors.textMuted} style={{ color: colors.textPrimary, padding: 12 }} />
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}>
                {chapters.filter(chapter => chapter.title.includes(query.trim())).map(chapter => <Pressable key={chapter.id}
                  onPress={() => commitLink(`handbook://${chapter.id}`, chapter.title)} style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textPrimary }}>{chapter.title}{chapter.is_published ? '' : '（未发布）'}</Text>
                </Pressable>)}
                {!chapters.some(chapter => chapter.title.includes(query.trim())) && <Text style={{ color: colors.textSecondary }}>没有匹配的章节</Text>}
              </ScrollView>
            </> : linkMode === 'map' ? <>
              {linkError !== '' && <Text accessibilityRole="alert" style={{ color: '#EF4444', marginBottom: 8 }}>{linkError}</Text>}
              <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="地图搜索词（不填则使用显示文字）" placeholderTextColor={colors.textMuted}
                autoCorrect={false} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
              <Pressable onPress={insertMapLink} style={{ padding: 14 }}><Text style={{ color: colors.primaryLight }}>插入地图链接</Text></Pressable>
            </> : linkMode === 'email' ? <>
              {linkError !== '' && <Text accessibilityRole="alert" style={{ color: '#EF4444', marginBottom: 8 }}>{linkError}</Text>}
              <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="name@example.com" placeholderTextColor={colors.textMuted}
                autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
              <Pressable onPress={insertEmailLink} style={{ padding: 14 }}><Text style={{ color: colors.primaryLight }}>插入邮箱链接</Text></Pressable>
            </> : <>
              {linkError !== '' && <Text accessibilityRole="alert" style={{ color: '#EF4444', marginBottom: 8 }}>{linkError}</Text>}
              <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="+39 051 1234567" placeholderTextColor={colors.textMuted}
                autoCapitalize="none" autoCorrect={false} keyboardType="phone-pad" style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
              <Pressable onPress={insertPhoneLink} style={{ padding: 14 }}><Text style={{ color: colors.primaryLight }}>插入电话链接</Text></Pressable>
            </>}
            <Pressable onPress={() => setLinkMode(null)} style={{ padding: 14 }}><Text style={{ color: colors.textSecondary }}>取消</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
