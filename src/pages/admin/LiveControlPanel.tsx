import { useMemo, useState } from 'react';
import type { Game } from '@/types';
import { Card, LiveBanner } from '@/components/primitives';
import { PickButton } from '@/components/PickButton';
import { Toast } from '@/components/Toast';
import { CheckIcon } from '@/components/icons';

interface Props {
  game: Game;
}

/** ADMIN · LIVE CONTROL — mark each winner, enter tiebreaker, close game (design admin-live). */
export function LiveControlPanel({ game }: Props) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [tiebreaker, setTiebreaker] = useState('');
  const [toastOpen, setToastOpen] = useState(false);

  // Live Control grades match winners (prop bets graded on the same model server-side).
  const markable = useMemo(() => game.matches, [game.matches]);
  const called = Object.keys(results).filter((id) => markable.some((m) => m.id === id)).length;

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <LiveBanner
          title="Show is live — picks are locked"
          subtitle="Tap the winner of each match. Every player's board updates within 3 seconds."
          right={
            <div className="text-right">
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: '#6B7A99' }}>CALLED</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>
                {called}/{markable.length}
              </div>
            </div>
          }
        />
      </div>

      <div className="flex flex-col gap-3" style={{ marginBottom: 24 }}>
        {markable.map((m) => (
          <Card key={m.id} style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: '#6B7A99', marginBottom: 12 }}>{m.name}</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: m.options.length > 2 ? '1fr 1fr' : '1fr 1fr',
                gap: 10,
              }}
            >
              {m.options.map((opt) => (
                <PickButton
                  key={opt}
                  showCheck
                  selected={results[m.id] === opt}
                  onClick={() => setResults((r) => ({ ...r, [m.id]: opt }))}
                >
                  {opt}
                </PickButton>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* tiebreaker answer */}
      <div
        className="flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: 'linear-gradient(180deg,rgba(231,201,47,.08),rgba(231,201,47,.02))',
          border: '1px solid rgba(231,201,47,.28)',
          borderRadius: 14,
          padding: '16px 18px',
          marginBottom: 22,
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 11, letterSpacing: '.12em', color: '#E7C92F', marginBottom: 3 }}>TIEBREAKER ANSWER</div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#C8D4E8' }}>Actual {game.tiebreakerQuestion.toLowerCase()}</div>
        </div>
        <input
          type="number"
          placeholder="00"
          value={tiebreaker}
          onChange={(e) => setTiebreaker(e.target.value)}
          style={{
            width: 96,
            textAlign: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: '#fff',
            background: 'rgba(0,0,0,.3)',
            border: '1.5px solid rgba(255,255,255,.14)',
            borderRadius: 10,
            padding: '8px 10px',
            outline: 'none',
          }}
        />
      </div>

      <button
        onClick={() => setToastOpen(true)}
        className="cursor-pointer font-black"
        style={{
          width: '100%',
          fontFamily: 'inherit',
          border: 'none',
          background: '#C0392B',
          color: '#fff',
          fontSize: 16,
          padding: 18,
          borderRadius: 13,
          boxShadow: '0 10px 30px rgba(192,57,43,.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <CheckIcon size={18} strokeWidth={2.4} style={{ color: '#fff' }} />
        Close game &amp; send results email
      </button>
      <p className="text-center text-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
        This locks the final leaderboard and emails every player within 5 minutes.
      </p>

      <Toast
        open={toastOpen}
        title="Final Pops sent!"
        message="The final Pop Rankings are locked. Final Pops emails are on the way to all 14 players."
        onClose={() => setToastOpen(false)}
      />
    </section>
  );
}
