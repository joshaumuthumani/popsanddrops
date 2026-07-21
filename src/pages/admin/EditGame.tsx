import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, Eyebrow, PageTitle } from '@/components/primitives';
import { GameForm } from '@/pages/admin/GameForm';
import { draftFromGame } from '@/pages/admin/gameFormState';
import { subscribeSubmissions, updateGame, type NewGameInput } from '@/lib/store';
import { gameQuestions, orphanImpact, type OrphanImpact } from '@/lib/pickIntegrity';
import { useGame } from '@/hooks/data';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { Submission } from '@/types';

/** Super-Admin edit of a live game. Route is gated superAdminOnly; rules enforce it too. */
export function EditGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { game, loading } = useGame(gameId);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [subsLoaded, setSubsLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  // A pending orphan confirmation: holds the impact to show and the resolver that lets the
  // form's submit continue (Save anyway) or abort (Cancel).
  const [pending, setPending] = useState<{ impact: OrphanImpact; resolve: (ok: boolean) => void } | null>(null);

  // Guarded on isFirebaseConfigured — subscribeSubmissions calls reqDb(), which throws in
  // demo mode. subsLoaded flips on the first snapshot so the orphan check can distinguish
  // "no picks affected" from "picks not loaded yet" (see beforeSubmit).
  useEffect(() => {
    if (!game || !isFirebaseConfigured) return;
    return subscribeSubmissions(game.id, (next) => {
      setSubs(next);
      setSubsLoaded(true);
    });
  }, [game]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!game) return <p className="text-muted">That game doesn't exist or you don't have access to it.</p>;
  if (game.status === 'CLOSED') return <p className="text-muted">Closed games are final and can't be edited.</p>;

  // Runs before the form commits. If the edit would orphan any existing picks, surface the
  // impact and wait for the admin's decision; a clean edit passes straight through.
  const beforeSubmit = (input: NewGameInput): Promise<boolean> => {
    // Don't let the orphan check fail open: if picks haven't loaded yet, `subs` is still empty
    // and the warning would wrongly report "0 affected". Block with a notice rather than
    // silently saving unverified.
    if (isFirebaseConfigured && !subsLoaded) {
      setNotice("Still loading players' picks — try again in a moment.");
      return Promise.resolve(false);
    }
    setNotice('');
    const impact = orphanImpact(gameQuestions(input), subs);
    if (impact.totalAffected === 0) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setPending({ impact, resolve }));
  };

  return (
    <div>
      <Link to={`/admin/game/${game.id}`} className="no-underline">
        <Eyebrow>← Back to console</Eyebrow>
      </Link>
      <div style={{ marginBottom: 22 }}>
        <PageTitle>Edit {game.name}</PageTitle>
      </div>

      {!isFirebaseConfigured && (
        <p style={{ color: '#6B7A99', fontSize: 13, marginBottom: 16 }}>
          Editing needs a live Firebase connection — changes can't be saved in demo mode.
        </p>
      )}
      {notice && <p style={{ color: 'var(--color-gold)', fontSize: 13, marginBottom: 16 }}>{notice}</p>}

      <GameForm
        initial={draftFromGame(game)}
        submitLabel="Save changes"
        busyLabel="Saving…"
        uid={game.createdBy}
        beforeSubmit={beforeSubmit}
        onCancel={() => navigate(`/admin/game/${game.id}`)}
        onSubmit={async (input) => {
          if (!isFirebaseConfigured) {
            throw new Error('Editing needs a live Firebase connection — unavailable in demo mode.');
          }
          try {
            await updateGame(game.id, input);
          } catch (err) {
            // A game closed by another admin between load and save can never be re-edited —
            // say so plainly instead of the generic "try again".
            if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'permission-denied') {
              throw new Error('This game can no longer be edited — it may have just been closed.');
            }
            throw err;
          }
          navigate(`/admin/game/${game.id}`);
        }}
      />

      {pending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
          <Card style={{ padding: 24, maxWidth: 460, width: '90%' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>This edit changes locked-in picks</h3>
            <p style={{ fontSize: 13.5, color: '#F5F5F5', marginBottom: 10 }}>
              {pending.impact.totalAffected} {pending.impact.totalAffected === 1 ? 'player has' : 'players have'} a pick that
              will no longer count after this change:
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, color: 'var(--color-gold)', fontSize: 13 }}>
              {pending.impact.byOption.map((b) => (
                <li key={`${b.questionId}-${b.option}`}>
                  {b.count} {b.count === 1 ? 'player' : 'players'} picked “{b.option}”
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => { pending.resolve(true); setPending(null); }}
                className="cursor-pointer font-black"
                style={{ flex: 1, border: 'none', borderRadius: 12, padding: 14, background: '#C0392B', color: '#fff' }}
              >
                Save anyway
              </button>
              <button
                onClick={() => { pending.resolve(false); setPending(null); }}
                className="cursor-pointer bg-transparent font-extrabold"
                style={{ border: '1.5px solid rgba(255,255,255,.16)', color: '#F5F5F5', borderRadius: 12, padding: '0 22px' }}
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
