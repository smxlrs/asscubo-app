import { useCallback, useEffect, useState } from 'react';

export function useOtpCooldown(seconds = 60) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const startCooldown = useCallback(() => setRemaining(seconds), [seconds]);
  const resetCooldown = useCallback(() => setRemaining(0), []);

  return { remaining, startCooldown, resetCooldown };
}
