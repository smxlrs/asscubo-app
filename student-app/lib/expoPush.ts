export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  data?: Record<string, unknown>;
};

export type PushSendResult = {
  success: boolean;
  sentCount: number;
  failedCount: number;
  error?: string;
};

// A successful ticket means Expo accepted the message, not that the phone received it.
export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<PushSendResult> {
  let sentCount = 0;
  let failedCount = 0;
  const errors = new Set<string>();

  for (let offset = 0; offset < messages.length; offset += 100) {
    const chunk = messages.slice(offset, offset + 100);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || result?.errors?.length) {
        failedCount += chunk.length;
        errors.add(`Expo Push 请求失败（HTTP ${response.status}）。`);
        continue;
      }
      const tickets = Array.isArray(result?.data) ? result.data : [];
      chunk.forEach((_, index) => {
        const ticket = tickets[index];
        if (ticket?.status === 'ok' && typeof ticket.id === 'string') {
          sentCount += 1;
        } else {
          failedCount += 1;
          errors.add(ticket?.details?.error === 'DeviceNotRegistered'
            ? '部分设备已无法接收推送。'
            : '部分推送未被 Expo 接受。');
        }
      });
    } catch {
      failedCount += chunk.length;
      errors.add('推送请求中断，部分结果无法确认，请勿立即重复群发。');
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    success: failedCount === 0,
    sentCount,
    failedCount,
    ...(errors.size ? { error: [...errors].join(' ') } : {}),
  };
}
