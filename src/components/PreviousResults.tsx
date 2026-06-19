import { useMemo, useState } from 'react';
import type { JoinedGame } from '@/lib/store';
import { SectionLabel } from '@/components/primitives';
import { formatEventDate } from '@/lib/format';
import { GameResultsModal } from '@/components/GameResultsModal';

function ordinal(n: number): string {
  if (n <= 0) return '—';
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

const inputStyle = {
  background: 'rgba(0,0,0,.3)',
  border: '1.5px solid rgba(255,255,255,.12)',
  borderRadius: 9,
  padding: '9px 11px',
  color: '#F5F5F5',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
} as const;

/** Closed challenges the user played in — filterable by promotion + name, newest first. */
export function PreviousResults({ items }: { items: JoinedGame[] }) {
  const [promo, setPromo] = useState('all');
  const [q, setQ] = useState('');
  const [openGameId, setOpenGameId] = useState<string | null>(null);

  const promotions = useMemo(
    () => [...new Set(items.map((i) => i.game.promotion).filter(Boolean))].sort(),
    [items],
  );

  const filtered = useMemo(
    () =>
      items
        .filter((i) => promo === 'all' || i.game.promotion === promo)
        .filter((i) => i.game.name.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => b.game.eventDate.localeCompare(a.game.eventDate)),
    [items, promo, q],
  );

  if (items.length === 0) return null;

  return (
    <section style={{ marginTop: 36 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 14 }}>
        <SectionLabel>Previous results</SectionLabel>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search challenges…"
            style={{ ...inputStyle, width: 180 }}
          />
          {promotions.length > 1 && (
            <select value={promo} onChange={(e) => setPromo(e.target.value)} className="cursor-pointer" style={inputStyle}>
              <option value="all">All promotions</option>
              {promotions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 13 }}>No results match your filters.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(({ game, myResult }) => {
            const won = myResult.rank === 1;
            return (
              <button
                key={game.id}
                onClick={() => setOpenGameId(game.id)}
                className="cursor-pointer flex items-center justify-between gap-4 flex-wrap text-left w-full"
                style={{
                  background: '#0A1228',
                  border: `1px solid ${won ? 'rgba(231,201,47,.3)' : 'rgba(255,255,255,.07)'}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  color: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                <div className="flex items-center gap-3.5 flex-wrap">
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: '#77E0E8', minWidth: 44 }}>
                    {game.promotion.toUpperCase()}
                  </span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1, textTransform: 'uppercase' }}>
                      {game.name}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {formatEventDate(game.eventDate)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ fontWeight: 800, fontSize: 13, color: won ? '#E7C92F' : '#C8D4E8' }}>
                    {won ? '🏆 Won' : `Finished ${ordinal(myResult.rank)}`}
                  </div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {myResult.popCount} Pops
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openGameId && <GameResultsModal gameId={openGameId} onClose={() => setOpenGameId(null)} />}
    </section>
  );
}
