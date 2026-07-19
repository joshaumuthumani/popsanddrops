import { useState } from 'react';
import type { Game, Submission } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useSubmissions, useResults } from '@/hooks/data';
import { tally } from '@/lib/scoring';
import { questionsByDay } from '@/lib/nights';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { NightHeading } from '@/components/primitives';
import { PopDropPill, type GradeState } from '@/components/PopDropPill';
import { initialsFromName } from '@/lib/format';

function grade(pick: string | undefined, correct: string | undefined): GradeState {
  if (correct === undefined || correct === '') return 'pending';
  return pick === correct ? 'pop' : 'drop';
}

/** ADMIN · PLAYERS — roster of submissions; click a player to view their picks read-only (PRD §4.2). */
export function PlayersPanel({ game }: { game: Game }) {
  const { user } = useAuth();
  const { submissions, canRead } = useSubmissions(game, user);
  const results = useResults(game.id);
  const [selected, setSelected] = useState<Submission | null>(null);

  if (!canRead) {
    return <p className="text-muted">Submissions become viewable once the game locks.</p>;
  }
  if (submissions.length === 0) {
    return <p className="text-muted">No players have submitted picks yet.</p>;
  }

  const ordered = [...submissions].sort((a, b) => {
    const ta = tally(game, a.matchPicks, a.propBetPicks, results).popCount;
    const tb = tally(game, b.matchPicks, b.propBetPicks, results).popCount;
    return tb - ta;
  });

  // Grouped by night so a two-night card's pick list stays readable. Single-night games
  // return one unlabelled group, matching the previous flat rendering exactly.
  const nights = questionsByDay(game).map((n) => ({
    ...n,
    questions: [
      ...n.matches.map((m) => ({ id: m.id, name: m.name })),
      ...n.propBets.map((p) => ({ id: p.id, name: p.question })),
    ],
  }));
  const pickOf = (s: Submission, id: string) => s.matchPicks[id] ?? s.propBetPicks[id];

  return (
    <section>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
        {submissions.length} {submissions.length === 1 ? 'player has' : 'players have'} submitted. Tap a name to see their picks.
      </p>
      <div className="flex items-center gap-3" style={{ padding: '0 15px 9px' }}>
        <span style={{ width: 32 }} />
        <span className="flex-1" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: '#6B7A99' }}>PLAYER</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: '#C0392B', width: 28, textAlign: 'right' }}>DROPS</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: '#C8D4E8', width: 28, textAlign: 'right' }}>POPS</span>
        <span style={{ width: 16 }} />
      </div>
      <div style={{ background: '#0A1228', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
        {ordered.map((s, i) => {
          const t = tally(game, s.matchPicks, s.propBetPicks, results);
          const name = s.displayName ?? 'Player';
          return (
            <button
              key={s.uid}
              onClick={() => setSelected(s)}
              className="cursor-pointer flex items-center gap-3 w-full text-left"
              style={{
                padding: '13px 15px',
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.05)',
                background: 'transparent',
                border: 'none',
                fontFamily: 'inherit',
                color: 'inherit',
              }}
            >
              <Avatar initials={initialsFromName(name)} photoURL={s.photoURL ?? null} size={32} />
              <span className="flex-1 font-extrabold" style={{ fontSize: 14 }}>{name}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#C0392B', width: 28, textAlign: 'right' }} title="Drops">
                {t.dropCount}
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#C8D4E8', width: 28, textAlign: 'right' }} title="Pops">
                {t.popCount}
              </span>
              <span className="text-muted" style={{ fontSize: 16 }}>›</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)} title={`${selected.displayName ?? 'Player'} · picks`}>
          <div className="flex flex-col gap-2.5">
            {nights.map((night) => (
              <div key={night.day} className="flex flex-col gap-2.5">
                {night.label && <NightHeading label={night.label} style={{ margin: '6px 0 2px' }} />}
                {night.questions.map((q) => {
                  const pick = pickOf(selected, q.id);
                  const state = grade(pick, results[q.id]);
                  const popped = state === 'pop';
                  return (
                    <div
                      key={q.id}
                      className="flex items-center justify-between gap-3"
                      style={{
                        background: popped ? 'rgba(231,201,47,.1)' : 'rgba(255,255,255,.03)',
                        border: `1px solid ${popped ? 'rgba(231,201,47,.3)' : 'rgba(255,255,255,.06)'}`,
                        borderRadius: 12,
                        padding: '12px 14px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#6B7A99' }}>{q.name}</div>
                        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{pick ?? '—'}</div>
                      </div>
                      <PopDropPill state={state} />
                    </div>
                  );
                })}
              </div>
            ))}
            <div
              className="flex items-center justify-between gap-3"
              style={{ background: 'rgba(231,201,47,.06)', border: '1px solid rgba(231,201,47,.22)', borderRadius: 12, padding: '12px 14px' }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#E7C92F' }}>TIEBREAKER</div>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>{selected.tiebreakerAnswer || '—'}</div>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
