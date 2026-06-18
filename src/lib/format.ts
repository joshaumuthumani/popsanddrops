// Small presentation helpers shared across screens.

/** "Jordan D." -> "JD"; falls back to first two letters. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface Clock {
  h: string;
  m: string;
  s: string;
  done: boolean;
  totalMs: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Breaks a remaining-time window into padded h/m/s for the countdown. */
export function clockFromMs(remainingMs: number): Clock {
  const clamped = Math.max(0, remainingMs);
  const totalSec = Math.floor(clamped / 1000);
  return {
    h: pad(Math.floor(totalSec / 3600)),
    m: pad(Math.floor((totalSec % 3600) / 60)),
    s: pad(totalSec % 60),
    done: clamped <= 0,
    totalMs: clamped,
  };
}

export function formatEventDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
