import type { GameStatus } from '@/types';

const STYLES: Record<GameStatus, { bg: string; color: string; dot: string }> = {
  DRAFT: { bg: 'rgba(107,122,153,.16)', color: '#6B7A99', dot: '#6B7A99' },
  OPEN: { bg: 'rgba(231,201,47,.14)', color: '#E7C92F', dot: '#E7C92F' },
  LOCKED: { bg: 'rgba(119,224,232,.12)', color: '#77E0E8', dot: '#77E0E8' },
  CLOSING: { bg: 'rgba(192,57,43,.14)', color: '#F39AAB', dot: '#C0392B' },
  CLOSED: { bg: 'rgba(192,57,43,.16)', color: '#F39AAB', dot: '#C0392B' },
};

export function StatusBadge({ status }: { status: GameStatus }) {
  const s = STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '.08em',
        padding: '4px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, boxShadow: `0 0 8px ${s.dot}` }} />
      {status}
    </span>
  );
}
