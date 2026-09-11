import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { serializeHandbookTable } from '../lib/handbookTable';

export function HandbookTableComposer({ onCancel, onInsert }: { onCancel: () => void; onInsert: (markdown: string) => void }) {
  const { colors } = useTheme();
  const [columns, setColumns] = useState(3);
  const [rows, setRows] = useState(3);
  const [cells, setCells] = useState<string[][]>([]);
  const update = (r: number, c: number, text: string) => setCells(previous => {
    const next = previous.map(row => [...row]);
    next[r] ||= []; next[r][c] = text; return next;
  });
  const rowValues = (r: number) => Array.from({ length: columns }, (_, c) => cells[r]?.[c] || '');
  return <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <View style={{ maxHeight: '90%', backgroundColor: colors.surface, borderRadius: 12, padding: 16 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>插入表格</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 12 }}>
          {([{ label: '列数', count: columns, set: setColumns, max: 6 }, { label: '内容行数', count: rows, set: setRows, max: 20 }]).map(control =>
            <View key={control.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.textPrimary }}>{control.label}：{control.count}</Text>
              {[-1, 1].map(delta => <Pressable key={delta} accessibilityRole="button" accessibilityLabel={`${delta < 0 ? '减少' : '增加'}${control.label}`}
                disabled={control.count + delta < 1 || control.count + delta > control.max} onPress={() => control.set(control.count + delta)} style={{ padding: 12 }}>
                <Text style={{ color: colors.primaryLight }}>{delta < 0 ? '−' : '+'}</Text>
              </Pressable>)}
            </View>)}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          {Array.from({ length: rows + 1 }, (_, r) => <View key={r} style={{ marginBottom: 14 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', marginBottom: 6 }}>{r === 0 ? '表头' : `第 ${r} 行`}</Text>
            {Array.from({ length: columns }, (_, c) => <TextInput key={c} value={cells[r]?.[c] || ''} onChangeText={text => update(r, c, text)}
              accessibilityLabel={`${r === 0 ? '表头' : `第${r}行`}第${c + 1}列`}
              placeholder={r === 0 ? `第 ${c + 1} 列标题` : rowValues(0)[c] || `第 ${c + 1} 列内容`}
              placeholderTextColor={colors.textMuted} style={{ color: colors.textPrimary, borderColor: colors.border, borderWidth: 1, borderRadius: 6, padding: 10, marginBottom: 6 }} />)}
          </View>)}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable onPress={onCancel} style={{ padding: 14 }}><Text style={{ color: colors.textSecondary }}>取消</Text></Pressable>
          <Pressable onPress={() => onInsert(serializeHandbookTable(rowValues(0), Array.from({ length: rows }, (_, r) => rowValues(r + 1))))} style={{ padding: 14 }}>
            <Text style={{ color: colors.primaryLight }}>插入正文</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
