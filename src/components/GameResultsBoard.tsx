import { useAuth } from '@/context/AuthContext';
import { useGame, useLeaderboard } from '@/hooks/data';
import { Avatar } from '@/components/Avatar';

const MEDAL: Record<number, { color: string; ring: string; bg: string; label: string }> = {
  1: { color: '#E7C92F', ring: 'rgba(231,201,47,.5)', bg: 'rgba(231,201,47,.16)', label: '🥇' },
  2: { color: '#C8D2DE', ring: 'rgba(200,210,222,.45)', bg: 'rgba(200,210,222,.14)', label: '🥈' },
  3: { color: '#CD7F32', ring: 'rgba(205,127,50,.5)', bg: 'rgba(205,127,50,.16)', label: '🥉' },
};

/** Final standings board for one game — top 3 in Gold/Silver/Bronze. Used inline and in the modal. */
export function GameResultsBoard({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const { game } = useGame(gameId);
  const leaderboard = useLeaderboard(game, user);

  if (!game) return <p className="text-muted">Loading…</p>;
  if (leaderboard.length === 0) {
    return <p className="text-muted" style={{ fontSize: 13.5 }}>No scores to show for this challenge.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {leaderboard.map((e) => {
        const medal = MEDAL[e.rank];
        const isMe = e.uid === user?.uid;
        return (
          <div
            key={e.uid}
            className="flex items-center gap-3"
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: medal
                ? `linear-gradient(90deg, ${medal.bg}, transparent)`
                : isMe
                  ? 'rgba(231,201,47,.06)'
                  : 'rgba(255,255,255,.03)',
              border: `1px solid ${medal ? medal.ring : 'rgba(255,255,255,.06)'}`,
            }}
          >
            <span style={{ width: 26, textAlign: 'center', fontSize: medal ? 18 : 14, fontFamily: 'var(--font-display)', color: medal?.color ?? '#6B7A99' }}>
              {medal ? medal.label : e.rank}
            </span>
            <Avatar initials={e.initials} photoURL={e.photoURL} highlight={Boolean(medal) || isMe} />
            <span className="flex-1 font-extrabold" style={{ fontSize: 14, color: medal?.color ?? '#F5F5F5' }}>
              {e.displayName}
              {isMe && <span style={{ color: '#E7C92F', fontSize: 11, fontWeight: 800 }}> · you</span>}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#C0392B', width: 28, textAlign: 'right' }} title="Drops">
              {e.dropCount}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: medal?.color ?? '#C8D4E8', width: 30, textAlign: 'right' }} title="Pops">
              {e.popCount}
            </span>
          </div>
        );
      })}
      <div className="flex items-center justify-end gap-4 text-muted" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', marginTop: 2 }}>
        <span style={{ color: '#C0392B' }}>DROPS</span>
        <span style={{ color: '#C8D4E8' }}>POPS</span>
      </div>
    </div>
  );
}
