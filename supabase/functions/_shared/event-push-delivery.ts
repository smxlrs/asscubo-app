export type EventPushOutcome = {
  token: string;
  status: 'sent' | 'failed' | 'pending';
  ticket_id?: string;
  error?: string;
};

export async function sendEventPushBatch(
  tokens: string[],
  title: string,
  eventId: string,
  request: typeof fetch = fetch,
): Promise<EventPushOutcome[]> {
  if (tokens.length > 100) throw new Error('An Expo push batch cannot exceed 100 recipients.');
  const valid = tokens.filter((token) => /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token));
  const outcomes = new Map<string, EventPushOutcome>();
  tokens.filter((token) => !valid.includes(token)).forEach((token) => {
    outcomes.set(token, { token, status: 'failed', error: 'Invalid Expo push token.' });
  });
  if (!valid.length) return tokens.map((token) => outcomes.get(token)!);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await request('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(valid.map((token) => ({
        to: token,
        sound: 'default',
        title: `【活动通知】${title}`,
        body: `${title}已开始报名！`,
        data: { category: 'events', eventId },
      }))),
      signal: controller.signal,
    });
    const body = await response.json();
    if (!response.ok || body?.errors?.length) {
      const retry = response.status === 429 || response.status >= 500 || response.ok;
      valid.forEach((token) => outcomes.set(token, {
        token, status: retry ? 'pending' : 'failed', error: `Expo Push HTTP ${response.status}.`,
      }));
    } else {
      const tickets = Array.isArray(body?.data) ? body.data : [];
      valid.forEach((token, index) => {
        const ticket = tickets[index];
        if (ticket?.status === 'ok' && typeof ticket.id === 'string') {
          outcomes.set(token, { token, status: 'sent', ticket_id: ticket.id });
        } else {
          const code = String(ticket?.details?.error || 'Missing or invalid Expo ticket.');
          const permanent = ['DeviceNotRegistered', 'MessageTooBig', 'InvalidCredentials', 'MismatchSenderId'].includes(code);
          outcomes.set(token, { token, status: permanent ? 'failed' : 'pending', error: code });
        }
      });
    }
  } catch {
    // Expo has no idempotency key. A lost response can mean accepted-but-unknown;
    // retries are bounded, and every known accepted ticket is persisted first.
    valid.forEach((token) => outcomes.set(token, { token, status: 'pending', error: 'Push request failed or timed out; result unknown.' }));
  } finally {
    clearTimeout(timeout);
  }
  return tokens.map((token) => outcomes.get(token)!);
}
