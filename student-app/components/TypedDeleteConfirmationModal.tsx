import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type Props = {
  visible: boolean;
  subject: string;
  description: string;
  confirmationPhrase: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function TypedDeleteConfirmationModal({
  visible,
  subject,
  description,
  confirmationPhrase,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const matches = input === confirmationPhrase;
  const blocked = busy || submitting;

  useEffect(() => {
    if (visible) {
      setInput('');
      setSubmitting(false);
    }
  }, [visible]);

  const confirm = async () => {
    if (!matches || blocked) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={blocked ? undefined : onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.dialog, { backgroundColor: colors.surfaceElevated || colors.surface, borderColor: colors.border }]}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="alert-octagon-outline" size={24} color="#EF4444" />
            <Text style={[styles.title, { color: colors.textPrimary }]}>最终确认（3/3）</Text>
          </View>

          <Text style={[styles.subject, { color: colors.textPrimary }]} numberOfLines={2}>{subject}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
          <Text style={[styles.instruction, { color: colors.textPrimary }]}>请输入“{confirmationPhrase}”以继续</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: matches ? '#EF4444' : colors.border }]}
            placeholder={confirmationPhrase}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!blocked}
            returnKeyType="done"
            onSubmitEditing={confirm}
          />

          <View style={styles.actions}>
            <Pressable
              style={[styles.cancelButton, { borderColor: colors.border }]}
              disabled={blocked}
              onPress={onCancel}
            >
              <Text style={[styles.cancelText, { color: colors.textPrimary }]}>取消</Text>
            </Pressable>
            <Pressable
              style={[styles.deleteButton, { backgroundColor: '#EF4444', opacity: matches && !blocked ? 1 : 0.4 }]}
              disabled={!matches || blocked}
              onPress={confirm}
            >
              {blocked ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <>
                  <MaterialCommunityIcons name="delete-forever-outline" size={19} color="#FFFFFF" />
                  <Text style={styles.deleteText}>确认删除</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.62)' },
  dialog: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 8, padding: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  subject: { marginTop: 18, fontSize: 15, fontWeight: '700' },
  description: { marginTop: 6, fontSize: 13, lineHeight: 20 },
  instruction: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '600' },
  input: { height: 46, borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, fontSize: 15 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, height: 46, borderWidth: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700' },
  deleteButton: { flex: 1, height: 46, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  deleteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
