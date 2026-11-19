import { romeMinutes } from './romeTime';

export type BusClock = { timestamp: number; monotonicAt: number };

/** Keep the transport server's clock local to this response; never change the device clock. */
export function createBusClock(serverDate: string | null, monotonicAt = performance.now()): BusClock {
  const timestamp = serverDate ? Date.parse(serverDate) : NaN;
  return { timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(), monotonicAt };
}

export function busMinutesUntil(time: string, reference?: BusClock, monotonicNow = performance.now()): number {
  const clock = reference || createBusClock(null, monotonicNow);
  const [hour, minute] = time.split(':').map(Number);
  let remaining = hour * 60 + minute - romeMinutes(clock.timestamp);
  // Preserve HelloBus's next-day convention, while retaining recently departed services.
  if (remaining < -120) remaining += 24 * 60;
  const elapsed = Math.max(0, monotonicNow - clock.monotonicAt);
  // Advance through real minute boundaries without depending on later phone-clock changes.
  return remaining - (Math.floor((clock.timestamp + elapsed) / 60000) - Math.floor(clock.timestamp / 60000));
}
