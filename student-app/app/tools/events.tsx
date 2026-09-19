import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, EventFormField, EventFormFieldType } from '../../lib/supabase';
import { appAlert as Alert } from '../../lib/appAlert';
import { HandbookMarkdownPreview } from '../../components/HandbookMarkdownPreview';

type EventRow = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  start_time: string;
  end_time: string;
  has_end_date: boolean;
  start_has_time: boolean;
  end_has_time: boolean;
  max_participants: number | null;
  cover_image: string | null;
  is_published: boolean;
  registration_deadline: string | null;
  registration_status: 'draft' | 'open' | 'closed' | 'ended' | 'archived';
  registration_form: EventFormField[] | null;
  registration_form_version: number;
  vehicle_selection_mode: 'none' | 'auto' | 'self_select' | 'admin';
  allow_proxy_registration: boolean;
  allow_waitlist: boolean;
};

type Vehicle = {
  id: string;
  event_id: string;
  name: string;
  capacity: number;
  reserved_seats: number;
  boarding_stop: string | null;
  departure_time: string | null;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
};

type Attendee = {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  answers?: FieldValues;
  vehicle_id?: string | null;
  proxy_note?: string;
};

type Registration = {
  id: string;
  event_id: string;
  user_id: string;
  status: 'confirmed' | 'cancelled' | 'waitlist';
  registration_kind: 'self' | 'proxy';
  proxy_note: string | null;
  participant_count: number;
  answers: Record<string, any>;
  vehicle_id: string | null;
  registration_number: string | null;
  registered_at: string;
  updated_at: string;
  attendees?: Attendee[];
};

type FieldValues = Record<string, any>;

const DEFAULT_FIELDS: EventFormField[] = [];

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatChineseDate(value, true);
}

function formatChineseDate(value: string, withTime: boolean) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  const text = `${parts.year}年${Number(parts.month)}月${Number(parts.day)}日`;
  return withTime ? `${text} ${Number(parts.hour)}时${parts.minute}分` : text;
}

function formatEventTime(event: Pick<EventRow, 'start_time' | 'end_time' | 'has_end_date' | 'start_has_time' | 'end_has_time'>) {
  const start = formatChineseDate(event.start_time, event.start_has_time !== false);
  const end = event.has_end_date === false ? '' : formatChineseDate(event.end_time, event.end_has_time !== false);
  if (!start && !end) return '';
  if (!end) return `活动时间：${start}`;
  if (!start) return `活动时间：${end}`;
  return `活动时间：${start} - ${end}`;
}

function dateFieldValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFieldDate(value: unknown) {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return new Date();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function dateFieldLabel(value: unknown) {
  const date = dateFieldDate(value);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function errorMessage(error: any, fallback: string, fields: EventFormField[] = []) {
  const message = String(error?.message || '');
  const fieldKey = message.match(/field:\s*([^\s]+)/i)?.[1];
  const fieldName = fields.find((field) => field.key === fieldKey)?.label;
  if (message.includes('Invalid email value')) return `“${fieldName || '邮箱'}”的邮箱格式不正确，请检查后重新填写。`;
  if (message.includes('Required registration field is missing')) {
    return `“${fieldName || '该字段'}”为必填项，请填写后再提交。`;
  }
  if (message.includes('already have an active')) return '你已经报名过这个活动了。';
  if (message.includes('Authentication is required')) return '请先登录后再报名。';
  if (message.includes('full') || message.includes('enough seats')) return '名额或车辆座位已满，请重新选择。';
  if (message.includes('deadline')) return '报名或修改截止时间已到。';
  if (message.includes('ended')) return '活动已经结束，不能再报名或修改。';
  if (message.includes('proxy')) return '请填写代报名备注，说明报名对象是谁。';
  return message || fallback;
}

function fieldLabel(field: EventFormField) {
  return `${field.label}${field.required ? ' *' : ''}`;
}

export default function EventsToolScreen() {
  const { colors, language } = useTheme();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{ eventId?: string; registrationId?: string; detail?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : undefined;
  const registrationId = typeof params.registrationId === 'string' ? params.registrationId : undefined;
  const detailParam = params.detail === '1';

  const [events, setEvents] = useState<EventRow[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<'events' | 'mine'>('events');
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [formValues, setFormValues] = useState<FieldValues>({});
  const [registrationKind, setRegistrationKind] = useState<'self' | 'proxy'>('self');
  const [multiMode, setMultiMode] = useState(false);
  const [activeAttendeeIndex, setActiveAttendeeIndex] = useState(0);
  const [attendeeMenuOpen, setAttendeeMenuOpen] = useState(false);
  const [proxyNote, setProxyNote] = useState('');
  const [participantCount, setParticipantCount] = useState(1);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<{ key: string; value: string } | null>(null);
  const datePickerSetterRef = useRef<((value: string) => void) | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerRefreshToast = useCallback((message: string) => {
    setToastMsg(message);
    toastFade.setValue(0);
    Animated.timing(toastFade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setToastMsg(null));
    }, 1000);
  }, [toastFade]);

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  const activeRegistrationByEvent = useMemo(() => {
    const map = new Map<string, Registration>();
    myRegistrations.forEach((registration) => {
      if (!map.has(registration.event_id) || registration.registration_kind === 'self') {
        map.set(registration.event_id, registration);
      }
    });
    return map;
  }, [myRegistrations]);

  const loadMine = useCallback(async () => {
    if (!user) {
      setMyRegistrations([]);
      return;
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .order('registered_at', { ascending: false });
    if (error) throw error;

    const registrations = (data || []) as Registration[];
    if (registrations.length === 0) {
      setMyRegistrations([]);
      return;
    }

    const { data: attendeeRows, error: attendeeError } = await supabase
      .from('event_registration_attendees')
      .select('*')
      .in('registration_id', registrations.map((item) => item.id))
      .order('sort_order', { ascending: true });
    if (attendeeError) throw attendeeError;

    const attendeeMap = new Map<string, Attendee[]>();
    (attendeeRows || []).forEach((row: any) => {
      const list = attendeeMap.get(row.registration_id) || [];
      list.push(row);
      attendeeMap.set(row.registration_id, list);
    });

    setMyRegistrations(registrations.map((item) => ({ ...item, attendees: attendeeMap.get(item.id) || [] })));
  }, [user]);

  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .is('deleted_at', null)
      .in('registration_status', ['open', 'closed', 'ended'])
      .order('start_time', { ascending: true });
    if (error) throw error;
    setEvents((data || []) as EventRow[]);
  }, []);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      await Promise.all([loadEvents(), loadMine()]);
      if (isRefresh) triggerRefreshToast('刷新成功');
    } catch (error) {
      console.warn('Failed to load event registrations:', error);
      if (isRefresh) triggerRefreshToast('刷新失败，请稍后重试');
      else Alert.alert('加载失败', '活动报名数据暂时无法加载，请稍后重试。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadEvents, loadMine, triggerRefreshToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadEventEditor = useCallback(async (nextEventId: string, nextRegistrationId?: string, detailOnly = false) => {
    setLoading(true);
    try {
      const [{ data: eventData, error: eventError }, { data: vehicleData, error: vehicleError }] = await Promise.all([
        supabase.from('events').select('*').eq('id', nextEventId).single(),
        supabase.from('event_vehicles').select('*').eq('event_id', nextEventId).eq('is_active', true).order('sort_order', { ascending: true }),
      ]);
      if (eventError) throw eventError;
      if (vehicleError) throw vehicleError;

      const event = eventData as EventRow;
      setSelectedEvent(event);
      setShowEventDetail(detailOnly && !nextRegistrationId);
      setVehicles((vehicleData || []) as Vehicle[]);

      let registration: Registration | null = null;
      const targetRegistrationId = nextRegistrationId || undefined;
      if (user && targetRegistrationId) {
        const { data, error } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('id', targetRegistrationId)
          .eq('user_id', user.id)
          .single();
        if (error) throw error;
        registration = data as Registration;
      }

      if (registration) {
        const { data: attendeeData, error: attendeeError } = await supabase
          .from('event_registration_attendees')
          .select('*')
          .eq('registration_id', registration.id)
          .order('sort_order', { ascending: true });
        if (attendeeError) throw attendeeError;
        registration = { ...registration, attendees: (attendeeData || []) as Attendee[] };
      }

      const defaultName = profile?.name || '';
      setEditingRegistration(registration);
      setFormValues(registration?.registration_kind === 'proxy'
        ? registration?.attendees?.[0]?.answers || {}
        : registration?.answers || {});
      setRegistrationKind(registration?.registration_kind || 'self');
      setMultiMode(false);
      setActiveAttendeeIndex(0);
      setAttendeeMenuOpen(false);
      setProxyNote(registration?.proxy_note || '');
      setParticipantCount(registration?.participant_count || 1);
      setAttendees(
        registration?.attendees?.length
          ? registration.attendees.map((item) => ({ name: item.name, phone: item.phone || '', email: item.email || '', answers: item.answers || registration?.answers || {}, vehicle_id: registration?.vehicle_id || null, proxy_note: registration?.proxy_note || '' }))
          : [{ name: defaultName, answers: registration?.answers || {}, vehicle_id: null, proxy_note: '' }]
      );
      setVehicleId(registration?.vehicle_id || null);
    } catch (error) {
      console.warn('Failed to load event registration editor:', error);
      Alert.alert('加载失败', '无法打开这个活动。');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [profile?.name, user]);

  useEffect(() => {
    if (eventId) loadEventEditor(eventId, registrationId, detailParam);
  }, [eventId, registrationId, detailParam, loadEventEditor]);

  const goBackToList = () => {
    setSelectedEvent(null);
    setEditingRegistration(null);
    setShowEventDetail(false);
    router.replace('/tools/events');
  };

  const openEventDetails = (event: EventRow) => {
    router.push({ pathname: '/tools/events', params: { eventId: event.id, detail: '1' } } as any);
  };

  const openNewRegistration = (event: EventRow) => {
    if (!user) {
      Alert.alert('需要登录', '登录后才能报名活动。', [
        { text: '取消', style: 'cancel' },
        { text: '去登录', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    const existing = activeRegistrationByEvent.get(event.id);
    if (existing && existing.registration_kind === 'self') {
      router.push({ pathname: '/tools/events', params: { eventId: event.id, registrationId: existing.id, detail: '0' } } as any);
      return;
    }
    router.push({ pathname: '/tools/events', params: { eventId: event.id, detail: '0' } } as any);
  };

  const startRegistration = (event: EventRow) => {
    openNewRegistration(event);
  };

  const openRegistration = (registration: Registration) => {
    const event = events.find((item) => item.id === registration.event_id);
    if (!event) return;
    router.push({ pathname: '/tools/events', params: { eventId: event.id, registrationId: registration.id } } as any);
  };

  const changeParticipantCount = (next: number) => {
    const safe = Math.max(multiMode ? 2 : 1, Math.min(100, next));
    setParticipantCount(safe);
    setAttendees((current) => {
      const normalized = current.slice(0, safe);
      while (normalized.length < safe) normalized.push({ name: '', answers: {}, vehicle_id: null, proxy_note: '' });
      return normalized;
    });
    setActiveAttendeeIndex((current) => Math.min(current, safe - 1));
    setAttendeeMenuOpen(false);
  };

  const updateAttendee = (index: number, patch: Partial<Attendee>) => {
    setAttendees((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const toggleMultiMode = (enabled: boolean) => {
    setMultiMode(enabled);
    setRegistrationKind('self');
    setActiveAttendeeIndex(0);
    setAttendeeMenuOpen(false);
    if (enabled) {
      setParticipantCount(2);
      setAttendees([
        { name: profile?.name || '', email: user?.email || '', answers: formValues, vehicle_id: vehicleId, proxy_note: '' },
        { name: '', answers: {}, vehicle_id: null, proxy_note: '' },
      ]);
    } else {
      const first = attendees[0];
      setParticipantCount(1);
      setFormValues(first?.answers || formValues);
      setVehicleId(first?.vehicle_id || null);
      setAttendees([{ name: profile?.name || '', email: user?.email || '', answers: first?.answers || formValues, vehicle_id: first?.vehicle_id || null, proxy_note: '' }]);
    }
  };

  const uploadFile = async (field: EventFormField, setAnswers: (updater: (current: FieldValues) => FieldValues) => void, uploadKey = field.key) => {
    if (!user || !selectedEvent) return;
    setUploadingField(uploadKey);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: field.accept?.length ? field.accept : '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const maxBytes = (field.maxFileSizeMb || 10) * 1024 * 1024;
      if (asset.size && asset.size > maxBytes) {
        throw new Error(`文件不能超过 ${field.maxFileSizeMb || 10} MB。`);
      }
      const bytes = Platform.OS === 'web'
        ? await (await fetch(asset.uri)).arrayBuffer()
        : await new File(asset.uri).arrayBuffer();
      if (bytes.byteLength > maxBytes) throw new Error(`文件不能超过 ${field.maxFileSizeMb || 10} MB。`);

      const safeName = (asset.name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${user.id}/${selectedEvent.id}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('event-attachments').upload(path, bytes, {
        contentType: asset.mimeType || 'application/octet-stream',
        upsert: false,
      });
      if (error) throw error;
      setAnswers((current) => ({
        ...current,
        [field.key]: { path, name: asset.name || safeName, size: asset.size || bytes.byteLength },
      }));
    } catch (error: any) {
      Alert.alert('上传失败', error?.message || '文件上传失败，请重试。');
    } finally {
      setUploadingField(null);
    }
  };

  const submit = async () => {
    if (!user || !selectedEvent) {
      Alert.alert('需要登录', '请先登录后再报名。');
      return;
    }
    if (!multiMode && registrationKind === 'proxy' && !proxyNote.trim()) {
      Alert.alert('请补充备注', '代他人报名时，请说明这个人是谁。');
      return;
    }
    if (multiMode) {
      const incompleteIndex = attendees.findIndex((item, index) => index > 0 && !item.proxy_note?.trim());
      if (incompleteIndex >= 0) {
        Alert.alert('请补充报名对象', `请填写报名人 ${incompleteIndex + 1} 的备注。`);
        return;
      }
    }
    if (selectedEvent.vehicle_selection_mode === 'self_select' && (multiMode ? attendees.some((item) => !item.vehicle_id) : !vehicleId)) {
      Alert.alert('请选择车辆', '请先选择要乘坐的车辆。');
      return;
    }
    const registrationFields = (selectedEvent.registration_form || DEFAULT_FIELDS).filter((field) => !field.system);
    const answerSets = multiMode ? attendees.map((item) => item.answers || {}) : [formValues];
    for (let index = 0; index < answerSets.length; index += 1) {
      const missing = registrationFields.find((field) => {
        if (!field.required) return false;
        const value = answerSets[index][field.key];
        return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || (field.type === 'checkbox' && value !== true);
      });
      if (missing) {
        Alert.alert('请补充报名信息', `请填写报名对象 ${index + 1} 的“${missing.label}”。`);
        return;
      }
      const invalidEmail = registrationFields.find((field) => {
        if (field.type !== 'email') return false;
        const value = answerSets[index][field.key];
        return value !== undefined && value !== null && String(value).trim() !== ''
          && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value));
      });
      if (invalidEmail) {
        Alert.alert('邮箱格式不正确', `报名对象 ${index + 1} 的“${invalidEmail.label}”不是有效的邮箱地址。`);
        return;
      }
      const invalidNumber = registrationFields.find((field) => {
        if (field.type !== 'number') return false;
        const value = answerSets[index][field.key];
        return value !== undefined && value !== null && value !== ''
          && (typeof value !== 'number' || !Number.isFinite(value));
      });
      if (invalidNumber) {
        Alert.alert('数字格式不正确', `报名对象 ${index + 1} 的“${invalidNumber.label}”需要填写有效数字。`);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (multiMode) {
        const participants = attendees.map((item, index) => ({
          name: index === 0 ? (profile?.name?.trim() || user.email || '本人') : (item.proxy_note?.trim() || `报名人 ${index + 1}`),
          phone: item.phone?.trim() || null,
          email: index === 0 ? (user.email || item.email?.trim() || null) : (item.email?.trim() || null),
          answers: item.answers || {},
          vehicle_id: item.vehicle_id || null,
          proxy_note: index === 0 ? null : item.proxy_note?.trim() || null,
        }));
        const { data, error } = await supabase.rpc('submit_event_registration_group', {
          p_event_id: selectedEvent.id,
          p_participants: participants,
          p_source: 'app',
        } as any);
        if (error) throw error;
        const results = Array.isArray(data) ? data : [];
        const waitlistCount = results.filter((item: any) => item.registration_status === 'waitlist').length;
        Alert.alert(
          '多人报名已提交',
          waitlistCount > 0
            ? `${participants.length} 人的信息已保存，其中 ${waitlistCount} 人进入候补。`
            : `${participants.length} 人的报名信息已全部保存。`,
          [{ text: '好的', onPress: () => { loadAll(); goBackToList(); } }]
        );
        return;
      }

      const selfAnswers = formValues;
      const attendeePayload = registrationKind === 'proxy'
        ? attendees.map((item) => ({
            name: item.name.trim(),
            phone: item.phone?.trim() || null,
            email: item.email?.trim() || null,
            answers: item.answers || {},
          }))
        : [{
            name: profile?.name?.trim() || attendees[0]?.name?.trim() || user.email || '本人',
            phone: attendees[0]?.phone?.trim() || null,
            email: attendees[0]?.email?.trim() || user.email || null,
            answers: selfAnswers,
          }];
      const answers = selfAnswers;
      const rpcName = editingRegistration ? 'update_event_registration' : 'submit_event_registration';
      const rpcArgs = editingRegistration
        ? {
            p_registration_id: editingRegistration.id,
            p_proxy_note: proxyNote.trim() || null,
            p_participant_count: participantCount,
            p_answers: answers,
            p_attendees: attendeePayload,
            p_vehicle_id: vehicleId,
          }
        : {
            p_event_id: selectedEvent.id,
            p_registration_kind: registrationKind,
            p_proxy_note: proxyNote.trim() || null,
            p_participant_count: participantCount,
            p_answers: answers,
            p_attendees: attendeePayload,
            p_vehicle_id: vehicleId,
            p_source: 'app',
          };
      const { data, error } = await supabase.rpc(rpcName, rpcArgs as any);
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const assignedVehicleName = result?.assigned_vehicle_id
        ? vehicles.find((vehicle) => vehicle.id === result.assigned_vehicle_id)?.name
        : undefined;
      Alert.alert(
        editingRegistration ? '报名已更新' : '报名成功',
        result?.registration_status === 'waitlist'
          ? '当前名额已满，你已进入候补名单。'
          : assignedVehicleName
            ? `报名信息已保存，已分配车辆：${assignedVehicleName}。`
            : '报名信息已保存，可以在“我的报名”中查看。',
        [{ text: '好的', onPress: () => { loadAll(); goBackToList(); } }]
      );
    } catch (error: any) {
      Alert.alert('提交失败', errorMessage(error, '报名暂时无法提交，请稍后重试。', registrationFields));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRegistration = () => {
    if (!editingRegistration) return;
    Alert.alert('取消报名', '取消后会释放车辆座位，确定继续吗？', [
      { text: '返回', style: 'cancel' },
      {
        text: '确认取消',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.rpc('cancel_event_registration', { p_registration_id: editingRegistration.id });
            if (error) throw error;
            Alert.alert('已取消', '报名已取消。', [{ text: '好的', onPress: () => { loadAll(); goBackToList(); } }]);
          } catch (error: any) {
            Alert.alert('操作失败', errorMessage(error, '取消报名失败，请稍后重试。'));
          }
        },
      },
    ]);
  };

  const renderField = (
    field: EventFormField,
    values: FieldValues = formValues,
    setAnswers: (updater: (current: FieldValues) => FieldValues) => void = (updater) => setFormValues(updater),
    uploadKey = field.key,
  ) => {
    const value = values[field.key];
    const setValue = (next: any) => setAnswers((current) => ({ ...current, [field.key]: next }));
    const inputKeyboard = field.type === 'email' ? 'email-address' : field.type === 'phone' ? 'phone-pad' : field.type === 'number' ? 'numeric' : 'default';
    const openDatePicker = () => {
      datePickerSetterRef.current = setValue;
      setDatePickerTarget({ key: uploadKey, value: typeof value === 'string' ? value : '' });
    };
    const handleDateChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
      if (!selectedDate) return;
      datePickerSetterRef.current?.(dateFieldValue(selectedDate));
      datePickerSetterRef.current = null;
      setDatePickerTarget(null);
    };

    return (
      <View key={field.key} style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{fieldLabel(field)}</Text>
        {field.description ? <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>{field.description}</Text> : null}
        {field.type === 'textarea' ? (
          <TextInput
            multiline
            value={value || ''}
            onChangeText={setValue}
            placeholder={field.placeholder}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textarea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
        ) : field.type === 'select' || field.type === 'multiselect' ? (
          <View style={styles.optionList}>
            {(field.options || []).map((option) => {
              const selected = field.type === 'multiselect' ? Array.isArray(value) && value.includes(option) : value === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    if (field.type === 'multiselect') {
                      const current = Array.isArray(value) ? value : [];
                      setValue(selected ? current.filter((item: string) => item !== option) : [...current, option]);
                    } else {
                      setValue(option);
                    }
                  }}
                  style={[styles.optionRow, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : colors.surface }]}
                >
                  <MaterialCommunityIcons name={selected ? 'checkbox-marked-circle' : 'circle-outline'} size={20} color={selected ? colors.primary : colors.textMuted} />
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : field.type === 'checkbox' ? (
          <Pressable style={styles.checkboxRow} onPress={() => setValue(!value)}>
            <Switch value={Boolean(value)} onValueChange={setValue} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={value ? colors.primary : colors.textMuted} />
            <Text style={[styles.checkboxText, { color: colors.textSecondary }]}>{field.placeholder || '我确认以上信息真实有效'}</Text>
          </Pressable>
        ) : field.type === 'file' ? (
          <Pressable
            style={[styles.fileButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => uploadFile(field, setAnswers, uploadKey)}
            disabled={uploadingField === uploadKey}
          >
            {uploadingField === uploadKey ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="paperclip" size={20} color={colors.primary} />}
            <Text style={[styles.fileButtonText, { color: colors.textPrimary }]}>{value?.name || '选择文件'}</Text>
          </Pressable>
        ) : field.type === 'date' ? (
          <>
            <Pressable
              onPress={openDatePicker}
              style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <MaterialCommunityIcons name="calendar-month-outline" size={19} color={colors.primary} />
              <Text style={{ color: value ? colors.textPrimary : colors.textMuted }}>
                {dateFieldLabel(value) || field.placeholder || '选择日期'}
              </Text>
            </Pressable>
            {datePickerTarget?.key === uploadKey ? (
              <View style={styles.pickerPanel}>
                <DateTimePicker
                  value={dateFieldDate(datePickerTarget.value)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onValueChange={handleDateChange}
                  onDismiss={() => {
                    datePickerSetterRef.current = null;
                    setDatePickerTarget(null);
                  }}
                />
              </View>
            ) : null}
          </>
        ) : (
          <TextInput
            value={value === undefined || value === null ? '' : String(value)}
            onChangeText={(text) => setValue(field.type === 'number' ? (text ? Number(text) : '') : text)}
            placeholder={field.placeholder}
            placeholderTextColor={colors.textMuted}
            keyboardType={inputKeyboard as any}
            autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
        )}
      </View>
    );
  };

  const renderEventList = () => (
    <>
      <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <MaterialCommunityIcons name="arrow-left" size={23} color="#A31621" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>活动报名</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={[styles.segmented, { backgroundColor: colors.surfaceElevated }]}>
        <Pressable style={[styles.segment, activeView === 'events' && { backgroundColor: colors.surface }]} onPress={() => setActiveView('events')}>
          <Text style={[styles.segmentText, { color: activeView === 'events' ? colors.primary : colors.textSecondary }]}>近期活动</Text>
        </Pressable>
        <Pressable style={[styles.segment, activeView === 'mine' && { backgroundColor: colors.surface }]} onPress={() => setActiveView('mine')}>
          <Text style={[styles.segmentText, { color: activeView === 'mine' ? colors.primary : colors.textSecondary }]}>我的报名</Text>
        </Pressable>
      </View>

      {activeView === 'events' ? (
        events.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={42} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>暂无近期活动</Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>新的活动开放后会显示在这里。</Text>
          </View>
        ) : events.map((event) => {
          return (
            <Pressable key={event.id} onPress={() => openEventDetails(event)} style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
              {formatEventTime(event) ? <View style={styles.metaRow}><MaterialCommunityIcons name="clock-outline" size={16} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatEventTime(event)}</Text></View> : null}
              {event.location ? <View style={styles.metaRow}><Text style={[styles.metaText, { color: colors.textSecondary }]}>{event.location}</Text></View> : null}
            </Pressable>
          );
        })
      ) : (
        !user ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-lock-outline" size={42} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>登录后查看我的报名</Text>
            <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 14 }]} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.primaryButtonText}>去登录</Text>
            </Pressable>
          </View>
        ) : myRegistrations.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={42} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>还没有报名记录</Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>报名成功后，记录会显示在这里。</Text>
          </View>
        ) : myRegistrations.map((registration) => {
          const event = events.find((item) => item.id === registration.event_id);
          return (
            <Pressable key={registration.id} style={[styles.registrationCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => openRegistration(registration)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.registrationTitle, { color: colors.textPrimary }]}>{event?.title || '活动报名'}</Text>
                {registration.participant_count > 1 ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>报名人数：{registration.participant_count}</Text> : null}
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>报名编号：{registration.registration_number || registration.id.slice(0, 8)}</Text>
              </View>
              <Text style={[styles.statusText, { color: registration.status === 'waitlist' ? '#B7791F' : colors.success }]}>{registration.status === 'waitlist' ? '候补' : '已确认'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
            </Pressable>
          );
        })
      )}
    </>
  );

  const renderEventDetails = () => {
    if (!selectedEvent) return null;
    const existing = activeRegistrationByEvent.get(selectedEvent.id);
    const ended = selectedEvent.registration_status === 'ended'
      || (selectedEvent.has_end_date !== false && new Date(selectedEvent.end_time).getTime() < Date.now());
    const registrationClosed = selectedEvent.registration_status !== 'open';
    const disabled = ended || registrationClosed;
    return (
      <>
        <View style={styles.header}>
          <Pressable onPress={goBackToList} style={styles.headerButton}><MaterialCommunityIcons name="arrow-left" size={23} color="#A31621" /></Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>活动详情</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.eventDetails}>
          <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{selectedEvent.title}</Text>
          <HandbookMarkdownPreview value={selectedEvent.description} plain />
          {formatEventTime(selectedEvent) ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatEventTime(selectedEvent)}</Text> : null}
          {selectedEvent.location ? <Text style={[styles.metaText, { color: colors.textSecondary, marginTop: 6 }]}>地点：{selectedEvent.location}</Text> : null}
        </View>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.primary }, disabled && { opacity: 0.55 }]}
          onPress={() => startRegistration(selectedEvent)}
          disabled={disabled}
        >
          <Text style={styles.primaryButtonText}>{ended ? '活动已结束' : registrationClosed ? '报名已截止' : existing ? '查看我的报名' : '立即报名'}</Text>
        </Pressable>
      </>
    );
  };

  const renderEditor = () => {
    if (!selectedEvent) return null;
    const fields = (selectedEvent.registration_form || DEFAULT_FIELDS).filter((field) => !field.system);
    const activeAttendee = attendees[activeAttendeeIndex] || attendees[0];
    const activeVehicleId = multiMode ? activeAttendee?.vehicle_id || null : vehicleId;
    const setActiveVehicleId = (nextVehicleId: string) => {
      if (multiMode) updateAttendee(activeAttendeeIndex, { vehicle_id: nextVehicleId });
      else setVehicleId(nextVehicleId);
    };
    return (
      <>
        <View style={styles.header}>
          <Pressable onPress={goBackToList} style={styles.headerButton}><MaterialCommunityIcons name="arrow-left" size={23} color="#A31621" /></Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{editingRegistration ? '修改报名' : '填写报名'}</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.eventDetails}>
          <HandbookMarkdownPreview value={selectedEvent.description} plain />
          {formatEventTime(selectedEvent) ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatEventTime(selectedEvent)}</Text> : null}
          {selectedEvent.location ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>地点：{selectedEvent.location}</Text> : null}
        </View>

        {selectedEvent.allow_proxy_registration && !editingRegistration ? (
          <View style={[styles.proxyPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.textPrimary, marginBottom: 2 }]}>多人报名</Text><Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>报名人 1 为当前账号本人，可继续添加其他报名人。</Text></View>
              <Switch value={multiMode} onValueChange={toggleMultiMode} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={multiMode ? colors.primary : colors.textMuted} />
            </View>
            {multiMode ? <>
              <View style={styles.counterRow}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>报名人数</Text>
                <View style={styles.counterControls}>
                  <Pressable onPress={() => changeParticipantCount(participantCount - 1)} style={[styles.counterButton, { borderColor: colors.border }]}><Text style={[styles.counterButtonText, { color: colors.textPrimary }]}>-</Text></Pressable>
                  <Text style={[styles.counterValue, { color: colors.textPrimary }]}>{participantCount}</Text>
                  <Pressable onPress={() => changeParticipantCount(participantCount + 1)} style={[styles.counterButton, { borderColor: colors.border }]}><Text style={[styles.counterButtonText, { color: colors.textPrimary }]}>+</Text></Pressable>
                </View>
              </View>
              <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>当前填写</Text>
              <Pressable onPress={() => setAttendeeMenuOpen((value) => !value)} style={[styles.attendeeSelect, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.optionText, { color: colors.textPrimary }]}>报名人 {activeAttendeeIndex + 1}{activeAttendeeIndex === 0 ? '（本人）' : activeAttendee?.proxy_note ? `（${activeAttendee.proxy_note}）` : ''}</Text>
                <MaterialCommunityIcons name={attendeeMenuOpen ? 'chevron-up' : 'chevron-down'} size={21} color={colors.textSecondary} />
              </Pressable>
              {attendeeMenuOpen ? <View style={[styles.attendeeMenu, { borderColor: colors.border, backgroundColor: colors.surface }]}>{attendees.map((attendee, index) => <Pressable key={index} onPress={() => { setActiveAttendeeIndex(index); setAttendeeMenuOpen(false); }} style={[styles.attendeeMenuItem, index < attendees.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}><Text style={{ color: index === activeAttendeeIndex ? colors.primary : colors.textPrimary }}>报名人 {index + 1}{index === 0 ? '（本人）' : attendee.proxy_note ? `（${attendee.proxy_note}）` : ''}</Text>{index === activeAttendeeIndex ? <MaterialCommunityIcons name="check" size={18} color={colors.primary} /> : null}</Pressable>)}</View> : null}
              {activeAttendeeIndex === 0 ? <Text style={[styles.selfRegistrant, { color: colors.textSecondary }]}>当前账号：{profile?.name || user?.email || '本人'}</Text> : <View style={styles.attendeeBlock}>
                <TextInput value={activeAttendee?.proxy_note || ''} onChangeText={(proxy_note) => updateAttendee(activeAttendeeIndex, { proxy_note })} placeholder="备注：说明报名对象是谁" placeholderTextColor={colors.textMuted} multiline style={[styles.input, styles.proxyNoteInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]} />
              </View>}
            </> : null}
          </View>
        ) : null}

        {editingRegistration?.registration_kind === 'proxy' ? <View style={[styles.proxyPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>报名对象备注</Text><TextInput value={proxyNote} onChangeText={setProxyNote} placeholder="说明报名对象是谁" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]} /></View> : null}

        {fields.length > 0 ? <View style={[styles.sectionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>报名信息{multiMode ? ` · 报名人 ${activeAttendeeIndex + 1}` : ''}</Text>
          {multiMode
            ? fields.map((field) => renderField(field, activeAttendee?.answers || {}, (updater) => setAttendees((current) => current.map((item, itemIndex) => itemIndex === activeAttendeeIndex ? { ...item, answers: updater(item.answers || {}) } : item)), `attendee-${activeAttendeeIndex}-${field.key}`))
            : fields.map((field) => renderField(field))}
        </View> : null}

        {selectedEvent.vehicle_selection_mode === 'self_select' && (
          <View style={[styles.sectionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>选择车辆</Text>
            {vehicles.length === 0 ? <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>管理员还没有设置车辆。</Text> : vehicles.map((vehicle) => {
              const selected = activeVehicleId === vehicle.id;
              return <Pressable key={vehicle.id} onPress={() => setActiveVehicleId(vehicle.id)} style={[styles.vehicleRow, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : colors.surface }]}><MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={selected ? colors.primary : colors.textMuted} /><View style={{ flex: 1, marginLeft: 10 }}><Text style={[styles.optionText, { color: colors.textPrimary }]}>{vehicle.name}</Text>{vehicle.boarding_stop ? <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>{vehicle.boarding_stop}</Text> : null}</View><Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>{vehicle.capacity} 座</Text></Pressable>;
            })}
          </View>
        )}

        {vehicleId && selectedEvent.vehicle_selection_mode !== 'self_select' ? <View style={[styles.assignedVehicle, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>已分配车辆</Text><Text style={[styles.optionText, { color: colors.textPrimary }]}>{vehicles.find((vehicle) => vehicle.id === vehicleId)?.name || '待确认'}</Text></View> : null}

        <Pressable style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>{editingRegistration ? '保存修改' : multiMode ? `提交 ${participantCount} 人报名` : '提交报名'}</Text>}
        </Pressable>
        {editingRegistration ? <Pressable style={[styles.cancelButton, { borderColor: colors.error }]} onPress={cancelRegistration}><Text style={[styles.cancelButtonText, { color: colors.error }]}>取消报名</Text></Pressable> : null}
      </>
    );
  };

  if (loading && !selectedEvent && events.length === 0) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={selectedEvent ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void loadAll(true); }}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={42}
          />
        )}
      >
        {selectedEvent ? (showEventDetail ? renderEventDetails() : renderEditor()) : renderEventList()}
      </ScrollView>
      {toastMsg ? <Animated.View style={[styles.checkmarkBubble, { opacity: toastFade, backgroundColor: toastMsg === '刷新成功' ? '#FFFFFF' : colors.surface, borderColor: toastMsg === '刷新成功' ? 'transparent' : colors.primary }]}>
        {toastMsg === '刷新成功' ? <MaterialCommunityIcons name="check" size={24} color={colors.primary} /> : <Text style={[styles.toastText, { color: colors.primary }]}>{toastMsg}</Text>}
      </Animated.View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 40 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -16, paddingHorizontal: 16, marginBottom: 8 },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  checkmarkBubble: { position: 'absolute', top: Platform.OS === 'ios' ? 72 : 110, left: '50%', marginLeft: -20, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 4, zIndex: 99999 },
  toastText: { fontSize: 13, fontWeight: '700' },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 16 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
  segmentText: { fontSize: 14, fontWeight: '600' },
  eventCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  eventTitle: { fontSize: 18, fontWeight: '700', marginBottom: 7 },
  detailTitle: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  metaText: { fontSize: 13, lineHeight: 19 },
  statusText: { fontSize: 13, fontWeight: '700' },
  primaryButton: { minWidth: 92, alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8 },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 14 },
  emptyDescription: { fontSize: 14, marginTop: 6, textAlign: 'center' },
  registrationCard: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  registrationTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  eventDetails: { marginBottom: 12 },
  proxyPanel: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  sectionPanel: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 7 },
  fieldDescription: { fontSize: 12, lineHeight: 18, marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15 },
  textarea: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' },
  optionList: { gap: 8 },
  optionRow: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionText: { fontSize: 14 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxText: { flex: 1, fontSize: 13, lineHeight: 19 },
  fileButton: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileButtonText: { flex: 1, fontSize: 14 },
  dateButton: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerPanel: { alignItems: 'center', paddingVertical: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  counterButton: { width: 32, height: 32, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  counterButtonText: { fontSize: 20, lineHeight: 22 },
  counterValue: { minWidth: 20, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  attendeeBlock: { marginTop: 12, marginBottom: 13 },
  attendeeSelect: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attendeeMenu: { borderWidth: 1, borderRadius: 8, marginTop: 6, overflow: 'hidden' },
  attendeeMenuItem: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selfRegistrant: { fontSize: 13, marginTop: 12, marginBottom: 4 },
  proxyNoteInput: { minHeight: 74, paddingTop: 11, textAlignVertical: 'top' },
  assignedVehicle: { borderWidth: 1, borderRadius: 9, padding: 13, marginBottom: 12 },
  vehicleRow: { minHeight: 56, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  submitButton: { minHeight: 50, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cancelButton: { minHeight: 48, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  cancelButtonText: { fontSize: 15, fontWeight: '700' },
});
