import { useEffect, useState } from 'react';
import { clockFromMs, type Clock } from '@/lib/format';

/**
 * Countdown to an absolute epoch-millis target. In production the target is the
 * Firestore lockTime (server timestamp), never the device clock (PRD §5.4, §6).
 */
export function useCountdown(targetMs: number): Clock {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return clockFromMs(targetMs - now);
}
