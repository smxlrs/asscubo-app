import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { supabase, EventFormField, EventFormFieldType } from '../../lib/supabase';
import { appAlert as Alert } from '../../lib/appAlert';
import { HandbookMarkdownEditor } from '../../components/HandbookMarkdownEditor';
import { HandbookMarkdownPreview } from '../../components/HandbookMarkdownPreview';
import { broadcastPushNotification, sendExpoPushMessages } from '../../lib/notificationService';
import { EVENT_TIME_ZONE, localDateInput, normalizeEventTimes, romeToIso } from '../../lib/eventTime';

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
  is_published: boolean;
  registration_deadline: string | null;
  registration_status: 'draft' | 'open' | 'closed' | 'ended' | 'archived';
  registration_start_at: string | null;
  registration_start_notify_enabled: boolean;
  registration_form: EventFormField[] | null;
  registration_form_version: number;
  revision: number;
  vehicle_selection_mode: 'none' | 'auto' | 'self_select' | 'admin';
  allow_proxy_registration: boolean;
  allow_waitlist: boolean;
  deleted_at: string | null;
};

type VehicleDraft = {
  id?: string;
  name: string;
  capacity: string;
  reserved_seats: string;
  boarding_stop: string;
  departure_time: string;
  notes: string;
  is_active: boolean;
};

type RegistrationRow = {
  id: string;
  user_id: string | null;
  status: 'confirmed' | 'cancelled' | 'waitlist';
  registration_kind: 'self' | 'proxy';
  proxy_note: string | null;
  participant_count: number;
  answers: Record<string, any>;
  vehicle_id: string | null;
  registration_number: string | null;
  registered_at: string;
  revision: number;
  form_snapshot: EventFormField[] | null;
  registered_by_name?: string | null;
  registered_by_email?: string | null;
  attendees?: Array<{ name: string; phone: string | null; email: string | null; answers?: Record<string, any> }>;
};

type RegistrationEditorState = {
  registration: RegistrationRow;
  name: string;
  phone: string;
  email: string;
  proxy_note: string;
  answers: Record<string, any>;
  vehicle_id: string | null;
};

type ExportSnapshot = { event: EventRow; vehicles: Array<{ id: string; name: string; sort_order: number; is_active?: boolean }>; registrations: RegistrationRow[] };
type NotificationJobRow = {
  status: 'pending' | 'processing' | 'sent' | 'partial' | 'failed' | 'cancelled';
  sent_count: number; failed_count: number; attempts: number;
  last_error: string | null; next_attempt_at: string | null; created_at: string;
};

const FIELD_TYPES: Array<{ type: EventFormFieldType; label: string }> = [
  { type: 'text', label: '文本' },
  { type: 'textarea', label: '长文本' },
  { type: 'email', label: '邮箱' },
  { type: 'phone', label: '电话' },
  { type: 'select', label: '单选' },
  { type: 'multiselect', label: '多选' },
  { type: 'checkbox', label: '勾选' },
  { type: 'number', label: '数字' },
  { type: 'date', label: '日期' },
];

function inputDate(value: string) {
  const iso = romeToIso(value);
  return iso ? new Date(iso) : new Date();
}

function dateInputValue(date: Date) {
  return localDateInput(date.toISOString());
}

function dateLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : '请选择日期';
}

function timeLabel(value: string) {
  const match = value.match(/\s(\d{1,2}):(\d{2})$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '设置时间';
}

function csvCell(value: any) {
  const raw = value === null || value === undefined ? '' : String(value);
  const text = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Europe/Rome', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}

function adminErrorMessage(error: any, fallback: string) {
  const message = String(error?.message || '');
  if (/revision|conflict|changed.*reload/i.test(message)) return '信息已被其他人修改。请返回列表刷新，并重新打开最新信息后再编辑。';
  if (message.includes('capacity is below') || message.includes('capacity is below its')) return '当前人数已超过新上限，请先调整报名或车辆配置。';
  if (message.includes('enough seats') || message.includes('vehicle is unavailable')) return '所选车辆座位已满或不可用，请刷新名单后重试。';
  if (message.includes('This event is full')) return '活动总人数已满，无法将候补加入正式名单。';
  if (message.includes('Required registration field')) return '当前表单有必填项尚未填写，请检查报名答案。';
  if (message.includes('Invalid email') || message.includes('Invalid attendee email')) return '邮箱格式不正确，请检查后重试。';
  if (message.includes('Invalid phone') || message.includes('Invalid attendee phone')) return '电话格式不正确，请检查后重试。';
  if (message.includes('Invalid date')) return '日期无效，请重新选择。';
  if (/fetch|network|timeout|connection|failed to/i.test(message)) return '网络中断，操作结果可能已保存。请刷新列表确认后再试。';
  return fallback;
}

function FormLabel({ children, colors, optional = false }: { children: React.ReactNode; colors: any; optional?: boolean }) {
  return <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 5 }}>{children}{optional ? '（可选）' : ''}</Text>;
}

function registrationSubmitter(registration: RegistrationRow) {
  if (!registration.user_id) return '已注销账户';
  const name = registration.registered_by_name || '未设置昵称';
  return `${name}${registration.registered_by_email ? `（${registration.registered_by_email}）` : ''}`;
}

