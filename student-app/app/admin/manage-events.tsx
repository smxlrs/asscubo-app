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
  const [registrationDateField, setRegistrationDateField] = useState<string | null>(null);

  const currentDraftSignature = useMemo(() => JSON.stringify({
    title, description, location, startTime, endTime, hasEndDate, startHasTime, endHasTime,
    registrationStart, deadline, registrationStartEnabled, deadlineEnabled, maxParticipants, published, status, allowProxy, allowWaitlist,
    vehicleMode, fields, vehicles,
  }), [title, description, location, startTime, endTime, hasEndDate, startHasTime, endHasTime,
    registrationStart, deadline, registrationStartEnabled, deadlineEnabled, maxParticipants, published, status, allowProxy, allowWaitlist,
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
      { text: '放弃退出', style: 'destructive', onPress: () => { setPreviewing(false); setEditing(false); } },
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

      Alert.alert('保存成功', '活动设置已保存。', [{ text: '好的', onPress: () => openEvent(savedEvent.id) }]);
      await loadEvents();
    } catch (error: any) {
      Alert.alert('保存失败', error?.message || '活动设置保存失败，请检查权限和网络。');
    } finally {
      setSaving(false);
    }
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

  const cancelRegistration = (registrationId: string) => {
    const runCancel = (notify: boolean) => {
      setBusyRegistration(registrationId);
      void (async () => {
        try {
          const { error } = await supabase.rpc('admin_cancel_event_registration', { p_registration_id: registrationId, p_notify: notify });
          if (error) throw error;
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

  const openRegistrationEditor = (registration: RegistrationRow) => {
    const attendee = registration.attendees?.[0];
    setRegistrationEditor({
      registration,
      name: attendee?.name || '',
      phone: attendee?.phone || '',
      email: attendee?.email || '',
      answers: { ...(attendee?.answers || registration.answers || {}) },
    });
  };

  const saveRegistrationEdit = (notify: boolean) => {
    if (!registrationEditor) return;
    const { registration, name, phone, email, answers } = registrationEditor;
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
              .update({ deleted_at: new Date().toISOString(), is_published: false, registration_status: 'archived' })
              .eq('id', event.id);
            if (error) throw error;
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

  const exportCsv = async (rosterOnly: boolean) => {
    if (!event || registrations.length === 0) {
      Alert.alert('暂无报名', '当前活动还没有可导出的报名记录。');
      return;
    }
    try {
      const formFields = (event.registration_form || []) as EventFormField[];
      const rows: string[][] = [];
      if (rosterOnly) {
        rows.push(['姓名', '车辆']);
        registrations.filter((row) => row.status !== 'cancelled').forEach((row) => {
          const names = row.attendees?.map((item) => item.name).filter(Boolean) || [];
          const vehicle = row.vehicle_id ? (vehicleLookup[row.vehicle_id] || '待确认') : '待分配';
          if (names.length === 0) rows.push([`报名编号 ${row.registration_number || row.id.slice(0, 8)}`, vehicle]);
          names.forEach((name) => rows.push([name, vehicle]));
        });
      } else {
        rows.push(['报名编号', '报名时间', '状态', '报名类型', '代报名备注', '车辆', '报名人数', ...formFields.map((field) => field.label)]);
        registrations.forEach((row) => rows.push([
          row.registration_number || row.id.slice(0, 8),
          formatDate(row.registered_at),
          row.status,
          row.registration_kind === 'proxy' ? '代他人报名' : '本人报名',
          row.proxy_note || '',
          row.vehicle_id ? (vehicleLookup[row.vehicle_id] || '') : '',
          String(row.participant_count),
          ...formFields.map((field) => {
            const value = row.answers?.[field.key];
            return Array.isArray(value) ? value.join('、') : typeof value === 'object' && value ? value.name || value.path || '' : value ?? '';
          }),
        ]));
      }
      const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
      const safeTitle = event.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 50);
      const fileName = `${safeTitle}-${rosterOnly ? '分车名单' : '报名详情'}-${Date.now()}.csv`;
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
      await Sharing.shareAsync(fileUri, { dialogTitle: rosterOnly ? '导出分车名单' : '导出报名详情', mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
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
        <View style={styles.registrationTimePanel}><View style={styles.registrationSwitchRow}><View style={{ flex: 1 }}><Text style={[styles.switchLabel, { color: colors.textPrimary }]}>设置开放报名时间</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>关闭表示保存后立即开放报名</Text></View><Switch value={registrationStartEnabled} onValueChange={setRegistrationStartEnabled} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={registrationStartEnabled ? colors.primary : colors.textMuted} /></View>{registrationStartEnabled ? <><View style={styles.twoColumns}><Pressable onPress={() => openPicker('registrationStartDate')} style={[styles.dateButton, styles.columnInput, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{registrationStart ? dateLabel(registrationStart) : '选择日期'}</Text></Pressable><Pressable onPress={() => openPicker('registrationStartTime')} style={[styles.dateButton, styles.columnInput, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} /><Text style={{ color: colors.textPrimary }}>{registrationStart ? timeLabel(registrationStart) : '选择时间'}</Text></Pressable></View></> : null}</View>
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
            ['姓名', 'name', registrationEditor.name],
            ['电话', 'phone', registrationEditor.phone],
            ['邮箱', 'email', registrationEditor.email],
          ].map(([label, key, value]) => <View key={key as string} style={styles.registrationEditField}>
            <Text style={[styles.dateButtonLabel, { color: colors.textSecondary }]}>{label}</Text>
            <TextInput value={value as string} onChangeText={(next) => setRegistrationEditor((current) => current ? { ...current, [key as 'name' | 'phone' | 'email']: next } : current)} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]} />
          </View>)}
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
        </ScrollView>
      </SafeAreaView>
    </Modal>
  ) : null;

  const selectedEventPanel = event && !editing ? (
    <>
      <View style={styles.headerRow}><Pressable onPress={() => { setEvent(null); setSelectedId(null); }} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={23} color={colors.textPrimary} /></Pressable><View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{event.title}</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>报名管理</Text></View><Pressable onPress={() => setEditing(true)} style={styles.addTextButton}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} /><Text style={{ color: colors.primary }}>编辑</Text></Pressable><Pressable onPress={deleteEvent} style={styles.deleteIconButton} disabled={saving}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} /></Pressable></View>
      <View style={[styles.summaryPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.summaryText, { color: colors.textPrimary }]}>当前报名：{registrations.filter((row) => row.status === 'confirmed').length} 条确认，{registrations.filter((row) => row.status === 'waitlist').length} 条候补</Text><View style={styles.exportRow}><Pressable onPress={() => exportCsv(true)} style={[styles.outlineButton, { borderColor: colors.primary }]}><MaterialCommunityIcons name="bus" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 13 }}>分车名单</Text></Pressable><Pressable onPress={() => exportCsv(false)} style={[styles.outlineButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="download-outline" size={17} color={colors.textPrimary} /><Text style={{ color: colors.textPrimary, fontSize: 13 }}>报名详情</Text></Pressable></View></View>
      {registrations.length === 0 ? <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 18 }]}>暂无报名记录。</Text> : registrations.map((registration) => <View key={registration.id} style={[styles.registrationPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.registrationHeader}><View style={{ flex: 1 }}><Text style={[styles.registrationTitle, { color: colors.textPrimary }]}>{registration.attendees?.map((item) => item.name).join('、') || registration.registration_number || registration.id.slice(0, 8)}</Text><Text style={[styles.hint, { color: colors.textSecondary }]}>{registration.registration_kind === 'proxy' ? `代报名：${registration.proxy_note || '未填写备注'}` : '本人报名'} · {registration.participant_count} 人</Text></View><Text style={{ color: registration.status === 'waitlist' ? '#B7791F' : registration.status === 'cancelled' ? colors.textMuted : colors.success, fontSize: 13, fontWeight: '700' }}>{registration.status === 'waitlist' ? '候补' : registration.status === 'cancelled' ? '已取消' : '已确认'}</Text></View><Text style={[styles.hint, { color: colors.textSecondary }]}>提交时间：{formatDate(registration.registered_at)}</Text>{event.vehicle_selection_mode !== 'none' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, marginTop: 9 }}>{[{ id: null, name: '待分配' }, ...Object.entries(vehicleLookup).map(([id, name]) => ({ id, name }))].map((vehicle) => <Pressable key={vehicle.id || 'none'} onPress={() => assignVehicle(registration.id, vehicle.id)} disabled={busyRegistration === registration.id} style={[styles.smallChoice, { borderColor: registration.vehicle_id === vehicle.id ? colors.primary : colors.border, backgroundColor: registration.vehicle_id === vehicle.id ? colors.primary + '12' : colors.surface }]}><Text style={{ color: registration.vehicle_id === vehicle.id ? colors.primary : colors.textSecondary, fontSize: 12 }}>{vehicle.name}</Text></Pressable>)}</ScrollView> : null}<View style={styles.registrationActions}><Pressable onPress={() => openRegistrationEditor(registration)} disabled={busyRegistration === registration.id}><Text style={{ color: colors.primary, fontSize: 13 }}>修改信息</Text></Pressable><Pressable onPress={() => cancelRegistration(registration.id)} disabled={busyRegistration === registration.id}><Text style={{ color: colors.error, fontSize: 13 }}>取消报名</Text></Pressable><Text style={[styles.hint, { color: colors.textMuted }]}>{registration.registration_number || registration.id.slice(0, 8)}</Text></View></View>)}
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
  </SafeAreaView>{registrationEditorModal}</>;
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
  textareaInput: { minHeight: 100, paddingTop: 11, textAlignVertical: 'top' },
  adminAnswerOptions: { gap: 7 },
  adminAnswerOption: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  backButton: { width: 34, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', flex: 1 },
  panel: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  summaryPanel: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  summaryText: { fontSize: 14, fontWeight: '600' },
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
  outlineButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  registrationPanel: { borderWidth: 1, borderRadius: 11, padding: 13, marginBottom: 9 },
  registrationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  registrationTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  registrationActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
});
