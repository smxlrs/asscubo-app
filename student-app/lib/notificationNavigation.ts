type NotificationResponse = {
  actionIdentifier?: string;
  notification?: { request?: { identifier?: string; content?: { title?: string; data?: Record<string, unknown> } } };
};

export function notificationDestination(response: NotificationResponse) {
  const content = response.notification?.request?.content;
  const data = content?.data || {};
  const id = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) ? value : null;
  if (id(data.notificationId)) return `/article/${data.notificationId}`;
  if (id(data.eventId)) return { pathname: '/tools/events', params: { eventId: data.eventId as string, detail: '1' } };
  if (id(data.articleId)) return `/article/${data.articleId}`;
  if (typeof data.link === 'string' && /^https?:\/\//i.test(data.link)) {
    return `/article/web?url=${encodeURIComponent(data.link)}&title=${encodeURIComponent(content?.title || '')}`;
  }
  return '/(tabs)';
}

// Listener and cold-start recovery share a queue. Do not navigate before Router
// mounts or process the same response twice when both APIs deliver it.
export function createNotificationResponseQueue(
  navigate: (destination: ReturnType<typeof notificationDestination>) => void,
  clear: () => Promise<void>, defaultAction: string,
) {
  let ready = false;
  let pending: NotificationResponse | null = null;
  const handled = new Set<string>();
  const flush = () => {
    if (!ready || !pending) return;
    const response = pending;
    const key = `${response.notification?.request?.identifier}:${response.actionIdentifier}`;
    if (handled.has(key)) { pending = null; return; }
    navigate(notificationDestination(response));
    pending = null; handled.add(key);
    if (handled.size > 64) handled.delete(handled.values().next().value!);
    void clear().catch(error => console.warn('Could not clear notification response:', error));
  };
  return {
    receive(response: NotificationResponse | null) {
      if (!response?.notification?.request?.identifier || response.actionIdentifier !== defaultAction) return;
      pending = response; flush();
    },
    setReady(value: boolean) { ready = value; flush(); },
  };
}