export default function ManageEventsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hasEndDate, setHasEndDate] = useState(true);
  const [startHasTime, setStartHasTime] = useState(false);
  const [endHasTime, setEndHasTime] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'startDate' | 'endDate' | 'startTime' | 'endTime' | 'registrationStartDate' | 'registrationStartTime' | 'deadlineDate' | 'deadlineTime' | null>(null);
  const [registrationStart, setRegistrationStart] = useState('');
  const [deadline, setDeadline] = useState('');
  const [registrationStartEnabled, setRegistrationStartEnabled] = useState(false);
  const [registrationStartNotifyEnabled, setRegistrationStartNotifyEnabled] = useState(false);
  const [deadlineEnabled, setDeadlineEnabled] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [published, setPublished] = useState(false);
  const [status, setStatus] = useState<'draft' | 'open' | 'closed' | 'ended' | 'archived'>('draft');
  const [allowProxy, setAllowProxy] = useState(false);
  const [allowWaitlist, setAllowWaitlist] = useState(true);
  const [vehicleMode, setVehicleMode] = useState<'none' | 'auto' | 'self_select' | 'admin'>('none');
  const [fields, setFields] = useState<EventFormField[]>([]);
  const [descriptionPreview, setDescriptionPreview] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const initialDraftSignature = useRef('');
  const [vehicles, setVehicles] = useState<VehicleDraft[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [vehicleLookup, setVehicleLookup] = useState<Record<string, string>>({});
  const [activeVehicleIds, setActiveVehicleIds] = useState<string[]>([]);
  const [busyRegistration, setBusyRegistration] = useState<string | null>(null);
  const [registrationEditor, setRegistrationEditor] = useState<RegistrationEditorState | null>(null);
  const [registrationDetail, setRegistrationDetail] = useState<RegistrationRow | null>(null);
  const [registrationDateField, setRegistrationDateField] = useState<string | null>(null);
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationSort, setRegistrationSort] = useState<'registered_asc' | 'registered_desc' | 'name_asc' | 'name_desc' | 'status'>('registered_asc');
  const [registrationPage, setRegistrationPage] = useState(0);
  const [registrationSyncState, setRegistrationSyncState] = useState<'loading' | 'current' | 'stale'>('loading');
  const [registrationLastSynced, setRegistrationLastSynced] = useState<string | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedExportKeys, setSelectedExportKeys] = useState<string[]>([]);
  const [exportSnapshot, setExportSnapshot] = useState<ExportSnapshot | null>(null);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [notificationJob, setNotificationJob] = useState<NotificationJobRow | null>(null);
  const [notificationJobReadState, setNotificationJobReadState] = useState<'loading' | 'ready' | 'unconfigured' | 'error'>('loading');
  const notificationJobLoadVersion = useRef(0);
  const registrationLoadVersion = useRef(0);
  const registrationRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentDraftSignature = useMemo(() => JSON.stringify({
    title, description, location, startTime, endTime, hasEndDate, startHasTime, endHasTime,
    registrationStart, deadline, registrationStartEnabled, registrationStartNotifyEnabled, deadlineEnabled, maxParticipants, published, status, allowProxy, allowWaitlist,
    vehicleMode, fields, vehicles,
  }), [title, description, location, startTime, endTime, hasEndDate, startHasTime, endHasTime,
    registrationStart, deadline, registrationStartEnabled, registrationStartNotifyEnabled, deadlineEnabled, maxParticipants, published, status, allowProxy, allowWaitlist,
    vehicleMode, fields, vehicles]);

  useEffect(() => {
    if (editing) initialDraftSignature.current = currentDraftSignature;
  }, [editing]);

  const isDirty = editing && initialDraftSignature.current !== '' && currentDraftSignature !== initialDraftSignature.current;

  const cancelEditing = () => {
    if (!isDirty) {
      setPreviewing(false);
      setEditing(false);
      return;
    }
    Alert.alert('改动未保存，是否确认退出？', undefined, [
      { text: '返回编辑', style: 'cancel' },
      { text: '确认退出', style: 'destructive', onPress: () => { setPreviewing(false); setEditing(false); } },
    ]);
  };

  const returnToEventList = useCallback(() => {
    setPreviewing(false);
    setEditing(false);
    setEvent(null);
    setSelectedId(null);
    setRegistrations([]);
    setVehicleLookup({});
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (navigationEvent: any) => {
      if (editing) {
        navigationEvent.preventDefault();
        cancelEditing();
        return;
      }
      if (event) {
        navigationEvent.preventDefault();
        returnToEventList();
      }
    });

    return unsubscribe;
  }, [navigation, editing, event, cancelEditing, returnToEventList]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('events').select('*').order('start_time', { ascending: false });
      if (error) throw error;
      setEvents((data || []) as EventRow[]);
    } catch (error: any) {
      Alert.alert('加载失败', error?.message || '活动列表加载失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const loadNotificationJob = useCallback(async (eventId: string) => {
    const version = ++notificationJobLoadVersion.current;
    try {
      const { data, error } = await supabase.from('event_registration_notification_jobs')
        .select('status,sent_count,failed_count,attempts,last_error,next_attempt_at,created_at')
        .eq('event_id', eventId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (version !== notificationJobLoadVersion.current) return;
      if (error) {
        setNotificationJobReadState(['42P01', 'PGRST205'].includes(error.code) ? 'unconfigured' : 'error');
        return;
      }
      setNotificationJob(data as NotificationJobRow | null);
      setNotificationJobReadState('ready');
    } catch {
      if (version === notificationJobLoadVersion.current) setNotificationJobReadState('error');
    }
  }, []);

  const loadRegistrations = useCallback(async (eventId: string) => {
    const version = ++registrationLoadVersion.current;
    setRegistrationSyncState('loading');
    try {
      const rows = new Map<string, RegistrationRow>();
      let cursor: Pick<RegistrationRow, 'id' | 'registered_at'> | null = null;
      for (;;) {
        const { data, error } = await supabase.rpc('admin_event_registration_page', {
          p_event_id: eventId, p_offset: 0, p_limit: 100,
          p_before_registered_at: cursor?.registered_at ?? null,
          p_before_id: cursor?.id ?? null,
        });
        if (error) throw error;
        if (version !== registrationLoadVersion.current) return;
        const page = (data || []) as RegistrationRow[];
        page.forEach((row) => rows.set(row.id, row));
        if (page.length < 100) break;
        cursor = page[page.length - 1];
      }
      const { data: vehicleData, error: vehicleError } = await supabase.from('event_vehicles')
        .select('*').eq('event_id', eventId).order('sort_order', { ascending: true });
      if (vehicleError) throw vehicleError;
      if (version !== registrationLoadVersion.current) return;
      setRegistrations([...rows.values()]);
      setRegistrationDetail((current) => current ? rows.get(current.id) || null : null);
      const lookup: Record<string, string> = {};
      (vehicleData || []).forEach((vehicle: any) => { lookup[vehicle.id] = vehicle.name; });
      setVehicleLookup(lookup);
      setActiveVehicleIds((vehicleData || []).filter((vehicle: any) => vehicle.is_active !== false).map((vehicle: any) => vehicle.id));
      setRegistrationLastSynced(new Date().toISOString());
      setRegistrationSyncState('current');
    } catch (error) {
      if (version === registrationLoadVersion.current) setRegistrationSyncState('stale');
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const refresh = () => {
      if (registrationRefreshTimer.current) clearTimeout(registrationRefreshTimer.current);
      registrationRefreshTimer.current = setTimeout(() => {
        void loadRegistrations(selectedId).catch((error) => console.warn('Failed to refresh event registrations:', error));
        void loadNotificationJob(selectedId);
      }, 500);
    };
    const channel = supabase
      .channel(`event-registration-${selectedId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_registrations',
        filter: `event_id=eq.${selectedId}`,
      }, refresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_registration_attendees',
      }, refresh)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_vehicles', filter: `event_id=eq.${selectedId}`,
      }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRegistrationSyncState('stale');
      });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    // Also recover changes missed while the websocket was unavailable.
    const poll = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 30000);

    return () => {
      if (registrationRefreshTimer.current) clearTimeout(registrationRefreshTimer.current);
      foreground.remove();
      clearInterval(poll);
      registrationLoadVersion.current += 1;
      notificationJobLoadVersion.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [loadRegistrations, loadNotificationJob, selectedId]);

  const openEvent = useCallback(async (eventId: string) => {
    setLoading(true);
    try {
      const [{ data: eventData, error: eventError }, { data: vehicleData, error: vehicleError }] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('event_vehicles').select('*').eq('event_id', eventId).order('sort_order', { ascending: true }),
      ]);
      if (eventError) throw eventError;
      if (vehicleError) throw vehicleError;
      const loaded = eventData as EventRow;
      const loadedVehicles = (vehicleData || []) as any[];
      setRegistrations([]);
      setVehicleLookup({});
      setActiveVehicleIds([]);
      setNotificationJob(null);
      setNotificationJobReadState('loading');
      setEvent(loaded);
      setSelectedId(loaded.id);
      setRegistrationPage(0);
      setEditing(false);
      setPreviewing(false);
      setTitle(loaded.title || '');
      setDescription(loaded.description || '');
      setLocation(loaded.location || '');
      setStartTime(localDateInput(loaded.start_time));
      setEndTime(localDateInput(loaded.end_time));
      setHasEndDate(loaded.has_end_date !== false);
      setStartHasTime(loaded.start_has_time !== false);
      setEndHasTime(loaded.end_has_time !== false);
      setRegistrationStart(localDateInput(loaded.registration_start_at));
      setDeadline(localDateInput(loaded.registration_deadline));
      setRegistrationStartEnabled(Boolean(loaded.registration_start_at));
      setRegistrationStartNotifyEnabled(Boolean(loaded.registration_start_notify_enabled));
      setDeadlineEnabled(Boolean(loaded.registration_deadline));
      setMaxParticipants(loaded.max_participants == null ? '' : String(loaded.max_participants));
      setPublished(Boolean(loaded.is_published));
      setStatus(loaded.registration_status || 'draft');
      setAllowProxy(Boolean(loaded.allow_proxy_registration));
      setAllowWaitlist(loaded.allow_waitlist !== false);
      setVehicleMode(loaded.vehicle_selection_mode || 'none');
    setFields((loaded.registration_form || []) as EventFormField[]);
      setDescriptionPreview(false);
      const drafts = loadedVehicles.filter((vehicle) => vehicle.is_active !== false).map((vehicle) => ({
        id: vehicle.id,
        name: vehicle.name,
        capacity: String(vehicle.capacity),
        reserved_seats: String(vehicle.reserved_seats || 0),
        boarding_stop: vehicle.boarding_stop || '',
        departure_time: vehicle.departure_time || '',
        notes: vehicle.notes || '',
        is_active: vehicle.is_active !== false,
      }));
      setVehicles(drafts);
      await loadRegistrations(loaded.id);
      void loadNotificationJob(loaded.id);
    } catch (error: any) {
      Alert.alert('加载失败', error?.message || '活动详情加载失败。');
    } finally {
      setLoading(false);
    }
  }, [loadRegistrations, loadNotificationJob]);

  const startCreate = () => {
    setEvent(null);
    setSelectedId(null);
    setEditing(true);
    setPreviewing(false);
    setTitle('');
    setDescription('');
    setLocation('');
    setStartTime('');
    setEndTime('');
    setHasEndDate(false);
    setStartHasTime(false);
    setEndHasTime(false);
    setPickerTarget(null);
    setRegistrationStart('');
    setDeadline('');
    setRegistrationStartEnabled(false);
    setRegistrationStartNotifyEnabled(false);
    setDeadlineEnabled(false);
    setMaxParticipants('');
    setPublished(false);
    setStatus('draft');
    setAllowProxy(false);
    setAllowWaitlist(true);
    setVehicleMode('none');
    setFields([]);
    setDescriptionPreview(false);
    setVehicles([]);
    setRegistrations([]);
    setVehicleLookup({});
  };

  const saveEvent = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('信息不完整', '请填写活动标题和活动详情。');
      return;
    }
    const normalizedTimes = normalizeEventTimes({ startTime, endTime, hasEndDate, startHasTime, endHasTime });
    if (!normalizedTimes) {
      Alert.alert('日期或时间无效', '请完整选择活动日期和已开启的具体时间。意大利夏令时切换时不存在的时间无法使用。');
      return;
    }
    const { start, end: effectiveEnd } = normalizedTimes;
    if (new Date(effectiveEnd).getTime() < new Date(start).getTime()) {
      Alert.alert('时间不正确', '结束日期不能早于开始日期。');
      return;
    }
    const opening = registrationStartEnabled ? romeToIso(registrationStart) : null;
    const closing = deadlineEnabled ? romeToIso(deadline) : null;
    if ((registrationStartEnabled && !opening) || (deadlineEnabled && !closing)) {
      Alert.alert('报名时间不完整', '请为已开启的报名时间选有效日期和时间。意大利夏令时切换时不存在的时间无法使用。');
      return;
    }
    if (opening && closing && new Date(closing).getTime() < new Date(opening).getTime()) {
      Alert.alert('报名时间不正确', '报名截止时间不能早于开放时间。');
      return;
    }
    if ((opening && new Date(opening).getTime() > new Date(effectiveEnd).getTime())
      || (closing && new Date(closing).getTime() > new Date(effectiveEnd).getTime())) {
      Alert.alert('报名时间不正确', '报名开放和截止时间不能晚于活动结束。');
      return;
    }
    const parsedMax = maxParticipants.trim() ? Number(maxParticipants) : null;
    if (parsedMax !== null && (!Number.isInteger(parsedMax) || parsedMax < 1)) {
      Alert.alert('人数上限不正确', '人数上限必须是正整数。');
      return;
    }
    if (fields.some((field) => !field.key.trim() || !field.label.trim())) {
      Alert.alert('表单字段不完整', '请为每个字段填写内部标识和显示名称。');
      return;
    }
    if (new Set(fields.map((field) => field.key.trim())).size !== fields.length) {
      Alert.alert('字段标识重复', '每个表单字段的内部标识必须唯一。');
      return;
    }
    const invalidOptions = fields.find((field) => (field.type === 'select' || field.type === 'multiselect')
      && (!field.options || field.options.length === 0 || field.options.some((option) => !option.trim())));
    if (invalidOptions) {
      Alert.alert('选项设置不完整', '单选和多选问题至少需要一个选项，且选项内容不能为空。');
      return;
    }
    if (vehicleMode !== 'none' && vehicles.some((vehicle) => {
      const capacity = Number(vehicle.capacity);
      const reservedSeats = Number(vehicle.reserved_seats || 0);
      return !vehicle.name.trim()
        || !Number.isInteger(capacity)
        || capacity < 1
        || !Number.isInteger(reservedSeats)
        || reservedSeats < 0
        || reservedSeats > capacity;
    })) {
      Alert.alert('车辆设置不完整', '启用分车时，请填写车辆名称和座位数。');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || null,
        start_time: start,
        end_time: effectiveEnd,
        has_end_date: hasEndDate,
        start_has_time: startHasTime,
        end_has_time: endHasTime,
        registration_deadline: closing,
        registration_start_at: opening,
        registration_start_notify_enabled: registrationStartEnabled && registrationStartNotifyEnabled,
        max_participants: parsedMax,
        is_published: published,
        registration_status: status,
        registration_mode: 'authenticated',
        registration_form: fields.map((field) => field.type === 'file' ? field : ({
          ...field,
          label: field.label.trim(),
          description: field.description?.trim() || undefined,
          placeholder: field.placeholder?.trim() || undefined,
          options: field.options?.map((option) => option.trim()).filter(Boolean),
        })),
        registration_form_version: (event?.registration_form_version || 0) + 1,
        vehicle_selection_mode: vehicleMode,
        allow_proxy_registration: allowProxy,
        allow_waitlist: allowWaitlist,
      };

      const vehiclePayload = vehicles.map((vehicle, index) => ({
          id: vehicle.id || null,
          name: vehicle.name.trim(),
          capacity: Number(vehicle.capacity),
          reserved_seats: Number(vehicle.reserved_seats || 0),
          boarding_stop: vehicle.boarding_stop.trim() || null,
          departure_time: vehicle.departure_time.trim() || null,
          notes: vehicle.notes.trim() || null,
          sort_order: index,
          is_active: vehicle.is_active,
      }));
      const { data: savedId, error: saveError } = await supabase.rpc('admin_save_event_config', {
        p_event_id: event?.id || null,
        p_payload: payload,
        p_vehicles: vehiclePayload,
        p_expected_revision: event?.revision ?? null,
      });
      if (saveError) throw saveError;
      const savedEventId = savedId as string;

      const { error: scheduleError } = await supabase.rpc('schedule_event_registration_start_notification', {
        p_event_id: savedEventId,
      });
      if (scheduleError) {
        console.warn('Failed to schedule registration-start notification:', scheduleError);
      }

      Alert.alert(
        '保存成功',
        scheduleError ? '活动设置已保存，但自动报名通知任务设置失败，请检查 Supabase 配置。' : '活动设置已保存。',
        [{ text: '好的', onPress: () => openEvent(savedEventId) }]
      );
      await loadEvents();
    } catch (error: any) {
      if (/revision|conflict|changed.*reload/i.test(String(error?.message || '')) && event) {
        Alert.alert('活动已被修改', '本次改动尚未保存。重新加载会舍弃本页改动并打开最新设置，请先记下需要保留的内容。', [
          { text: '继续查看本次改动', style: 'cancel' },
          { text: '重新加载', onPress: () => { void openEvent(event.id); } },
        ]);
      } else Alert.alert('保存失败', adminErrorMessage(error, '活动设置保存失败，请检查输入内容和权限。'));
    } finally {
      setSaving(false);
    }
  };

  const sendEventNotification = () => {
    if (!event) return;
    setNotificationTitle(`【活动通知】${event.title}`);
    setNotificationBody(event.registration_status === 'open' ? `${event.title}已开始报名！` : event.description || '有新的活动通知。');
    setNotificationModalVisible(true);
  };

  const confirmSendEventNotification = async () => {
    if (!notificationTitle.trim() || !notificationBody.trim()) {
      Alert.alert('内容不完整', '请填写通知标题和通知内容。');
      return;
    }
    setNotificationModalVisible(false);
    const result = await broadcastPushNotification(notificationTitle.trim(), notificationBody.trim(), 'events');
    if (result.success) Alert.alert('推送已提交', `已向 Expo 提交 ${result.sentCount || 0} 台设备的活动通知。`);
    else Alert.alert('推送未全部成功', `已提交 ${result.sentCount || 0} 台，失败 ${result.failedCount || 0} 台。${result.error || '请稍后重试。'}`);
  };

  const addField = (type: EventFormFieldType) => {
    if (type === 'file') return;
    const baseKey = `field_${Date.now()}`;
    const needsOptions = type === 'select' || type === 'multiselect';
    setFields((current) => [...current, {
      key: baseKey,
      type,
      label: FIELD_TYPES.find((item) => item.type === type)?.label || '新字段',
      required: false,
      options: needsOptions ? ['选项 1', '选项 2'] : undefined,
    }]);
  };

  const openPicker = (target: typeof pickerTarget) => {
    if (!target) return;
    const source = target === 'startDate' || target === 'startTime' ? startTime
      : target === 'endDate' || target === 'endTime' ? endTime
        : target.startsWith('registrationStart') ? registrationStart : deadline;
    setPickerTarget(target);
    if (!source && target === 'endDate' && startTime) setEndTime(`${startTime.slice(0, 10)} 00:00`);
  };

  const handlePickerValueChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
    if (!selectedDate || !pickerTarget) return;
    const selected = dateInputValue(selectedDate);
    const changeDate = (current: string) => `${selected.slice(0, 10)} ${(current || '2000-01-01 00:00').slice(11, 16)}`;
    const changeTime = (current: string) => `${(current || dateInputValue(new Date())).slice(0, 10)} ${selected.slice(11, 16)}`;
    if (pickerTarget === 'startDate') {
      setStartTime(changeDate(startTime));
    } else if (pickerTarget === 'endDate') {
      setEndTime(changeDate(endTime));
      setHasEndDate(true);
    } else if (pickerTarget === 'startTime') {
      setStartTime(changeTime(startTime));
      setStartHasTime(true);
    } else if (pickerTarget === 'endTime') {
      setEndTime(changeTime(hasEndDate ? endTime || startTime : startTime));
      setEndHasTime(true);
    } else if (pickerTarget === 'registrationStartDate') {
      setRegistrationStart(changeDate(registrationStart));
    } else if (pickerTarget === 'registrationStartTime') {
      setRegistrationStart(changeTime(registrationStart));
    } else if (pickerTarget === 'deadlineDate') {
      setDeadline(changeDate(deadline));
    } else if (pickerTarget === 'deadlineTime') {
      setDeadline(changeTime(deadline));
    }
    setPickerTarget(null);
  };

  const handlePickerDismiss = () => setPickerTarget(null);

  const updateField = (index: number, patch: Partial<EventFormField>) => {
    setFields((current) => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field));
  };

  const updateFieldOption = (fieldIndex: number, optionIndex: number, value: string) => {
    setFields((current) => current.map((field, index) => {
      if (index !== fieldIndex) return field;
      const options = [...(field.options || [])];
      options[optionIndex] = value;
      return { ...field, options };
    }));
  };

  const addFieldOption = (fieldIndex: number) => {
    setFields((current) => current.map((field, index) => {
      if (index !== fieldIndex) return field;
      const options = field.options || [];
      return { ...field, options: [...options, `选项 ${options.length + 1}`] };
    }));
  };

  const removeFieldOption = (fieldIndex: number, optionIndex: number) => {
    setFields((current) => current.map((field, index) => {
      if (index !== fieldIndex) return field;
      const options = (field.options || []).filter((_, itemIndex) => itemIndex !== optionIndex);
      return { ...field, options: options.length > 0 ? options : ['选项 1'] };
    }));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setFields((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addVehicle = () => setVehicles((current) => [...current, {
    name: `车辆 ${current.length + 1}`,
    capacity: '50',
    reserved_seats: '0',
    boarding_stop: '',
    departure_time: '',
    notes: '',
    is_active: true,
  }]);

  const updateVehicle = (index: number, patch: Partial<VehicleDraft>) => {
    setVehicles((current) => current.map((vehicle, vehicleIndex) => vehicleIndex === index ? { ...vehicle, ...patch } : vehicle));
  };

  const sendTargetedEventPush = async (userId: string | null, title: string, body: string, eventId: string) => {
    if (!userId) return false;
    const { data, error } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
    if (error) throw error;
    const tokens = [...new Set((data || []).map((row: any) => row.token).filter(Boolean))];
    if (tokens.length === 0) return false;
    const result = await sendExpoPushMessages(tokens.map((token) => ({ to: token, sound: 'default', title, body, data: { category: 'events', eventId } })));
    if (!result.success) throw new Error(`推送已提交 ${result.sentCount} 台，失败 ${result.failedCount} 台。`);
    return true;
  };

  const promoteRegistration = (registrationId: string) => {
    Alert.alert('转为正式报名', '确定将这名候补报名者加入正式名单吗？', [
      { text: '返回', style: 'cancel' },
      { text: '确认', onPress: async () => {
        setBusyRegistration(registrationId);
        try {
          const { error } = await supabase.rpc('admin_promote_event_registration', { p_registration_id: registrationId });
          if (error) throw error;
          if (selectedId) await loadRegistrations(selectedId);
        } catch (error: any) {
          Alert.alert('操作失败', adminErrorMessage(error, '候补转正失败。'));
        } finally {
          setBusyRegistration(null);
        }
      } },
    ]);
  };

  const cancelRegistration = (registrationId: string) => {
    const runCancel = (notify: boolean) => {
      setBusyRegistration(registrationId);
      void (async () => {
        try {
          const { error } = await supabase.rpc('admin_cancel_event_registration', { p_registration_id: registrationId, p_notify: notify });
          if (error) throw error;
          let pushFailed = false;
          let noPushDevice = false;
          if (notify) {
            const registration = registrations.find((row) => row.id === registrationId);
            try {
              noPushDevice = !await sendTargetedEventPush(registration?.user_id || null, '活动报名已取消', `您的${event?.title || '活动'}报名已被取消，请注意核实`, event?.id || '');
            } catch (pushError) { console.warn('Registration cancelled but push failed:', pushError); pushFailed = true; }
          }
          if (selectedId) await loadRegistrations(selectedId);
          Alert.alert('已取消', pushFailed ? '报名已取消，但推送发送失败，请另行联系报名者。' : noPushDevice ? '报名已取消，但该账户没有可用的推送设备。' : '报名已取消。');
        } catch (error: any) {
          Alert.alert('操作失败', adminErrorMessage(error, '取消报名失败。'));
        } finally {
          setBusyRegistration(null);
        }
      })();
    };
    Alert.alert('取消报名', '确定要取消这条报名吗？', [
      { text: '返回', style: 'cancel' },
      { text: '取消并通知', style: 'destructive', onPress: () => runCancel(true) },
      { text: '取消但不通知', style: 'destructive', onPress: () => runCancel(false) },
    ]);
  };

  const deleteCancelledRegistration = (registrationId: string) => {
    Alert.alert('彻底删除报名', '这会永久删除报名信息及报名人明细，删除后无法恢复。确定继续吗？', [
      { text: '返回', style: 'cancel' },
      { text: '确认删除', style: 'destructive', onPress: () => {
        setBusyRegistration(registrationId);
        void (async () => {
          try {
            const { error } = await supabase.rpc('admin_delete_cancelled_event_registration', { p_registration_id: registrationId });
            if (error) throw error;
            setRegistrationDetail(null);
            if (selectedId) await loadRegistrations(selectedId);
            Alert.alert('已删除', '这条已取消的报名信息已永久删除。');
          } catch (error: any) {
            Alert.alert('删除失败', error?.message || '无法彻底删除这条报名信息。');
          } finally {
            setBusyRegistration(null);
          }
        })();
      } },
    ]);
  };

  const openRegistrationEditor = (registration: RegistrationRow) => {
    if (registration.participant_count > 1) {
      Alert.alert('历史多人报名', '历史多人报名，仅支持查看或整条取消。');
      return;
    }
    setRegistrationDetail(null);
    const attendee = registration.attendees?.[0];
    setRegistrationEditor({
      registration,
      name: attendee?.name || '',
      phone: attendee?.phone || '',
      email: attendee?.email || '',
      proxy_note: registration.proxy_note || '',
      answers: { ...(attendee?.answers || registration.answers || {}) },
      vehicle_id: registration.vehicle_id || null,
    });
  };

  const openRegistrationDetail = (registration: RegistrationRow) => setRegistrationDetail(registration);

  const saveRegistrationEdit = (notify: boolean) => {
    if (!registrationEditor) return;
    const { registration, name, phone, email, proxy_note, answers, vehicle_id } = registrationEditor;
    setBusyRegistration(registration.id);
    void (async () => {
      try {
        const { error } = await supabase.rpc('admin_update_event_registration_full', {
          p_registration_id: registration.id,
          p_name: name.trim(),
          p_phone: phone.trim() || null,
          p_email: email.trim() || null,
          p_answers: answers,
          p_proxy_note: proxy_note.trim() || null,
          p_vehicle_id: vehicle_id,
          p_notify: notify,
          p_expected_revision: registration.revision,
        });
        if (error) throw error;
        let pushFailed = false;
        let noPushDevice = false;
        if (notify) {
          try {
            noPushDevice = !await sendTargetedEventPush(registration.user_id, '活动报名信息已修改', `您的${event?.title || '活动'}报名信息已被修改，请注意核实`, event?.id || '');
          } catch (pushError) { console.warn('Registration saved but push failed:', pushError); pushFailed = true; }
        }
        setRegistrationEditor(null);
        if (selectedId) await loadRegistrations(selectedId);
        Alert.alert('已保存', pushFailed ? '报名信息已修改，但推送发送失败，请另行联系报名者。' : noPushDevice ? '报名信息已修改，但该账户没有可用的推送设备。' : notify ? '报名信息已修改，推送已提交。' : '报名信息已修改。');
      } catch (error: any) {
        if (/revision|conflict|changed.*reload/i.test(String(error?.message || ''))) {
          Alert.alert('报名已被修改', '本次改动尚未保存。请记下需要保留的内容，再重新加载最新报名信息。', [
            { text: '继续查看本次改动', style: 'cancel' },
            { text: '重新加载', onPress: () => { setRegistrationEditor(null); if (selectedId) void loadRegistrations(selectedId).catch(() => Alert.alert('刷新失败', '请检查网络后重试。')); } },
          ]);
        } else Alert.alert('保存失败', adminErrorMessage(error, '报名信息保存失败。'));
      } finally {
        setBusyRegistration(null);
      }
    })();
  };

  const confirmRegistrationEdit = () => {
    Alert.alert('保存报名修改', '是否通知报名者？', [
      { text: '取消', style: 'cancel' },
      { text: '保存但不通知', onPress: () => saveRegistrationEdit(false) },
      { text: '保存并通知', onPress: () => saveRegistrationEdit(true) },
    ]);
  };

  const deleteEvent = () => {
    if (!event) return;
    Alert.alert('删除活动', '删除后活动不会再出现在用户端，已有报名记录会保留供管理员查询。确定继续吗？', [
      { text: '返回', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const { error } = await supabase.rpc('admin_delete_event', {
              p_event_id: event.id, p_expected_revision: event.revision,
            });
            if (error) throw error;
            const { error: scheduleError } = await supabase.rpc('schedule_event_registration_start_notification', { p_event_id: event.id });
            if (scheduleError) console.warn('Failed to remove registration-start notification schedule:', scheduleError);
            setEvent(null);
            setSelectedId(null);
            await loadEvents();
            Alert.alert('已删除', '活动已从用户端隐藏，报名数据仍已保留。');
          } catch (error: any) {
            Alert.alert('删除失败', adminErrorMessage(error, '活动删除失败，请稍后重试。'));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const exportOptions = useMemo(() => {
    const formFields = (exportSnapshot?.event.registration_form || event?.registration_form || []) as EventFormField[];
    const knownKeys = new Set(formFields.map((field) => field.key));
    const historicalKeys = new Set<string>();
    const historicalLabels = new Map<string, string>();
    const previousLabels = new Map<string, Set<string>>();
    (exportSnapshot?.registrations || registrations).forEach((row) => {
      (row.form_snapshot || []).forEach((field) => {
        const labels = previousLabels.get(field.key) || new Set<string>();
        labels.add(field.label);
        previousLabels.set(field.key, labels);
        if (!knownKeys.has(field.key)) {
          historicalKeys.add(field.key);
          historicalLabels.set(field.key, field.label);
        }
      });
      [row.answers, ...(row.attendees || []).map((attendee) => attendee.answers)].forEach((answers) => {
        Object.keys(answers || {}).filter((key) => !key.startsWith('__') && !knownKeys.has(key)).forEach((key) => historicalKeys.add(key));
      });
    });
    return [
      { key: 'name', label: '昵称' },
      { key: 'email', label: '邮箱' },
      { key: 'phone', label: '电话' },
      { key: 'vehicle', label: '车辆' },
      { key: 'registration_number', label: '报名编号' },
      { key: 'registered_at', label: '报名时间' },
      { key: 'status', label: '状态' },
      { key: 'registration_kind', label: '报名类型' },
      { key: 'registered_by_name', label: '提交者昵称' },
      { key: 'registered_by_email', label: '提交者邮箱' },
      { key: 'proxy_note', label: '备注' },
      { key: 'participant_count', label: '报名人数' },
      ...formFields.map((field) => {
        const oldLabels = [...(previousLabels.get(field.key) || [])].filter((label) => label !== field.label);
        return { key: `field:${field.key}`, label: `${field.label}${oldLabels.length ? `（历史题目：${oldLabels.join('／')}）` : ''}` };
      }),
      ...Array.from(historicalKeys).sort().map((key) => ({ key: `field:${key}`, label: `${[...(previousLabels.get(key) || [])].join('／') || historicalLabels.get(key) || key}（旧表单字段）` })),
    ];
  }, [event?.registration_form, exportSnapshot, registrations]);

  const openExportSelector = async () => {
    if (!event) return;
    const { data, error } = await supabase.rpc('admin_event_registration_snapshot', { p_event_id: event.id });
    if (error) { Alert.alert('导出失败', '无法读取最新报名数据，请检查网络后重试。'); return; }
    const snapshot = data as ExportSnapshot;
    if (!snapshot.registrations.length) { Alert.alert('暂无报名', '当前活动还没有可导出的报名记录。'); return; }
    setExportSnapshot(snapshot);
    setIncludeCancelled(false);
    const keys = new Set((snapshot.event.registration_form || []).map((field) => field.key));
    snapshot.registrations.forEach((row) => {
      [row.answers, ...(row.attendees || []).map((attendee) => attendee.answers)].forEach((answers) => {
        Object.keys(answers || {}).filter((key) => !key.startsWith('__')).forEach((key) => keys.add(key));
      });
    });
    setSelectedExportKeys(['name', 'email', 'phone', 'vehicle', 'registration_number', 'registered_at', 'status', 'registration_kind', 'proxy_note', 'participant_count', ...Array.from(keys).map((key) => `field:${key}`)]);
    setExportModalVisible(true);
  };

  const exportCsv = async () => {
    if (!exportSnapshot || exportSnapshot.registrations.length === 0) {
      Alert.alert('暂无报名', '当前活动还没有可导出的报名记录。');
      return;
    }
    try {
      const { data: latestData, error: latestError } = await supabase.rpc('admin_event_registration_snapshot', { p_event_id: exportSnapshot.event.id });
      if (latestError) throw latestError;
      const latest = latestData as ExportSnapshot;
      const rows: string[][] = [];
      const activeKeys = selectedExportKeys;
      rows.push(activeKeys.map((key) => exportOptions.find((option) => option.key === key)?.label || key));
      const originalOrder = new Map(latest.registrations.map((row, index) => [row.id, index]));
      const vehicleOrder = new Map(latest.vehicles.map((vehicle, index) => [vehicle.id, index]));
      const snapshotVehicleLookup = Object.fromEntries(latest.vehicles.map((vehicle) => [vehicle.id, vehicle.name]));
      const orderedRegistrations = [...latest.registrations].sort((left, right) => {
        if (!activeKeys.includes('vehicle')) return originalOrder.get(left.id)! - originalOrder.get(right.id)!;
        const leftRank = left.vehicle_id && vehicleOrder.has(left.vehicle_id) ? vehicleOrder.get(left.vehicle_id)! : Number.MAX_SAFE_INTEGER;
        const rightRank = right.vehicle_id && vehicleOrder.has(right.vehicle_id) ? vehicleOrder.get(right.vehicle_id)! : Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank || originalOrder.get(left.id)! - originalOrder.get(right.id)!;
      });
      orderedRegistrations.filter((row) => includeCancelled || row.status !== 'cancelled').forEach((row) => {
        const attendees = row.attendees?.length ? row.attendees : [{ name: '', phone: null, email: null, answers: row.answers }];
        attendees.forEach((attendee) => rows.push(activeKeys.map((key) => {
          const value = key === 'name' ? attendee.name : key === 'email' ? attendee.email || '' : key === 'phone' ? attendee.phone || ''
            : key === 'vehicle' ? (row.vehicle_id ? (snapshotVehicleLookup[row.vehicle_id] || '待确认') : '待分配')
            : key === 'registration_number' ? row.registration_number || row.id.slice(0, 8)
            : key === 'registered_at' ? formatDate(row.registered_at)
            : key === 'status' ? row.status
            : key === 'registration_kind' ? (row.registration_kind === 'proxy' ? '代他人报名' : '本人报名')
            : key === 'registered_by_name' ? row.registered_by_name || ''
            : key === 'registered_by_email' ? row.registered_by_email || ''
            : key === 'proxy_note' ? row.proxy_note || ''
            : key === 'participant_count' ? String(row.participant_count)
            : (attendee.answers || row.answers)?.[key.slice(6)];
          return Array.isArray(value) ? value.join('、') : typeof value === 'object' && value ? value.name || value.path || '' : value ?? '';
        })));
      });
      const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
      if (rows.length === 1) { Alert.alert('暂无可导出报名', '没有符合当前条件的报名记录。'); return; }
      const safeTitle = latest.event.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 50);
      const fileName = `${safeTitle}-导出表单-${Date.now()}.csv`;
      if (Platform.OS === 'web') {
        Alert.alert('网页端提示', '当前先提供 App 导出；网页管理端下载将在网页登录流程完成后接入。');
        return;
      }
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('无法分享', '当前设备不支持文件分享。');
        return;
      }
      await Sharing.shareAsync(fileUri, { dialogTitle: '导出表单', mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (error: any) {
      Alert.alert('导出失败', error?.message || '报名文件生成失败。');
    }
  };

  const statusOptions: Array<{ value: typeof status; label: string }> = [
    { value: 'draft', label: '未开启报名' },
    { value: 'open', label: '报名中' },
    { value: 'closed', label: '已截止' },
    { value: 'ended', label: '活动已结束' },
    { value: 'archived', label: '已归档' },
  ];

  const editor = editing ? (
    <>
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>基本信息</Text>
        <FormLabel colors={colors}>活动标题</FormLabel>
        <TextInput value={title} onChangeText={setTitle} placeholder="例如：春季郊游报名" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
        <View style={styles.labelActionRow}><FormLabel colors={colors}>活动详情</FormLabel><Pressable onPress={() => setDescriptionPreview((value) => !value)} style={styles.previewToggle}><MaterialCommunityIcons name={descriptionPreview ? 'pencil-outline' : 'eye-outline'} size={16} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 12 }}>{descriptionPreview ? '继续编辑' : '预览效果'}</Text></Pressable></View>
        <View style={[styles.markdownBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <HandbookMarkdownEditor value={description} onChange={setDescription} onBusyChange={setDescriptionBusy} chapters={[]} enableChapterLinks={false} inputPlaceholder="输入活动详情，支持 Markdown 格式" disabled={saving} preview={descriptionPreview} />
        </View>
        <FormLabel colors={colors} optional>活动地点</FormLabel>
        <TextInput value={location} onChangeText={setLocation} placeholder="例如：博洛尼亚中央车站" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
        <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 10 }]}>以下时间均按意大利当地时间（Europe/Rome）设置和执行，自动处理夏令时。冬令时切换当天重复的时刻按第二次计算。</Text>
        <FormLabel colors={colors}>活动日期</FormLabel>
        <View><Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>开始日期</Text><Pressable onPress={() => openPicker('startDate')} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="calendar-month-outline" size={19} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{dateLabel(startTime)}</Text></Pressable></View>
        <View style={styles.registrationSwitchRow}><View style={{ flex: 1 }}><Text style={[styles.dateButtonLabel, { color: colors.textSecondary, marginBottom: 0 }]}>设置结束日期</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>关闭表示单日活动，仍可设置当天的结束时间</Text></View><Switch value={hasEndDate} onValueChange={setHasEndDate} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={hasEndDate ? colors.primary : colors.textMuted} /></View>
        {hasEndDate ? <View><Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>结束日期</Text><Pressable onPress={() => openPicker('endDate')} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="calendar-month-outline" size={19} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{dateLabel(endTime)}</Text></Pressable></View> : null}
        <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>设置具体时间</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>不勾选时只显示活动日期，结束日期包含当天全天。</Text></View><Switch value={startHasTime || endHasTime} onValueChange={(value) => { setStartHasTime(value); if (!value) setEndHasTime(false); }} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={(startHasTime || endHasTime) ? colors.primary : colors.textMuted} /></View>
        {(startHasTime || endHasTime) ? <View style={styles.twoColumns}><View style={styles.columnInput}><Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>开始时间</Text><Pressable onPress={() => openPicker('startTime')} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="clock-outline" size={19} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{startHasTime ? timeLabel(startTime) : '设置开始时间'}</Text></Pressable></View><View style={styles.columnInput}><Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>结束时间（可选）</Text><Pressable onPress={() => openPicker('endTime')} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="clock-outline" size={19} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{endHasTime ? timeLabel(endTime) : '设置结束时间'}</Text></Pressable></View></View> : null}
        {endHasTime ? <Pressable onPress={() => setEndHasTime(false)}><Text style={[styles.hint, { color: colors.primary }]}>清除具体结束时间（以结束日期当天结束为准）</Text></Pressable> : null}
        {pickerTarget ? <View style={styles.pickerPanel}><DateTimePicker timeZoneName={EVENT_TIME_ZONE} value={inputDate(pickerTarget === 'startDate' || pickerTarget === 'startTime' ? (startTime || dateInputValue(new Date())) : pickerTarget === 'endDate' || pickerTarget === 'endTime' ? (endTime || startTime || dateInputValue(new Date())) : pickerTarget.startsWith('registrationStart') ? (registrationStart || dateInputValue(new Date())) : (deadline || dateInputValue(new Date())))} mode={pickerTarget.endsWith('Date') ? 'date' : 'time'} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onValueChange={handlePickerValueChange} onDismiss={handlePickerDismiss} /></View> : null}
        <View style={styles.registrationTimePanel}><View style={styles.registrationSwitchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>设置开放报名时间</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>关闭表示保存后立即开放报名</Text></View><Switch value={registrationStartEnabled} onValueChange={(value) => { setRegistrationStartEnabled(value); if (!value) setRegistrationStartNotifyEnabled(false); }} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={registrationStartEnabled ? colors.primary : colors.textMuted} /></View>{registrationStartEnabled ? <><View style={styles.twoColumns}><Pressable onPress={() => openPicker('registrationStartDate')} style={[styles.dateButton, styles.columnInput, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{registrationStart ? dateLabel(registrationStart) : '选择日期'}</Text></Pressable><Pressable onPress={() => openPicker('registrationStartTime')} style={[styles.dateButton, styles.columnInput, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{registrationStart ? timeLabel(registrationStart) : '选择时间'}</Text></Pressable></View><View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>到时自动发送报名通知</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>开放报名时间到达后，自动发送 Expo Push</Text></View><Switch value={registrationStartNotifyEnabled} onValueChange={setRegistrationStartNotifyEnabled} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={registrationStartNotifyEnabled ? colors.primary : colors.textMuted} /></View></> : null}</View>
        <View style={styles.registrationTimePanel}><View style={styles.registrationSwitchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>设置报名截止时间</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>关闭表示不设置报名截止时间</Text></View><Switch value={deadlineEnabled} onValueChange={setDeadlineEnabled} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={deadlineEnabled ? colors.primary : colors.textMuted} /></View>{deadlineEnabled ? <><View style={styles.twoColumns}><Pressable onPress={() => openPicker('deadlineDate')} style={[styles.dateButton, styles.columnInput, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{deadline ? dateLabel(deadline) : '选择日期'}</Text></Pressable><Pressable onPress={() => openPicker('deadlineTime')} style={[styles.dateButton, styles.columnInput, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{deadline ? timeLabel(deadline) : '选择时间'}</Text></Pressable></View></> : null}</View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>开放时间和截止时间会实际限制报名；状态仍可手动提前关闭或归档。</Text>
        <FormLabel colors={colors} optional>活动总人数上限</FormLabel>
        <TextInput value={maxParticipants} onChangeText={setMaxParticipants} placeholder="不填则不限制" placeholderTextColor={colors.textMuted} keyboardType="numeric" style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
        <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>发布到活动列表</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>关闭时普通用户完全看不到此活动，管理员仍可管理。</Text></View><Switch value={published} onValueChange={setPublished} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={published ? colors.primary : colors.textMuted} /></View>
        <View style={styles.choiceGroup}><Text style={[styles.hint, { color: colors.textSecondary }]}>报名状态（需同时发布且状态为“报名中”才可报名）</Text><View style={styles.choiceWrap}>{statusOptions.map((option) => <Pressable key={option.value} onPress={() => setStatus(option.value)} style={[styles.choice, { borderColor: status === option.value ? colors.primary : colors.border, backgroundColor: status === option.value ? colors.primary + '12' : colors.surface }]}><Text style={{ color: status === option.value ? colors.primary : colors.textSecondary, fontSize: 13 }}>{option.label}</Text></Pressable>)}</View></View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>报名设置</Text>
        <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>允许帮助他人报名</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>开启后，登录用户可以为未登录的人报名，并必须填写代报名备注。</Text></View><Switch value={allowProxy} onValueChange={setAllowProxy} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={allowProxy ? colors.primary : colors.textMuted} /></View>
        <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>允许候补</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>活动或车辆满员后进入候补列表。</Text></View><Switch value={allowWaitlist} onValueChange={setAllowWaitlist} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={allowWaitlist ? colors.primary : colors.textMuted} /></View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>车辆分配方式</Text>
        <View style={styles.choiceWrap}>{[
          ['none', '不分配车辆'], ['auto', '系统自动分配'], ['self_select', '报名者自选车辆'], ['admin', '管理员后续分配'],
        ].map(([value, label]) => <Pressable key={value} onPress={() => setVehicleMode(value as any)} style={[styles.choice, { borderColor: vehicleMode === value ? colors.primary : colors.border, backgroundColor: vehicleMode === value ? colors.primary + '12' : colors.surface }]}><Text style={{ color: vehicleMode === value ? colors.primary : colors.textSecondary, fontSize: 13 }}>{label}</Text></Pressable>)}</View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.panelHeader}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>报名表字段</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>姓名和报名人数由系统提供</Text></View>
        <Text style={[styles.formHint, { color: colors.textSecondary }]}>先添加一个问题，再填写报名者看到的题目。字段编号由系统自动管理，不需要填写。</Text>
        {fields.map((field, index) => field.type === 'file' ? <View key={field.key} style={[styles.fieldEditor, { borderColor: colors.border }]}><Text style={{ color: colors.textPrimary }}>{field.label}（历史附件字段）</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>仅保留历史记录，不再收集或修改附件。</Text></View> : <View key={`${field.key}-${index}`} style={[styles.fieldEditor, { borderColor: colors.border }]}>
          <View style={styles.fieldEditorHeader}><Text style={[styles.fieldIndex, { color: colors.textMuted }]}>问题 {index + 1}</Text><View style={styles.inlineActions}><Pressable accessibilityLabel="上移问题" onPress={() => moveField(index, -1)}><MaterialCommunityIcons name="arrow-up" size={18} color={colors.textMuted} /></Pressable><Pressable accessibilityLabel="下移问题" onPress={() => moveField(index, 1)}><MaterialCommunityIcons name="arrow-down" size={18} color={colors.textMuted} /></Pressable><Pressable accessibilityLabel="删除问题" onPress={() => setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index))}><MaterialCommunityIcons name="delete-outline" size={19} color={colors.error} /></Pressable></View></View>
          <FormLabel colors={colors}>问题标题（报名者看到）</FormLabel>
          <TextInput value={field.label} onChangeText={(value) => updateField(index, { label: value })} placeholder="例如：你的姓名" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
          <FormLabel colors={colors} optional>补充说明</FormLabel>
          <TextInput value={field.description || ''} onChangeText={(value) => updateField(index, { description: value })} placeholder="例如：请填写真实姓名" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
          <FormLabel colors={colors} optional>填写提示</FormLabel>
          <TextInput value={field.placeholder || ''} onChangeText={(value) => updateField(index, { placeholder: value })} placeholder="例如：张三" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
          <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 10 }]}>回答类型</Text>
          <View style={styles.choiceWrap}>{FIELD_TYPES.map((item) => <Pressable key={item.type} onPress={() => updateField(index, { type: item.type, options: item.type === 'select' || item.type === 'multiselect' ? (field.options?.length ? field.options : ['选项 1', '选项 2']) : undefined })} style={[styles.smallChoice, { borderColor: field.type === item.type ? colors.primary : colors.border, backgroundColor: field.type === item.type ? colors.primary + '12' : colors.surface }]}><Text style={{ fontSize: 12, color: field.type === item.type ? colors.primary : colors.textSecondary }}>{item.label}</Text></Pressable>)}</View>
          {(field.type === 'select' || field.type === 'multiselect') ? <View style={styles.optionsEditor}>
            <View style={styles.optionsHeader}><Text style={[styles.hint, { color: colors.textSecondary }]}>选项</Text><Pressable accessibilityLabel="添加选项" onPress={() => addFieldOption(index)} style={styles.optionAddButton}><MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 13 }}>添加选项</Text></Pressable></View>
            {(field.options || []).map((option, optionIndex) => <View key={`${field.key}-option-${optionIndex}`} style={styles.optionEditorRow}><Text style={[styles.optionNumber, { color: colors.textMuted }]}>{optionIndex + 1}</Text><TextInput value={option} onChangeText={(value) => updateFieldOption(index, optionIndex, value)} placeholder={`选项 ${optionIndex + 1}`} placeholderTextColor={colors.textMuted} style={[styles.input, styles.optionInput, { color: colors.textPrimary, borderColor: colors.border }]} /><Pressable accessibilityLabel="删除选项" onPress={() => removeFieldOption(index, optionIndex)}><MaterialCommunityIcons name="close-circle-outline" size={21} color={colors.textMuted} /></Pressable></View>)}
          </View> : null}
          <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>必填问题</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>报名者必须回答后才能提交</Text></View><Switch value={Boolean(field.required)} onValueChange={(value) => updateField(index, { required: value })} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={field.required ? colors.primary : colors.textMuted} /></View>
        </View>)}
        {fields.length === 0 ? <View style={[styles.noFields, { borderColor: colors.border }]}><MaterialCommunityIcons name="form-select" size={27} color={colors.textMuted} /><Text style={[styles.hint, { color: colors.textSecondary }]}>还没有问题，请从下面选择一种题型开始。</Text></View> : null}
        <View style={styles.choiceWrap}>{FIELD_TYPES.map((item) => <Pressable key={item.type} onPress={() => addField(item.type)} style={[styles.addFieldButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="plus" size={16} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 12 }}>{item.label}</Text></Pressable>)}</View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.panelHeader}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>车辆</Text><Pressable onPress={addVehicle} style={styles.addTextButton}><MaterialCommunityIcons name="plus" size={17} color={colors.primary} /><Text style={{ color: colors.primary }}>添加车辆</Text></Pressable></View>
        {vehicles.length === 0 ? <Text style={[styles.hint, { color: colors.textSecondary }]}>暂未配置车辆。</Text> : vehicles.map((vehicle, index) => <View key={vehicle.id || `new-${index}`} style={[styles.vehicleEditor, { borderColor: colors.border }]}>
          <View style={styles.twoColumns}><View style={styles.columnInput}><FormLabel colors={colors}>车辆名称</FormLabel><TextInput value={vehicle.name} onChangeText={(value) => updateVehicle(index, { name: value })} placeholder="例如：大巴 1 号" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /></View><View style={styles.columnInput}><FormLabel colors={colors}>座位数</FormLabel><TextInput value={vehicle.capacity} onChangeText={(value) => updateVehicle(index, { capacity: value })} placeholder="例如：50" placeholderTextColor={colors.textMuted} keyboardType="numeric" style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /></View></View>
          <View style={styles.twoColumns}><View style={styles.columnInput}><FormLabel colors={colors} optional>上车点</FormLabel><TextInput value={vehicle.boarding_stop} onChangeText={(value) => updateVehicle(index, { boarding_stop: value })} placeholder="例如：学校门口" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /></View><View style={styles.columnInput}><FormLabel colors={colors} optional>预留座位</FormLabel><TextInput value={vehicle.reserved_seats} onChangeText={(value) => updateVehicle(index, { reserved_seats: value })} placeholder="没有就填 0" placeholderTextColor={colors.textMuted} keyboardType="numeric" style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /></View></View>
          <View style={styles.fieldEditorHeader}><View style={{ flex: 1 }}><FormLabel colors={colors} optional>车辆备注</FormLabel><TextInput value={vehicle.notes} onChangeText={(value) => updateVehicle(index, { notes: value })} placeholder="例如：需要携带大件行李" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} /></View><Pressable onPress={() => setVehicles((current) => current.filter((_, vehicleIndex) => vehicleIndex !== index))} style={{ marginLeft: 10, marginTop: 25 }}><MaterialCommunityIcons name="delete-outline" size={21} color={colors.error} /></Pressable></View>
        </View>)}
      </View>

      <Pressable style={[styles.saveButton, { backgroundColor: colors.primary }, (saving || descriptionBusy) && { opacity: 0.6 }]} onPress={saveEvent} disabled={saving || descriptionBusy}>{saving || descriptionBusy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>保存活动</Text>}</Pressable>
    </>
  ) : null;

  const previewTime = hasEndDate
    ? `${dateLabel(startTime)}${startHasTime ? ` ${timeLabel(startTime)}` : ''} - ${dateLabel(endTime)}${endHasTime ? ` ${timeLabel(endTime)}` : ''}`
    : `${dateLabel(startTime)}${startHasTime ? ` ${timeLabel(startTime)}` : ''}${endHasTime ? ` - ${timeLabel(endTime)}` : ''}`;

  const eventPreview = <Modal visible={previewing} animationType="slide" onRequestClose={() => setPreviewing(false)}>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.previewHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => setPreviewing(false)} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable>
        <Text style={[styles.previewHeaderTitle, { color: colors.textPrimary }]}>活动预览</Text>
        <View style={styles.headerButtonSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.previewContent}>
        <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{title.trim() || '活动标题'}</Text>
        <View style={styles.previewMetaRow}><MaterialCommunityIcons name="clock-outline" size={17} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>活动时间：{previewTime}</Text></View>
        {location.trim() ? <View style={styles.previewMetaRow}><MaterialCommunityIcons name="map-marker-outline" size={17} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>{location.trim()}</Text></View> : null}
        <View style={[styles.previewDescription, { backgroundColor: colors.surface, borderColor: colors.border }]}><HandbookMarkdownPreview value={description.trim() || '暂无活动详情'} /></View>
        {fields.length > 0 ? <View style={[styles.previewSection, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.previewSectionTitle, { color: colors.textPrimary }]}>报名信息</Text>{fields.map((field) => <View key={field.key} style={styles.previewField}><Text style={[styles.previewFieldLabel, { color: colors.textPrimary }]}>{field.label || '未命名问题'}{field.required ? ' *' : ''}</Text>{field.description ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{field.description}</Text> : null}{field.type === 'select' || field.type === 'multiselect' ? (field.options || []).map((option) => <Text key={option} style={[styles.previewOption, { color: colors.textSecondary }]}>○ {option}</Text>) : <View style={[styles.previewInputLine, { borderColor: colors.border }]} />}</View>)}</View> : null}
        {vehicleMode !== 'none' ? <View style={[styles.previewSection, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.previewSectionTitle, { color: colors.textPrimary }]}>车辆选择</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>{vehicleMode === 'auto' ? '系统自动分配车辆' : vehicleMode === 'self_select' ? '报名者可选择车辆' : '管理员后续分配车辆'}</Text></View> : null}
      </ScrollView>
    </SafeAreaView>
  </Modal>;

  const registrationEditorModal = registrationEditor ? (
    <Modal visible animationType="slide" onRequestClose={() => setRegistrationEditor(null)}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.previewHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setRegistrationEditor(null)} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable>
          <Text style={[styles.previewHeaderTitle, { color: colors.textPrimary }]}>修改报名信息</Text>
          <View style={styles.headerButtonSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.editorContent}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>报名人信息</Text>
          {[
            ['昵称', 'name', registrationEditor.name],
            ['邮箱', 'email', registrationEditor.email],
            ['电话', 'phone', registrationEditor.phone],
          ].map(([label, _key, value]) => <View key={label as string} style={styles.registrationEditField}>
            <Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>{label}</Text>
            <TextInput value={value as string} onChangeText={(next) => setRegistrationEditor((current) => current ? { ...current, [_key as string]: next } : current)} keyboardType={_key === 'email' ? 'email-address' : _key === 'phone' ? 'phone-pad' : 'default'} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]} />
          </View>)}
          {registrationEditor.registration.registration_kind === 'proxy' ? <View style={styles.registrationEditField}><Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>报名对象备注</Text><TextInput value={registrationEditor.proxy_note} onChangeText={(next) => setRegistrationEditor((current) => current ? { ...current, proxy_note: next } : current)} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]} /></View> : null}
          {event?.vehicle_selection_mode !== 'none' ? <View style={styles.registrationEditField}>
            <Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>分车</Text>
            <View style={styles.adminAnswerOptions}>
              {[{ id: null, name: '待分配' }, ...activeVehicleIds.map((id) => ({ id, name: vehicleLookup[id] }))].map((vehicle) => {
                const selected = registrationEditor.vehicle_id === vehicle.id;
                return <Pressable key={vehicle.id || 'none'} onPress={() => setRegistrationEditor((current) => current ? { ...current, vehicle_id: vehicle.id } : current)} style={[styles.adminAnswerOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : colors.surface }]}><MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={selected ? colors.primary : colors.textMuted} /><Text style={{ color: colors.textPrimary }}>{vehicle.name}</Text></Pressable>;
              })}
            </View>
          </View> : null}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 12 }]}>报名表答案</Text>
          {(registrationEditor.registration.form_snapshot ?? event?.registration_form ?? []).filter((field) => !field.system).map((field) => {
            const value = registrationEditor.answers[field.key];
            const textValue = Array.isArray(value) ? value.join(', ') : value === undefined || value === null ? '' : String(value);
            return <View key={field.key} style={styles.registrationEditField}>
              <Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>{field.label}{field.required ? '（必填）' : ''}</Text>
              {field.type === 'file' ? <Text style={{ color: colors.textSecondary }}>{value && typeof value === 'object' ? value.name || '已上传附件' : '无历史附件'}（只读）</Text> : field.type === 'select' || field.type === 'multiselect' ? <View style={styles.adminAnswerOptions}>{(field.options || []).map((option) => { const selected = field.type === 'multiselect' ? Array.isArray(value) && value.includes(option) : value === option; return <Pressable key={option} onPress={() => setRegistrationEditor((current) => { if (!current) return current; const next = field.type === 'multiselect' ? (selected ? (Array.isArray(value) ? value.filter((item) => item !== option) : []) : [...(Array.isArray(value) ? value : []), option]) : option; return { ...current, answers: { ...current.answers, [field.key]: next } }; })} style={[styles.adminAnswerOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : colors.surface }]}><MaterialCommunityIcons name={selected ? 'checkbox-marked-circle' : 'circle-outline'} size={18} color={selected ? colors.primary : colors.textMuted} /><Text style={{ color: colors.textPrimary }}>{option}</Text></Pressable>; })}</View> : field.type === 'checkbox' ? <Switch value={Boolean(value)} onValueChange={(next) => setRegistrationEditor((current) => current ? { ...current, answers: { ...current.answers, [field.key]: next } } : current)} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={value ? colors.primary : colors.textMuted} /> : field.type === 'date' ? <>
                <Pressable onPress={() => setRegistrationDateField(field.key)} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.primary} /><Text style={{ color: textValue ? colors.textPrimary : colors.textMuted }}>{textValue || '选择日期'}</Text></Pressable>
                {registrationDateField === field.key ? <View style={styles.pickerPanel}><DateTimePicker timeZoneName={EVENT_TIME_ZONE} value={textValue ? inputDate(`${textValue} 12:00`) : new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onValueChange={(_event: DateTimePickerChangeEvent, date: Date) => { setRegistrationEditor((current) => current ? { ...current, answers: { ...current.answers, [field.key]: localDateInput(date.toISOString()).slice(0, 10) } } : current); setRegistrationDateField(null); }} onDismiss={() => setRegistrationDateField(null)} /></View> : null}
              </> : <TextInput value={textValue} onChangeText={(next) => setRegistrationEditor((current) => current ? { ...current, answers: { ...current.answers, [field.key]: field.type === 'number' ? (next ? Number(next) : '') : field.type === 'multiselect' ? next.split(',').map((item) => item.trim()).filter(Boolean) : next } } : current)} multiline={field.type === 'textarea'} keyboardType={field.type === 'number' ? 'numeric' : field.type === 'phone' ? 'phone-pad' : field.type === 'email' ? 'email-address' : 'default'} style={[styles.input, field.type === 'textarea' && styles.textareaInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]} />}
            </View>;
          })}
          <Pressable onPress={confirmRegistrationEdit} disabled={busyRegistration === registrationEditor.registration.id} style={[styles.saveButton, { backgroundColor: colors.primary }]}><Text style={styles.saveButtonText}>{busyRegistration === registrationEditor.registration.id ? '保存中…' : '保存修改'}</Text></Pressable>
          {registrationEditor.registration.status === 'waitlist' ? <Pressable onPress={() => { setRegistrationEditor(null); promoteRegistration(registrationEditor.registration.id); }} disabled={busyRegistration === registrationEditor.registration.id} style={styles.editorActionButton}><Text style={{ color: colors.primary, fontSize: 14 }}>转为正式报名</Text></Pressable> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  ) : null;

  const registrationDetailModal = registrationDetail ? (
    <Modal visible animationType="slide" onRequestClose={() => setRegistrationDetail(null)}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.previewHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setRegistrationDetail(null)} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable>
          <Text style={[styles.previewHeaderTitle, { color: colors.textPrimary }]}>报名详情</Text>
          <View style={styles.headerButtonSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.editorContent}>
          <Text style={[styles.registrationDetailTitle, { color: colors.textPrimary }]}>{registrationDetail.attendees?.map((item) => item.name).filter(Boolean).join('、') || registrationDetail.registration_number || '报名详情'}</Text>
          <View style={[styles.detailPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.detailSectionHeading, { color: colors.textPrimary }]}>报名概况</Text>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>报名状态</Text><Text style={[styles.detailValue, { color: registrationDetail.status === 'waitlist' ? '#B7791F' : registrationDetail.status === 'cancelled' ? colors.textMuted : colors.success }]}>{registrationDetail.status === 'waitlist' ? '候补' : registrationDetail.status === 'cancelled' ? '已取消' : '已确认'}</Text></View>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>报名时间</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{formatDate(registrationDetail.registered_at)}</Text></View>
            <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>报名方式</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{registrationDetail.registration_kind === 'proxy' ? '代报名' : '本人报名'} · 由{registrationSubmitter(registrationDetail)}报名</Text></View>
            {registrationDetail.proxy_note ? <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>报名对象备注</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{registrationDetail.proxy_note}</Text></View> : null}
            <Text style={[styles.detailSectionHeading, styles.detailSectionHeadingSpaced, { color: colors.textPrimary }]}>报名人信息</Text>
            {registrationDetail.attendees?.map((attendee, index) => <View key={`${attendee.name}-${index}`} style={styles.attendeeDetailBlock}>
              <Text style={[styles.detailSectionTitle, { color: colors.textPrimary }]}>报名人 {index + 1}</Text>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>昵称</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{attendee.name || '未填写'}</Text></View>
              {attendee.email ? <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>邮箱</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{attendee.email}</Text></View> : null}
              {attendee.phone ? <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>电话</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{attendee.phone}</Text></View> : null}
            </View>)}
            <Text style={[styles.detailSectionHeading, styles.detailSectionHeadingSpaced, { color: colors.textPrimary }]}>报名表答案</Text>
            {(registrationDetail.form_snapshot ?? event?.registration_form ?? []).filter((field) => !field.system).map((field) => {
              const value = registrationDetail.answers?.[field.key];
              if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
              const display = Array.isArray(value) ? value.join('、') : typeof value === 'object' ? value.name || value.path || '已上传文件' : String(value);
              return <View key={field.key} style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{field.label}</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{display}</Text></View>;
            })}
            {event?.vehicle_selection_mode !== 'none' ? <><Text style={[styles.detailSectionHeading, styles.detailSectionHeadingSpaced, { color: colors.textPrimary }]}>分车信息</Text><View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>车辆</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{registrationDetail.vehicle_id ? vehicleLookup[registrationDetail.vehicle_id] || '待确认' : '待分配'}</Text></View></> : null}
          </View>
          {registrationDetail.status !== 'cancelled' ? <View style={styles.detailActionsRow}>
            <Pressable onPress={() => openRegistrationEditor(registrationDetail)} style={[styles.detailActionButton, { borderColor: colors.primary }]}><Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>编辑信息</Text></Pressable>
            <Pressable onPress={() => { const id = registrationDetail.id; setRegistrationDetail(null); cancelRegistration(id); }} style={[styles.detailActionButton, { borderColor: colors.error }]}><Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>取消报名</Text></Pressable>
          </View> : registrationDetail.status === 'cancelled' ? <Pressable onPress={() => deleteCancelledRegistration(registrationDetail.id)} disabled={busyRegistration === registrationDetail.id} style={[styles.deleteRegistrationButton, { borderColor: colors.error }]}><MaterialCommunityIcons name="delete-forever-outline" size={18} color={colors.error} /><Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>彻底删除这条报名</Text></Pressable> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  ) : null;

  const registrationRows = registrations.filter((registration) => {
    const query = registrationSearch.trim().toLowerCase();
    if (!query) return true;
    const names = registration.attendees?.map((item) => `${item.name} ${item.phone || ''} ${item.email || ''}`).join(' ') || '';
    const answers = Object.values(registration.answers || {}).map((value) => typeof value === 'object' ? JSON.stringify(value) : String(value)).join(' ');
    return `${names} ${answers} ${registration.registration_number || ''} ${registration.registered_by_name || ''} ${registration.registered_by_email || ''} ${registration.proxy_note || ''}`.toLowerCase().includes(query);
  }).sort((a, b) => {
    if (registrationSort === 'name_asc' || registrationSort === 'name_desc') {
      const left = a.attendees?.[0]?.name || a.registration_number || '';
      const right = b.attendees?.[0]?.name || b.registration_number || '';
      return left.localeCompare(right, 'zh-CN') * (registrationSort === 'name_asc' ? 1 : -1);
    }
    if (registrationSort === 'status') return a.status.localeCompare(b.status);
    const direction = registrationSort === 'registered_asc' ? 1 : -1;
    return (new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime() || a.id.localeCompare(b.id)) * direction;
  });
  const registrationPageCount = Math.max(1, Math.ceil(registrationRows.length / 100));
  const currentRegistrationPage = Math.min(registrationPage, registrationPageCount - 1);
  const pagedRegistrations = registrationRows.slice(currentRegistrationPage * 100, (currentRegistrationPage + 1) * 100);

  const registrationFirstAnswer = (registration: RegistrationRow) => {
    const firstRegistrationField = (registration.form_snapshot ?? event?.registration_form ?? []).find((field) => !field.system);
    if (!firstRegistrationField) return '';
    const value = registration.answers?.[firstRegistrationField.key];
    if (Array.isArray(value)) return value.join('、');
    if (value && typeof value === 'object') return value.name || '已上传文件';
    return value === undefined || value === null ? '' : String(value);
  };

  const renderRegistrationCard = (registration: RegistrationRow) => {
    const firstRegistrationField = (registration.form_snapshot ?? event?.registration_form ?? []).find((field) => !field.system);
    const firstAnswer = registrationFirstAnswer(registration);
    const showFirstAnswer = firstAnswer;
    return <Pressable key={registration.id} onPress={() => openRegistrationDetail(registration)} style={[styles.registrationPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.registrationHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.registrationTitle, { color: colors.textPrimary }]}>{registration.attendees?.map((item) => item.name).join('、') || registration.registration_number || registration.id.slice(0, 8)}</Text>
          {showFirstAnswer ? <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={1}>{firstRegistrationField?.label}：{firstAnswer}</Text> : null}
          <Text style={[styles.hint, { color: colors.textSecondary }]}>{registration.registration_kind === 'proxy' ? `代报名 · 由${registrationSubmitter(registration)}报名` : '本人报名'} · {registration.participant_count} 人 · {formatDate(registration.registered_at)}</Text>
        </View>
        <Text style={{ color: registration.status === 'waitlist' ? '#B7791F' : registration.status === 'cancelled' ? colors.textMuted : colors.success, fontSize: 13, fontWeight: '700' }}>{registration.status === 'waitlist' ? '候补' : registration.status === 'cancelled' ? '已取消' : '已确认'}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </View>
    </Pressable>;
  };

  const registrationPagination = registrationRows.length > 100 ? <View style={[styles.exportRow, { justifyContent: 'space-between', marginVertical: 12 }]}>
    <Pressable disabled={currentRegistrationPage === 0} onPress={() => setRegistrationPage(currentRegistrationPage - 1)} style={[styles.outlineButton, { borderColor: colors.border, opacity: currentRegistrationPage === 0 ? 0.4 : 1 }]}><Text style={{ color: colors.primary }}>上一页</Text></Pressable>
    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>第 {currentRegistrationPage + 1} / {registrationPageCount} 页 · 共 {registrationRows.length} 条</Text>
    <Pressable disabled={currentRegistrationPage === registrationPageCount - 1} onPress={() => setRegistrationPage(currentRegistrationPage + 1)} style={[styles.outlineButton, { borderColor: colors.border, opacity: currentRegistrationPage === registrationPageCount - 1 ? 0.4 : 1 }]}><Text style={{ color: colors.primary }}>下一页</Text></Pressable>
  </View> : null;

  const notificationJobLabel = notificationJob ? ({
    pending: '等待发送', processing: '正在发送', sent: `已向 Expo 提交 ${notificationJob.sent_count} 台设备`,
    partial: `部分失败：已提交 ${notificationJob.sent_count} 台，失败 ${notificationJob.failed_count} 台`,
    failed: `发送失败：已提交 ${notificationJob.sent_count} 台，失败 ${notificationJob.failed_count} 台`, cancelled: '已取消',
  }[notificationJob.status]) : '暂无自动通知任务';
  const notificationJobPanel = <View style={[styles.summaryPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text style={[styles.hint, { color: colors.textSecondary }]}>自动报名通知（最近一次）</Text>
    <Text style={{ color: notificationJob && ['failed', 'partial'].includes(notificationJob.status) ? colors.error : colors.textPrimary, fontSize: 13 }}>{notificationJobReadState === 'unconfigured' ? '自动通知尚未配置，请先完成后台迁移。' : notificationJobReadState === 'error' ? '暂时无法同步通知状态，请检查网络后刷新。' : notificationJobReadState === 'loading' ? '正在读取通知状态…' : notificationJobLabel}</Text>
    {notificationJobReadState === 'ready' && notificationJob ? <>
      {notificationJob.next_attempt_at && ['pending', 'failed', 'partial'].includes(notificationJob.status) ? <Text style={[styles.hint, { color: colors.textSecondary }]}>下次处理：{formatDate(notificationJob.next_attempt_at)}</Text> : null}
      {notificationJob.attempts > 0 ? <Text style={[styles.hint, { color: colors.textSecondary }]}>已尝试 {notificationJob.attempts} 次{notificationJob.last_error ? ` · ${notificationJob.last_error}` : ''}</Text> : null}
      {['failed', 'partial'].includes(notificationJob.status) ? <Text style={[styles.hint, { color: colors.textSecondary }]}>可通过上方“发送通知”手动补发。手动补发会重新向全部设备广播，已收到通知的人可能再次收到提醒。</Text> : null}
    </> : null}
  </View>;

  const selectedEventPanel = event && !editing ? (
    <>
      <View style={styles.headerRow}><Pressable onPress={() => { setEvent(null); setSelectedId(null); }} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable><View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{event.title}</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>{event.deleted_at ? '已删除 · 可查看和导出历史报名' : '报名管理'}</Text></View>{!event.deleted_at ? <><Pressable onPress={() => setEditing(true)} style={styles.addTextButton}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} /><Text style={{ color: colors.primary }}>编辑</Text></Pressable><Pressable onPress={deleteEvent} style={styles.deleteIconButton} disabled={saving}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} /></Pressable></> : null}</View>
      <View style={[styles.summaryPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.summaryText, { color: colors.textPrimary }]}>已确认 {registrations.filter((row) => row.status === 'confirmed').reduce((total, row) => total + row.participant_count, 0)} 人，候补 {registrations.filter((row) => row.status === 'waitlist').reduce((total, row) => total + row.participant_count, 0)} 人{event.vehicle_selection_mode !== 'none' ? `，待分车 ${registrations.filter((row) => row.status === 'confirmed' && !row.vehicle_id).reduce((total, row) => total + row.participant_count, 0)} 人` : ''}</Text><View style={styles.exportRow}><Pressable onPress={openExportSelector} style={[styles.outlineButton, { borderColor: colors.primary }]}><MaterialCommunityIcons name="download-outline" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 13 }}>导出表单</Text></Pressable>{!event.deleted_at ? <Pressable onPress={sendEventNotification} style={[styles.outlineButton, { borderColor: colors.primary }]}><MaterialCommunityIcons name="bell-outline" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 13 }}>发送通知</Text></Pressable> : null}</View></View>
      {notificationJobPanel}
      <View style={styles.registrationToolbar}>
        <Text style={[styles.hint, { color: registrationSyncState === 'stale' ? colors.error : colors.textSecondary }]}>{registrationSyncState === 'stale' ? '同步中断，当前名单可能已过期，请检查网络后刷新。' : registrationSyncState === 'loading' ? '正在同步完整报名名单…' : `最近同步：${registrationLastSynced ? formatDate(registrationLastSynced) : '尚未同步'}`}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}><TextInput value={registrationSearch} onChangeText={(value) => { setRegistrationSearch(value); setRegistrationPage(0); }} placeholder="搜索姓名、邮箱、电话或报名答案" placeholderTextColor={colors.textMuted} style={[styles.searchInput, { flex: 1, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]} /><Pressable accessibilityLabel="刷新报名名单" onPress={() => { if (selectedId) void loadRegistrations(selectedId).catch(() => Alert.alert('刷新失败', '请检查网络后重试。')); }} style={[styles.refreshButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="refresh" size={22} color={colors.primary} /></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {[['registered_asc', '报名顺序'], ['registered_desc', '报名倒序'], ['name_asc', '姓名正序'], ['name_desc', '姓名倒序'], ['status', '按状态']].map(([value, label]) => <Pressable key={value} onPress={() => { setRegistrationSort(value as typeof registrationSort); setRegistrationPage(0); }} style={[styles.sortChoice, { borderColor: registrationSort === value ? colors.primary : colors.border, backgroundColor: registrationSort === value ? colors.primary + '12' : colors.surface }]}><Text style={{ color: registrationSort === value ? colors.primary : colors.textSecondary, fontSize: 12 }}>{label}</Text></Pressable>)}
        </ScrollView>
      </View>
      {registrationPagination}
      {registrationRows.length === 0 ? <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 18 }]}>{registrationSearch ? '没有匹配的报名记录。' : '暂无报名记录。'}</Text> : pagedRegistrations.map(renderRegistrationCard)}
      {registrationPagination}
    </>
  ) : null;

  return <><SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
    {editing ? <View style={[styles.fixedEditorHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Pressable onPress={cancelEditing} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable>
      <Text style={[styles.fixedEditorTitle, { color: colors.textPrimary }]}>{event ? '编辑活动' : '新建活动'}</Text>
      <Pressable accessibilityLabel="预览活动" onPress={() => setPreviewing(true)} style={styles.previewHeaderButton}><MaterialCommunityIcons name="eye-outline" size={23} color={colors.primary} /></Pressable>
    </View> : null}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{editing ? editor : event ? selectedEventPanel : <><View style={styles.headerRow}><Pressable onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable><Text style={[styles.title, { color: colors.textPrimary }]}>活动发布与管理</Text><Pressable onPress={startCreate} style={styles.addTextButton}><MaterialCommunityIcons name="plus" size={18} color={colors.primary} /><Text style={{ color: colors.primary }}>新建</Text></Pressable></View>{loading ? <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} /> : events.length === 0 ? <View style={styles.empty}><MaterialCommunityIcons name="calendar-plus" size={44} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>还没有活动</Text><Pressable onPress={startCreate} style={[styles.saveButton, { backgroundColor: colors.primary, marginTop: 14 }]}><Text style={styles.saveButtonText}>创建第一个活动</Text></Pressable></View> : events.map((item) => <Pressable key={item.id} onPress={() => openEvent(item.id)} style={[styles.eventListRow, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[styles.eventListTitle, { color: colors.textPrimary }]}>{item.title}</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>{localDateInput(item.start_time)} · {item.deleted_at ? '已删除' : statusOptions.find((option) => option.value === item.registration_status)?.label || item.registration_status} · {item.allow_proxy_registration ? '允许代报名' : '仅本人报名'}</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} /></Pressable>)}</>}</ScrollView>
    {eventPreview}
    <Modal visible={notificationModalVisible} animationType="slide" transparent onRequestClose={() => setNotificationModalVisible(false)}>
      <View style={styles.exportModalBackdrop}>
        <View style={[styles.exportModal, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>发送活动通知</Text>
          <FormLabel colors={colors}>通知标题</FormLabel>
          <TextInput value={notificationTitle} onChangeText={setNotificationTitle} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
          <FormLabel colors={colors}>通知内容</FormLabel>
          <TextInput value={notificationBody} onChangeText={setNotificationBody} multiline style={[styles.input, styles.textarea, { color: colors.textPrimary, borderColor: colors.border }]} />
          <View style={styles.exportModalActions}>
            <Pressable onPress={() => setNotificationModalVisible(false)} style={[styles.outlineButton, { borderColor: colors.border }]}><Text style={{ color: colors.textSecondary }}>取消</Text></Pressable>
            <Pressable onPress={() => { Alert.alert('确认发送', '确定向所有已开启推送的设备发送这条通知吗？', [{ text: '返回', style: 'cancel' }, { text: '确认发送', onPress: () => { void confirmSendEventNotification(); } }]); }} style={[styles.saveButton, { backgroundColor: colors.primary }]}><Text style={styles.saveButtonText}>发送</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
    <Modal visible={exportModalVisible} animationType="slide" transparent onRequestClose={() => setExportModalVisible(false)}>
      <View style={styles.exportModalBackdrop}>
        <View style={[styles.exportModal, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>选择导出字段</Text>
          <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 10 }]}>选择“昵称 + 车辆”即可导出分车名单。导出文件为 Excel 可直接打开的 CSV。</Text>
          <ScrollView style={{ maxHeight: 430 }}>
            {exportOptions.map((option) => {
              const selected = selectedExportKeys.includes(option.key);
              return <Pressable key={option.key} onPress={() => setSelectedExportKeys((current) => selected ? current.filter((key) => key !== option.key) : [...current, option.key])} style={styles.exportOptionRow}>
                <MaterialCommunityIcons name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={selected ? colors.primary : colors.textMuted} />
                <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{option.label}</Text>
              </Pressable>;
            })}
          </ScrollView>
          <Pressable onPress={() => setIncludeCancelled((value) => !value)} style={styles.exportOptionRow}><MaterialCommunityIcons name={includeCancelled ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={includeCancelled ? colors.primary : colors.textMuted} /><Text style={{ color: colors.textPrimary, fontSize: 14 }}>包含已取消的报名</Text></Pressable>
          <View style={styles.exportModalActions}>
            <Pressable onPress={() => setExportModalVisible(false)} style={[styles.outlineButton, { borderColor: colors.border }]}><Text style={{ color: colors.textSecondary }}>取消</Text></Pressable>
            <Pressable onPress={() => { setExportModalVisible(false); void exportCsv(); }} disabled={selectedExportKeys.length === 0} style={[styles.saveButton, { backgroundColor: colors.primary, opacity: selectedExportKeys.length === 0 ? 0.5 : 1 }]}><Text style={styles.saveButtonText}>导出</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </SafeAreaView>{registrationDetailModal}{registrationEditorModal}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 42 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 17 },
  fixedEditorHeader: { height: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 10 },
  fixedEditorTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  previewHeaderButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  previewHeader: { height: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 10 },
  previewHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  headerButtonSpacer: { width: 40, height: 40 },
  previewContent: { padding: 16, paddingBottom: 40 },
  editorContent: { padding: 16, paddingBottom: 42 },
  previewTitle: { fontSize: 25, fontWeight: '700', marginBottom: 12 },
  previewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  metaText: { fontSize: 13, lineHeight: 19 },
  previewDescription: { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 10, marginBottom: 12 },
  previewSection: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12 },
  previewSectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  previewField: { marginBottom: 14 },
  previewFieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  previewOption: { fontSize: 13, marginTop: 5 },
  previewInputLine: { borderBottomWidth: 1, height: 26 },
  registrationEditField: { marginBottom: 12 },
  registrationInfoValue: { minHeight: 45, paddingHorizontal: 11, paddingVertical: 12, fontSize: 14 },
  editorActionButton: { alignItems: 'center', paddingVertical: 11 },
  textareaInput: { minHeight: 100, paddingTop: 11, textAlignVertical: 'top' },
  adminAnswerOptions: { gap: 7 },
  adminAnswerOption: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  backButton: { width: 34, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', flex: 1 },
  panel: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  summaryPanel: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  summaryText: { fontSize: 14, fontWeight: '600' },
  registrationToolbar: { marginBottom: 10, gap: 8 },
  searchInput: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  refreshButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sortRow: { gap: 7 },
  sortChoice: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, fontSize: 14 },
  textarea: { minHeight: 105, paddingTop: 11, textAlignVertical: 'top' },
  hint: { fontSize: 12, lineHeight: 18 },
  twoColumns: { flexDirection: 'row', gap: 8, marginTop: 9 },
  columnInput: { flex: 1 },
  dateButtonLabel: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
  dateButton: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  pickerPanel: { alignItems: 'center', paddingVertical: 8, gap: 5 },
  registrationTimePanel: { marginTop: 4 },
  registrationSwitchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  choiceGroup: { marginTop: 13 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  choice: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  smallChoice: { borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 7 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  markdownBox: { borderWidth: 1, borderRadius: 9, marginTop: 5, overflow: 'hidden' },
  addTextButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5 },
  deleteIconButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  fieldEditor: { borderWidth: 1, borderRadius: 9, padding: 10, marginBottom: 9 },
  fieldEditorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldIndex: { fontSize: 12, fontWeight: '600' },
  inlineActions: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  formHint: { fontSize: 12, lineHeight: 18, marginTop: -4, marginBottom: 10 },
  optionsEditor: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: '#00000005' },
  optionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  optionAddButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  optionEditorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  optionNumber: { width: 18, textAlign: 'center', fontSize: 12 },
  optionInput: { flex: 1, minHeight: 42 },
  noFields: { minHeight: 72, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 10 },
  addFieldButton: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 3 },
  vehicleEditor: { borderWidth: 1, borderRadius: 9, padding: 10, marginBottom: 9 },
  saveButton: { minHeight: 49, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  saveButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  eventListRow: { borderWidth: 1, borderRadius: 11, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  eventListTitle: { fontSize: 16, fontWeight: '700', marginBottom: 5 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 12 },
  exportRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  exportModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  exportModal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18, paddingBottom: 28 },
  exportOptionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exportModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  outlineButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  registrationPanel: { borderWidth: 1, borderRadius: 11, padding: 13, marginBottom: 9 },
  registrationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  registrationDetailTitle: { fontSize: 21, fontWeight: '700', lineHeight: 28, marginBottom: 14 },
  detailPanel: { borderWidth: 1, borderRadius: 11, padding: 16, marginBottom: 16 },
  detailSectionHeading: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 8 },
  detailSectionHeadingSpaced: { marginTop: 18 },
  detailSectionTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 3 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 8 },
  detailLabel: { width: 68, fontSize: 12, lineHeight: 20 },
  detailValue: { flex: 1, fontSize: 14, lineHeight: 21 },
  attendeeDetailBlock: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 7, paddingTop: 9 },
  detailActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  detailActionButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  deleteRegistrationButton: { minHeight: 44, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 20 },
  registrationTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  registrationActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
});
