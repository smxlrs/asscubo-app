import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { broadcastPushNotification } from '../../lib/notificationService';

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
  attendees?: Array<{ name: string; phone: string | null; email: string | null; answers?: Record<string, any> }>;
};

type RegistrationEditorState = {
  registration: RegistrationRow;
  name: string;
  phone: string;
  email: string;
  answers: Record<string, any>;
  vehicle_id: string | null;
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
  { type: 'file', label: '文件' },
];

function localDateInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace('T', ' ').slice(0, 16);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function romeToIso(value: string) {
  if (!value.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00'] = match;
  const wallAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const romeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(wallAsUtc)).reduce<Record<string, number>>((result, part) => {
    if (['year', 'month', 'day', 'hour', 'minute'].includes(part.type)) result[part.type] = Number(part.value);
    return result;
  }, {});
  const romeAsUtc = Date.UTC(romeParts.year, romeParts.month - 1, romeParts.day, romeParts.hour, romeParts.minute);
  return new Date(wallAsUtc - (romeAsUtc - wallAsUtc)).toISOString();
}

function inputDate(value: string) {
  const normalized = value.trim().replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function dateInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function FormLabel({ children, colors, optional = false }: { children: React.ReactNode; colors: any; optional?: boolean }) {
  return <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 5 }}>{children}{optional ? '（可选）' : ''}</Text>;
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
  const [originalVehicleIds, setOriginalVehicleIds] = useState<string[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [vehicleLookup, setVehicleLookup] = useState<Record<string, string>>({});
  const [busyRegistration, setBusyRegistration] = useState<string | null>(null);
  const [registrationEditor, setRegistrationEditor] = useState<RegistrationEditorState | null>(null);
  const [registrationDetail, setRegistrationDetail] = useState<RegistrationRow | null>(null);
  const [registrationDateField, setRegistrationDateField] = useState<string | null>(null);
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationSort, setRegistrationSort] = useState<'registered_asc' | 'registered_desc' | 'name_asc' | 'name_desc' | 'status'>('registered_asc');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedExportKeys, setSelectedExportKeys] = useState<string[]>([]);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');

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
      const { data, error } = await supabase.from('events').select('*').is('deleted_at', null).order('start_time', { ascending: false });
      if (error) throw error;
      setEvents((data || []) as EventRow[]);
    } catch (error: any) {
      Alert.alert('加载失败', error?.message || '活动列表加载失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const loadRegistrations = useCallback(async (eventId: string) => {
    const [{ data: registrationData, error: registrationError }, { data: vehicleData, error: vehicleError }] = await Promise.all([
      supabase.from('event_registrations').select('*').eq('event_id', eventId).order('registered_at', { ascending: false }),
      supabase.from('event_vehicles').select('*').eq('event_id', eventId).order('sort_order', { ascending: true }),
    ]);
    if (registrationError) throw registrationError;
    if (vehicleError) throw vehicleError;

    const rows = (registrationData || []) as RegistrationRow[];
    const { data: attendeeData, error: attendeeError } = rows.length
      ? await supabase.from('event_registration_attendees').select('*').in('registration_id', rows.map((item) => item.id)).order('sort_order', { ascending: true })
      : { data: [], error: null } as any;
    if (attendeeError) throw attendeeError;
    const attendeeMap = new Map<string, any[]>();
    (attendeeData || []).forEach((row: any) => {
      const list = attendeeMap.get(row.registration_id) || [];
      list.push(row);
      attendeeMap.set(row.registration_id, list);
    });
    setRegistrations(rows.map((row) => ({ ...row, attendees: attendeeMap.get(row.id) || [] })));
    const lookup: Record<string, string> = {};
    (vehicleData || []).forEach((vehicle: any) => { lookup[vehicle.id] = vehicle.name; });
    setVehicleLookup(lookup);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase
      .channel(`event-registration-${selectedId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_registrations',
        filter: `event_id=eq.${selectedId}`,
      }, () => {
        void loadRegistrations(selectedId).catch((error) => {
          console.warn('Failed to refresh event registrations:', error);
        });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_registration_attendees',
      }, () => {
        void loadRegistrations(selectedId).catch((error) => {
          console.warn('Failed to refresh event attendees:', error);
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRegistrations, selectedId]);

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
      setEvent(loaded);
      setSelectedId(loaded.id);
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
      const drafts = loadedVehicles.map((vehicle) => ({
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
      setOriginalVehicleIds(drafts.map((item) => item.id).filter(Boolean) as string[]);
      await loadRegistrations(loaded.id);
    } catch (error: any) {
      Alert.alert('加载失败', error?.message || '活动详情加载失败。');
    } finally {
      setLoading(false);
    }
  }, [loadRegistrations]);

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
    setOriginalVehicleIds([]);
    setRegistrations([]);
    setVehicleLookup({});
  };

  const saveEvent = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('信息不完整', '请填写活动标题和活动详情。');
      return;
    }
    const start = romeToIso(startTime);
    const end = romeToIso(endTime);
    if (!start || (hasEndDate && !end)) {
      Alert.alert('日期不完整', hasEndDate ? '请选择开始日期和结束日期。' : '请选择活动日期。');
      return;
    }
    const effectiveEnd = hasEndDate ? end : romeToIso(`${startTime.slice(0, 10)} 23:59`);
    if (!effectiveEnd || new Date(effectiveEnd).getTime() < new Date(start).getTime()) {
      Alert.alert('时间不正确', '结束日期不能早于开始日期。');
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
        end_has_time: hasEndDate && endHasTime,
        registration_deadline: deadlineEnabled ? romeToIso(deadline) : null,
        registration_start_at: registrationStartEnabled ? romeToIso(registrationStart) : null,
        registration_start_notify_enabled: registrationStartEnabled && registrationStartNotifyEnabled,
        max_participants: parsedMax,
        is_published: published,
        registration_status: status,
        registration_mode: 'authenticated',
        registration_form: fields.map((field) => ({
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

      let savedEvent: EventRow;
      if (event) {
        const { data, error } = await supabase.from('events').update(payload).eq('id', event.id).select().single();
        if (error) throw error;
        savedEvent = data as EventRow;
      } else {
        const { data, error } = await supabase.from('events').insert(payload).select().single();
        if (error) throw error;
        savedEvent = data as EventRow;
      }

      const currentIds = vehicles.map((vehicle) => vehicle.id).filter(Boolean) as string[];
      const removedIds = originalVehicleIds.filter((id) => !currentIds.includes(id));
      if (removedIds.length > 0) {
        const { error } = await supabase.from('event_vehicles').update({ is_active: false }).in('id', removedIds);
        if (error) throw error;
      }
      for (let index = 0; index < vehicles.length; index += 1) {
        const vehicle = vehicles[index];
        const vehiclePayload = {
          event_id: savedEvent.id,
          name: vehicle.name.trim(),
          capacity: Number(vehicle.capacity),
          reserved_seats: Number(vehicle.reserved_seats || 0),
          boarding_stop: vehicle.boarding_stop.trim() || null,
          departure_time: vehicle.departure_time.trim() || null,
          notes: vehicle.notes.trim() || null,
          sort_order: index,
          is_active: vehicle.is_active,
        };
        const result = vehicle.id
          ? await supabase.from('event_vehicles').update(vehiclePayload).eq('id', vehicle.id)
          : await supabase.from('event_vehicles').insert(vehiclePayload);
        if (result.error) throw result.error;
      }

      const { error: scheduleError } = await supabase.rpc('schedule_event_registration_start_notification', {
        p_event_id: savedEvent.id,
      });
      if (scheduleError) {
        console.warn('Failed to schedule registration-start notification:', scheduleError);
      }

      Alert.alert(
        '保存成功',
        scheduleError ? '活动设置已保存，但自动报名通知任务设置失败，请检查 Supabase 配置。' : '活动设置已保存。',
        [{ text: '好的', onPress: () => openEvent(savedEvent.id) }]
      );
      await loadEvents();
    } catch (error: any) {
      Alert.alert('保存失败', error?.message || '活动设置保存失败，请检查权限和网络。');
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
    if (result.success) Alert.alert('发送成功', `已向 ${result.sentCount || 0} 台设备发送活动通知。`);
    else Alert.alert('发送失败', '活动已保存，但 Expo Push 发送失败，请稍后重试。');
  };

  const addField = (type: EventFormFieldType) => {
    const baseKey = `field_${Date.now()}`;
    const needsOptions = type === 'select' || type === 'multiselect';
    setFields((current) => [...current, {
      key: baseKey,
      type,
      label: FIELD_TYPES.find((item) => item.type === type)?.label || '新字段',
      required: false,
      options: needsOptions ? ['选项 1', '选项 2'] : undefined,
      maxFileSizeMb: type === 'file' ? 10 : undefined,
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
    if (pickerTarget === 'startDate') {
      const current = inputDate(startTime || dateInputValue(new Date()));
      selectedDate.setHours(current.getHours(), current.getMinutes(), 0, 0);
      setStartTime(dateInputValue(selectedDate));
    } else if (pickerTarget === 'endDate') {
      const current = inputDate(endTime || startTime || dateInputValue(new Date()));
      selectedDate.setHours(current.getHours(), current.getMinutes(), 0, 0);
      setEndTime(dateInputValue(selectedDate));
      setHasEndDate(true);
    } else if (pickerTarget === 'startTime') {
      const current = inputDate(startTime || dateInputValue(new Date()));
      current.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setStartTime(dateInputValue(current));
      setStartHasTime(true);
    } else if (pickerTarget === 'endTime') {
      const current = inputDate(endTime || startTime || dateInputValue(new Date()));
      current.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setEndTime(dateInputValue(current));
      setEndHasTime(true);
    } else if (pickerTarget === 'registrationStartDate') {
      const current = inputDate(registrationStart || dateInputValue(new Date()));
      selectedDate.setHours(current.getHours(), current.getMinutes(), 0, 0);
      setRegistrationStart(dateInputValue(selectedDate));
    } else if (pickerTarget === 'registrationStartTime') {
      const current = inputDate(registrationStart || dateInputValue(new Date()));
      current.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setRegistrationStart(dateInputValue(current));
    } else if (pickerTarget === 'deadlineDate') {
      const current = inputDate(deadline || dateInputValue(new Date()));
      selectedDate.setHours(current.getHours(), current.getMinutes(), 0, 0);
      setDeadline(dateInputValue(selectedDate));
    } else if (pickerTarget === 'deadlineTime') {
      const current = inputDate(deadline || dateInputValue(new Date()));
      current.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setDeadline(dateInputValue(current));
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

  const assignVehicle = async (registrationId: string, nextVehicleId: string | null) => {
    setBusyRegistration(registrationId);
    try {
      const { error } = await supabase.rpc('admin_assign_event_registration', {
        p_registration_id: registrationId,
        p_vehicle_id: nextVehicleId,
      });
      if (error) throw error;
      if (selectedId) await loadRegistrations(selectedId);
    } catch (error: any) {
      Alert.alert('分车失败', error?.message || '车辆分配失败，请检查剩余座位。');
    } finally {
      setBusyRegistration(null);
    }
  };

  const sendTargetedEventPush = async (userId: string | null, title: string, body: string, eventId: string) => {
    if (!userId) return;
    const { data, error } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
    if (error) throw error;
    const tokens = [...new Set((data || []).map((row: any) => row.token).filter(Boolean))];
    if (tokens.length === 0) return;
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map((token) => ({ to: token, sound: 'default', title, body, data: { category: 'events', eventId } }))),
    });
    if (!response.ok) throw new Error(`Expo Push failed (${response.status}).`);
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
          Alert.alert('操作失败', error?.message || '候补转正失败。');
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
          if (notify) {
            const registration = registrations.find((row) => row.id === registrationId);
            await sendTargetedEventPush(registration?.user_id || null, '活动报名已取消', `您的${event?.title || '活动'}报名已被取消，请注意核实`, event?.id || '');
          }
          if (selectedId) await loadRegistrations(selectedId);
        } catch (error: any) {
          Alert.alert('操作失败', error?.message || '取消报名失败。');
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
    const attendee = registration.attendees?.[0];
    setRegistrationEditor({
      registration,
      name: attendee?.name || '',
      phone: attendee?.phone || '',
      email: attendee?.email || '',
      answers: { ...(attendee?.answers || registration.answers || {}) },
      vehicle_id: registration.vehicle_id || null,
    });
  };

  const openRegistrationDetail = (registration: RegistrationRow) => setRegistrationDetail(registration);

  const saveRegistrationEdit = (notify: boolean) => {
    if (!registrationEditor) return;
    const { registration, name, phone, email, answers, vehicle_id } = registrationEditor;
    setBusyRegistration(registration.id);
    void (async () => {
      try {
        const { error } = await supabase.rpc('admin_update_event_registration', {
          p_registration_id: registration.id,
          p_name: name.trim(),
          p_phone: phone.trim() || null,
          p_email: email.trim() || null,
          p_answers: answers,
          p_notify: notify,
        });
        if (error) throw error;
        if (notify) {
          await sendTargetedEventPush(registration.user_id, '活动报名信息已修改', `您的${event?.title || '活动'}报名信息已被修改，请注意核实`, event?.id || '');
        }
        if (vehicle_id !== registration.vehicle_id) {
          const { error: vehicleError } = await supabase.rpc('admin_assign_event_registration', {
            p_registration_id: registration.id,
            p_vehicle_id: vehicle_id,
          });
          if (vehicleError) throw vehicleError;
        }
        setRegistrationEditor(null);
        if (selectedId) await loadRegistrations(selectedId);
        Alert.alert('已保存', notify ? '报名信息已修改，并已通知报名者。' : '报名信息已修改。');
      } catch (error: any) {
        Alert.alert('保存失败', error?.message || '报名信息保存失败。');
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
            const { error } = await supabase
              .from('events')
              .update({ deleted_at: new Date().toISOString(), is_published: false, registration_status: 'archived', registration_start_notify_enabled: false })
              .eq('id', event.id);
            if (error) throw error;
            const { error: scheduleError } = await supabase.rpc('schedule_event_registration_start_notification', { p_event_id: event.id });
            if (scheduleError) console.warn('Failed to remove registration-start notification schedule:', scheduleError);
            setEvent(null);
            setSelectedId(null);
            await loadEvents();
            Alert.alert('已删除', '活动已从用户端隐藏，报名数据仍已保留。');
          } catch (error: any) {
            Alert.alert('删除失败', error?.message || '活动删除失败，请稍后重试。');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const exportOptions = useMemo(() => {
    const formFields = (event?.registration_form || []) as EventFormField[];
    return [
      { key: 'name', label: '昵称' },
      { key: 'email', label: '邮箱' },
      { key: 'phone', label: '电话' },
      { key: 'vehicle', label: '车辆' },
      { key: 'registration_number', label: '报名编号' },
      { key: 'registered_at', label: '报名时间' },
      { key: 'status', label: '状态' },
      { key: 'registration_kind', label: '报名类型' },
      { key: 'proxy_note', label: '备注' },
      { key: 'participant_count', label: '报名人数' },
      ...formFields.map((field) => ({ key: `field:${field.key}`, label: field.label })),
    ];
  }, [event?.registration_form]);

  const openExportSelector = () => {
    if (!event || registrations.length === 0) {
      Alert.alert('暂无报名', '当前活动还没有可导出的报名记录。');
      return;
    }
    setSelectedExportKeys(exportOptions.map((option) => option.key));
    setExportModalVisible(true);
  };

  const exportCsv = async () => {
    if (!event || registrations.length === 0) {
      Alert.alert('暂无报名', '当前活动还没有可导出的报名记录。');
      return;
    }
    try {
      const formFields = (event.registration_form || []) as EventFormField[];
      const rows: string[][] = [];
      const activeKeys = selectedExportKeys.length ? selectedExportKeys : exportOptions.map((option) => option.key);
      rows.push(activeKeys.map((key) => exportOptions.find((option) => option.key === key)?.label || key));
      const originalOrder = new Map(registrations.map((row, index) => [row.id, index]));
      const vehicleOrder = new Map(vehicles.map((vehicle, index) => [vehicle.id, index]));
      const orderedRegistrations = [...registrations].sort((left, right) => {
        if (!activeKeys.includes('vehicle')) return originalOrder.get(left.id)! - originalOrder.get(right.id)!;
        const leftRank = left.vehicle_id && vehicleOrder.has(left.vehicle_id) ? vehicleOrder.get(left.vehicle_id)! : Number.MAX_SAFE_INTEGER;
        const rightRank = right.vehicle_id && vehicleOrder.has(right.vehicle_id) ? vehicleOrder.get(right.vehicle_id)! : Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank || originalOrder.get(left.id)! - originalOrder.get(right.id)!;
      });
      orderedRegistrations.filter((row) => row.status !== 'cancelled').forEach((row) => {
        const attendees = row.attendees?.length ? row.attendees : [{ name: '', phone: null, email: null, answers: row.answers }];
        attendees.forEach((attendee) => rows.push(activeKeys.map((key) => {
          const value = key === 'name' ? attendee.name : key === 'email' ? attendee.email || '' : key === 'phone' ? attendee.phone || ''
            : key === 'vehicle' ? (row.vehicle_id ? (vehicleLookup[row.vehicle_id] || '待确认') : '待分配')
            : key === 'registration_number' ? row.registration_number || row.id.slice(0, 8)
            : key === 'registered_at' ? `\t${formatDate(row.registered_at)}`
            : key === 'status' ? row.status
            : key === 'registration_kind' ? (row.registration_kind === 'proxy' ? '代他人报名' : '本人报名')
            : key === 'proxy_note' ? row.proxy_note || ''
            : key === 'participant_count' ? String(row.participant_count)
            : (attendee.answers || row.answers)?.[key.slice(6)];
          return Array.isArray(value) ? value.join('、') : typeof value === 'object' && value ? value.name || value.path || '' : value ?? '';
        })));
      });
      const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
      const safeTitle = event.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 50);
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
        <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 10 }]}>以下时间均按意大利当地时间（Europe/Rome）设置和执行。</Text>
        <FormLabel colors={colors}>活动日期</FormLabel>
        <View><Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>开始日期</Text><Pressable onPress={() => openPicker('startDate')} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="calendar-month-outline" size={19} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{dateLabel(startTime)}</Text></Pressable></View>
        <View style={styles.registrationSwitchRow}><View style={{ flex: 1 }}><Text style={[styles.dateButtonLabel, { color: colors.textSecondary, marginBottom: 0 }]}>设置结束日期</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>关闭表示单日活动</Text></View><Switch value={hasEndDate} onValueChange={(value) => { setHasEndDate(value); if (!value) setEndHasTime(false); }} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={hasEndDate ? colors.primary : colors.textMuted} /></View>
        {hasEndDate ? <View><Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>结束日期</Text><Pressable onPress={() => openPicker('endDate')} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="calendar-month-outline" size={19} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{dateLabel(endTime)}</Text></Pressable></View> : null}
        <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>设置具体时间</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>不勾选时只显示活动日期。</Text></View><Switch value={startHasTime || endHasTime} onValueChange={(value) => { setStartHasTime(value); setEndHasTime(value); }} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={(startHasTime || endHasTime) ? colors.primary : colors.textMuted} /></View>
        {(startHasTime || endHasTime) ? <View style={styles.twoColumns}><View style={styles.columnInput}><Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>开始时间</Text><Pressable onPress={() => openPicker('startTime')} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="clock-outline" size={19} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{startHasTime ? timeLabel(startTime) : '设置开始时间'}</Text></Pressable></View><View style={styles.columnInput}><Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>结束时间（可选）</Text><Pressable onPress={() => { setEndHasTime(true); openPicker('endTime'); }} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="clock-outline" size={19} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{endHasTime ? timeLabel(endTime) : '设置结束时间'}</Text></Pressable></View></View> : null}
        {pickerTarget ? <View style={styles.pickerPanel}><DateTimePicker value={inputDate(pickerTarget === 'startDate' || pickerTarget === 'startTime' ? (startTime || dateInputValue(new Date())) : pickerTarget === 'endDate' || pickerTarget === 'endTime' ? (endTime || startTime || dateInputValue(new Date())) : pickerTarget.startsWith('registrationStart') ? (registrationStart || dateInputValue(new Date())) : (deadline || dateInputValue(new Date())))} mode={pickerTarget.endsWith('Date') ? 'date' : 'time'} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onValueChange={handlePickerValueChange} onDismiss={handlePickerDismiss} /></View> : null}
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
        {fields.map((field, index) => <View key={`${field.key}-${index}`} style={[styles.fieldEditor, { borderColor: colors.border }]}>
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
    : `${dateLabel(startTime)}${startHasTime ? ` ${timeLabel(startTime)}` : ''}`;

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
          ].map(([label, _key, value]) => <View key={label as string} style={styles.registrationEditField}>
            <Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.registrationInfoValue, { color: colors.textPrimary }]}>{(value as string) || '未填写'}</Text>
          </View>)}
          {event?.vehicle_selection_mode !== 'none' ? <View style={styles.registrationEditField}>
            <Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>分车</Text>
            <View style={styles.adminAnswerOptions}>
              {[{ id: null, name: '待分配' }, ...Object.entries(vehicleLookup).map(([id, name]) => ({ id, name }))].map((vehicle) => {
                const selected = registrationEditor.vehicle_id === vehicle.id;
                return <Pressable key={vehicle.id || 'none'} onPress={() => setRegistrationEditor((current) => current ? { ...current, vehicle_id: vehicle.id } : current)} style={[styles.adminAnswerOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : colors.surface }]}><MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={selected ? colors.primary : colors.textMuted} /><Text style={{ color: colors.textPrimary }}>{vehicle.name}</Text></Pressable>;
              })}
            </View>
          </View> : null}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 12 }]}>报名表答案</Text>
          {(event?.registration_form || []).filter((field) => !field.system).map((field) => {
            const value = registrationEditor.answers[field.key];
            const textValue = Array.isArray(value) ? value.join(', ') : value === undefined || value === null ? '' : String(value);
            return <View key={field.key} style={styles.registrationEditField}>
              <Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>{field.label}{field.required ? '（必填）' : ''}</Text>
              {field.type === 'select' || field.type === 'multiselect' ? <View style={styles.adminAnswerOptions}>{(field.options || []).map((option) => { const selected = field.type === 'multiselect' ? Array.isArray(value) && value.includes(option) : value === option; return <Pressable key={option} onPress={() => setRegistrationEditor((current) => { if (!current) return current; const next = field.type === 'multiselect' ? (selected ? (Array.isArray(value) ? value.filter((item) => item !== option) : []) : [...(Array.isArray(value) ? value : []), option]) : option; return { ...current, answers: { ...current.answers, [field.key]: next } }; })} style={[styles.adminAnswerOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : colors.surface }]}><MaterialCommunityIcons name={selected ? 'checkbox-marked-circle' : 'circle-outline'} size={18} color={selected ? colors.primary : colors.textMuted} /><Text style={{ color: colors.textPrimary }}>{option}</Text></Pressable>; })}</View> : field.type === 'checkbox' ? <Switch value={Boolean(value)} onValueChange={(next) => setRegistrationEditor((current) => current ? { ...current, answers: { ...current.answers, [field.key]: next } } : current)} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={value ? colors.primary : colors.textMuted} /> : field.type === 'date' ? <>
                <Pressable onPress={() => setRegistrationDateField(field.key)} style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.primary} /><Text style={{ color: textValue ? colors.textPrimary : colors.textMuted }}>{textValue || '选择日期'}</Text></Pressable>
                {registrationDateField === field.key ? <View style={styles.pickerPanel}><DateTimePicker value={textValue ? new Date(`${textValue}T12:00:00`) : new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onValueChange={(_event: DateTimePickerChangeEvent, date: Date) => { setRegistrationEditor((current) => current ? { ...current, answers: { ...current.answers, [field.key]: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` } } : current); setRegistrationDateField(null); }} onDismiss={() => setRegistrationDateField(null)} /></View> : null}
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
            <Text style={[styles.detailSectionHeading, styles.detailSectionHeadingSpaced, { color: colors.textPrimary }]}>报名人信息</Text>
            {registrationDetail.attendees?.map((attendee, index) => <View key={`${attendee.name}-${index}`} style={styles.attendeeDetailBlock}>
              <Text style={[styles.detailSectionTitle, { color: colors.textPrimary }]}>报名人 {index + 1}</Text>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>昵称</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{attendee.name || '未填写'}</Text></View>
              {attendee.email ? <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>邮箱</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{attendee.email}</Text></View> : null}
              {attendee.phone ? <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>电话</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{attendee.phone}</Text></View> : null}
            </View>)}
            <Text style={[styles.detailSectionHeading, styles.detailSectionHeadingSpaced, { color: colors.textPrimary }]}>报名表答案</Text>
            {((event?.registration_form || []) as EventFormField[]).filter((field) => !field.system).map((field) => {
              const value = registrationDetail.answers?.[field.key];
              if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
              const display = Array.isArray(value) ? value.join('、') : typeof value === 'object' ? value.name || value.path || '已上传文件' : String(value);
              return <View key={field.key} style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{field.label}</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{display}</Text></View>;
            })}
            {event?.vehicle_selection_mode !== 'none' ? <><Text style={[styles.detailSectionHeading, styles.detailSectionHeadingSpaced, { color: colors.textPrimary }]}>分车信息</Text><View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textSecondary }]}>车辆</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{registrationDetail.vehicle_id ? vehicleLookup[registrationDetail.vehicle_id] || '待确认' : '待分配'}</Text></View></> : null}
          </View>
          {registrationDetail.status !== 'cancelled' ? <View style={styles.detailActionsRow}>
            <Pressable onPress={() => { const current = registrationDetail; setRegistrationDetail(null); openRegistrationEditor(current); }} style={[styles.detailActionButton, { borderColor: colors.primary }]}><Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>编辑信息</Text></Pressable>
            <Pressable onPress={() => { const id = registrationDetail.id; setRegistrationDetail(null); cancelRegistration(id); }} style={[styles.detailActionButton, { borderColor: colors.error }]}><Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>取消报名</Text></Pressable>
          </View> : registrationDetail.status === 'cancelled' ? <Pressable onPress={() => deleteCancelledRegistration(registrationDetail.id)} disabled={busyRegistration === registrationDetail.id} style={[styles.deleteRegistrationButton, { borderColor: colors.error }]}><MaterialCommunityIcons name="delete-forever-outline" size={18} color={colors.error} /><Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>彻底删除这条报名</Text></Pressable> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  ) : null;

  const firstRegistrationField = (event?.registration_form || []).find((field) => !field.system);
  const registrationRows = registrations.filter((registration) => {
    const query = registrationSearch.trim().toLowerCase();
    if (!query) return true;
    const names = registration.attendees?.map((item) => `${item.name} ${item.phone || ''} ${item.email || ''}`).join(' ') || '';
    const answers = Object.values(registration.answers || {}).map((value) => typeof value === 'object' ? JSON.stringify(value) : String(value)).join(' ');
    return `${names} ${answers} ${registration.registration_number || ''}`.toLowerCase().includes(query);
  }).sort((a, b) => {
    if (registrationSort === 'name_asc' || registrationSort === 'name_desc') {
      const left = a.attendees?.[0]?.name || a.registration_number || '';
      const right = b.attendees?.[0]?.name || b.registration_number || '';
      return left.localeCompare(right, 'zh-CN') * (registrationSort === 'name_asc' ? 1 : -1);
    }
    if (registrationSort === 'status') return a.status.localeCompare(b.status);
    const direction = registrationSort === 'registered_asc' ? 1 : -1;
    return (new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime()) * direction;
  });

  const registrationFirstAnswer = (registration: RegistrationRow) => {
    if (!firstRegistrationField) return '';
    const value = registration.answers?.[firstRegistrationField.key];
    if (Array.isArray(value)) return value.join('、');
    if (value && typeof value === 'object') return value.name || '已上传文件';
    return value === undefined || value === null ? '' : String(value);
  };

  const renderRegistrationCard = (registration: RegistrationRow) => {
    const firstAnswer = registrationFirstAnswer(registration);
    const showFirstAnswer = firstAnswer;
    return <Pressable key={registration.id} onPress={() => openRegistrationDetail(registration)} style={[styles.registrationPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.registrationHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.registrationTitle, { color: colors.textPrimary }]}>{registration.attendees?.map((item) => item.name).join('、') || registration.registration_number || registration.id.slice(0, 8)}</Text>
          {showFirstAnswer ? <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={1}>{firstRegistrationField?.label}：{firstAnswer}</Text> : null}
          <Text style={[styles.hint, { color: colors.textSecondary }]}>{registration.registration_kind === 'proxy' ? `代报名：${registration.proxy_note || '未填写备注'}` : '本人报名'} · {registration.participant_count} 人 · {formatDate(registration.registered_at)}</Text>
        </View>
        <Text style={{ color: registration.status === 'waitlist' ? '#B7791F' : registration.status === 'cancelled' ? colors.textMuted : colors.success, fontSize: 13, fontWeight: '700' }}>{registration.status === 'waitlist' ? '候补' : registration.status === 'cancelled' ? '已取消' : '已确认'}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </View>
    </Pressable>;
  };

  const selectedEventPanel = event && !editing ? (
    <>
      <View style={styles.headerRow}><Pressable onPress={() => { setEvent(null); setSelectedId(null); }} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable><View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{event.title}</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>报名管理</Text></View><Pressable onPress={() => setEditing(true)} style={styles.addTextButton}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} /><Text style={{ color: colors.primary }}>编辑</Text></Pressable><Pressable onPress={deleteEvent} style={styles.deleteIconButton} disabled={saving}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} /></Pressable></View>
      <View style={[styles.summaryPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.summaryText, { color: colors.textPrimary }]}>当前报名：{registrations.filter((row) => row.status === 'confirmed').length} 条确认，{registrations.filter((row) => row.status === 'waitlist').length} 条候补</Text><View style={styles.exportRow}><Pressable onPress={openExportSelector} style={[styles.outlineButton, { borderColor: colors.primary }]}><MaterialCommunityIcons name="download-outline" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 13 }}>导出表单</Text></Pressable><Pressable onPress={sendEventNotification} style={[styles.outlineButton, { borderColor: colors.primary }]}><MaterialCommunityIcons name="bell-outline" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 13 }}>发送通知</Text></Pressable></View></View>
      <View style={styles.registrationToolbar}>
        <TextInput value={registrationSearch} onChangeText={setRegistrationSearch} placeholder="搜索姓名、邮箱、电话或报名答案" placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {[['registered_asc', '报名顺序'], ['registered_desc', '报名倒序'], ['name_asc', '姓名正序'], ['name_desc', '姓名倒序'], ['status', '按状态']].map(([value, label]) => <Pressable key={value} onPress={() => setRegistrationSort(value as typeof registrationSort)} style={[styles.sortChoice, { borderColor: registrationSort === value ? colors.primary : colors.border, backgroundColor: registrationSort === value ? colors.primary + '12' : colors.surface }]}><Text style={{ color: registrationSort === value ? colors.primary : colors.textSecondary, fontSize: 12 }}>{label}</Text></Pressable>)}
        </ScrollView>
      </View>
      {registrationRows.length === 0 ? <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 18 }]}>{registrationSearch ? '没有匹配的报名记录。' : '暂无报名记录。'}</Text> : registrationRows.map(renderRegistrationCard)}
    </>
  ) : null;

  return <><SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
    {editing ? <View style={[styles.fixedEditorHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Pressable onPress={cancelEditing} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable>
      <Text style={[styles.fixedEditorTitle, { color: colors.textPrimary }]}>{event ? '编辑活动' : '新建活动'}</Text>
      <Pressable accessibilityLabel="预览活动" onPress={() => setPreviewing(true)} style={styles.previewHeaderButton}><MaterialCommunityIcons name="eye-outline" size={23} color={colors.primary} /></Pressable>
    </View> : null}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{editing ? editor : event ? selectedEventPanel : <><View style={styles.headerRow}><Pressable onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable><Text style={[styles.title, { color: colors.textPrimary }]}>活动发布与管理</Text><Pressable onPress={startCreate} style={styles.addTextButton}><MaterialCommunityIcons name="plus" size={18} color={colors.primary} /><Text style={{ color: colors.primary }}>新建</Text></Pressable></View>{loading ? <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} /> : events.length === 0 ? <View style={styles.empty}><MaterialCommunityIcons name="calendar-plus" size={44} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>还没有活动</Text><Pressable onPress={startCreate} style={[styles.saveButton, { backgroundColor: colors.primary, marginTop: 14 }]}><Text style={styles.saveButtonText}>创建第一个活动</Text></Pressable></View> : events.map((item) => <Pressable key={item.id} onPress={() => openEvent(item.id)} style={[styles.eventListRow, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[styles.eventListTitle, { color: colors.textPrimary }]}>{item.title}</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>{localDateInput(item.start_time)} · {statusOptions.find((option) => option.value === item.registration_status)?.label || item.registration_status} · {item.allow_proxy_registration ? '允许代报名' : '仅本人报名'}</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} /></Pressable>)}</>}</ScrollView>
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
