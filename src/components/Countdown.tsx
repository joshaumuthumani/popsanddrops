import { useCountdown } from '@/hooks/useCountdown';

interface CountdownProps {
  /** Absolute lock time in epoch millis. */
  targetMs: number;
  /** Visual scale. */
  size?: 'sm' | 'lg';
  /** Color of the ":" separators. */
  sepColor?: string;
}

/** h:m:s countdown rendered in Bebas Neue, driven by the Firestore lockTime. */
export function Countdown({ targetMs, size = 'sm', sepColor = '#6B7A99' }: CountdownProps) {
  const { h, m, s } = useCountdown(targetMs);
  const fontSize = size === 'lg' ? 'clamp(40px,6vw,60px)' : '24px';
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize, letterSpacing: '.05em' }}>
      <span>{h}</span>
      <span style={{ color: sepColor }}>:</span>
      <span>{m}</span>
      <span style={{ color: sepColor }}>:</span>
      <span>{s}</span>
    </span>
  );
}
