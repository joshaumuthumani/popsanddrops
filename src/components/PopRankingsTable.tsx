import type { LeaderboardEntry } from '@/types';
import { Avatar } from '@/components/Avatar';

interface Props {
  entries: LeaderboardEntry[];
  /** uid to highlight as "you". */
  meUid?: string;
  /** Show the Drops column (post-lock) — PRD §5.5. */
  showDrops?: boolean;
  /** Show the Tiebreaker column (post-close only) — PRD §5.5. */
  showTiebreaker?: boolean;
}

/** Live Pop Rankings list. Ties share a rank; #1 gets the gold avatar. */
export function PopRankingsTable({ entries, meUid, showDrops = false, showTiebreaker = false }: Props) {
  return (
    <div style={{ background: '#0A1228', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
      {entries.map((e, i) => {
        const isMe = e.uid === meUid;
        const isTop = e.rank === 1;
        const rowBg = isMe
          ? 'rgba(231,201,47,.06)'
          : isTop
            ? 'linear-gradient(90deg,rgba(231,201,47,.12),transparent)'
            : 'transparent';
        return (
          <div
            key={e.uid}
            className="flex items-center gap-3 animate-rise"
            style={{
              padding: '13px 15px',
              borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.05)',
              background: rowBg,
              animationDelay: `${i * 40}ms`,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: isTop ? 18 : 16,
                color: isTop || isMe ? '#E7C92F' : '#6B7A99',
                width: 22,
              }}
            >
              {e.rank}
            </span>
            <Avatar initials={e.initials} photoURL={e.photoURL} highlight={isTop || isMe} />
            <span className="flex-1 font-extrabold" style={{ fontSize: 14 }}>
              {e.displayName}
              {isMe && <span style={{ color: '#E7C92F', fontSize: 11, fontWeight: 800 }}> · you</span>}
            </span>
            {showTiebreaker && (
              <span className="text-muted" style={{ fontSize: 12, width: 40, textAlign: 'right' }} title="Tiebreaker answer">
                {e.tiebreakerAnswer || '—'}
              </span>
            )}
            {showDrops && (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#C0392B', width: 28, textAlign: 'right' }}>
                {e.dropCount}
              </span>
            )}
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                color: isTop || isMe ? '#E7C92F' : '#C8D4E8',
                width: 28,
                textAlign: 'right',
              }}
            >
              {e.popCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
