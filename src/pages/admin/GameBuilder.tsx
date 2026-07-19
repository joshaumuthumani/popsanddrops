import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, PageTitle, SectionLabel, GoldButton } from '@/components/primitives';
import { PosterPicker } from '@/components/PosterPicker';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { createGame } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';

interface DraftQuestion {
  id: string;
  label: string;
  options: string[];
  /** Matches only — a Storage URL for the match poster. Prop bets never carry one. */
  posterUrl?: string;
  /** 1-based night. Only meaningful when the game runs more than one night. */
  day?: number;
}

const newId = () => Math.random().toString(36).slice(2, 8);

const labelStyle = { fontSize: 11, fontWeight: 800 as const, letterSpacing: '.1em', color: '#6B7A99', textTransform: 'uppercase' as const, marginBottom: 8, display: 'block' };
const inputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,.3)',
  border: '1.5px solid rgba(255,255,255,.12)',
  borderRadius: 10,
  padding: '11px 13px',
  color: '#F5F5F5',
  fontFamily: 'inherit',
  fontSize: 14,
  outline: 'none',
} as const;

function QuestionBuilder({
  title,
  optionLabel,
  questions,
  setQuestions,
  withPoster = false,
  uid,
  dayCount = 1,
  onPosterPendingChange,
}: {
  title: string;
  optionLabel: string;
  questions: DraftQuestion[];
  setQuestions: (q: DraftQuestion[]) => void;
  /** Matches get a poster control; prop bets don't (PRD scope). */
  withPoster?: boolean;
  uid?: string;
  /** Night selectors only appear once the event runs more than one night. */
  dayCount?: number;
  /** Reports per-question whether a poster link is unsaved, keyed by question id. */
  onPosterPendingChange?: (questionId: string, pending: boolean) => void;
}) {
  const update = (idx: number, patch: Partial<DraftQuestion>) =>
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel style={{ marginBottom: 14 }}>{title}</SectionLabel>
      <div className="flex flex-col gap-3">
        {questions.map((q, idx) => (
          <Card key={q.id} style={{ padding: 16 }}>
            {withPoster && (
              <PosterPicker
                value={q.posterUrl}
                uid={uid}
                onChange={(posterUrl) => update(idx, { posterUrl })}
                onPendingChange={(pending) => onPosterPendingChange?.(q.id, pending)}
              />
            )}
            <div className="flex items-center gap-2 mb-3">
              <input
                placeholder={`${optionLabel} name`}
                value={q.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                style={inputStyle}
              />
              {dayCount > 1 && (
                <select
                  value={q.day ?? 1}
                  onChange={(e) => update(idx, { day: Number(e.target.value) })}
                  style={{ ...inputStyle, width: 'auto', flex: 'none', cursor: 'pointer' }}
                  title="Which night this runs on"
                >
                  {Array.from({ length: dayCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Night {i + 1}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                className="cursor-pointer bg-transparent"
                style={{ border: '1.5px solid rgba(255,255,255,.12)', color: '#6B7A99', borderRadius: 9, padding: '8px 12px', fontWeight: 800 }}
                title="Remove"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    placeholder={`Option ${oi + 1}`}
                    value={opt}
                    onChange={(e) => update(idx, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
                    style={inputStyle}
                  />
                  {q.options.length > 2 && (
                    <button
                      onClick={() => update(idx, { options: q.options.filter((_, i) => i !== oi) })}
                      className="cursor-pointer bg-transparent text-muted"
                      style={{ border: 'none', fontSize: 18 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => update(idx, { options: [...q.options, ''] })}
                className="cursor-pointer bg-transparent self-start"
                style={{ border: '1.5px dashed rgba(255,255,255,.16)', color: '#6B7A99', borderRadius: 9, padding: '8px 14px', fontWeight: 800, fontSize: 13 }}
              >
                + Add option
              </button>
            </div>
          </Card>
        ))}
        <button
          onClick={() => setQuestions([...questions, { id: newId(), label: '', options: ['', ''] }])}
          className="cursor-pointer bg-transparent font-extrabold"
          style={{ border: '1.5px dashed rgba(231,201,47,.4)', color: '#E7C92F', borderRadius: 11, padding: 14, fontSize: 13.5 }}
        >
          + Add {optionLabel.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

/** Game Builder — create/edit a game for any promotion (PRD §5.2). */
export function GameBuilder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [promotion, setPromotion] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [lockTime, setLockTime] = useState('');
  const [tiebreaker, setTiebreaker] = useState('');
  const [dayCount, setDayCount] = useState(1);
  // Question ids whose poster link is typed but not yet hosted, or still fetching.
  const [pendingPosters, setPendingPosters] = useState<Record<string, boolean>>({});
  const [matches, setMatches] = useState<DraftQuestion[]>([{ id: newId(), label: '', options: ['', ''] }]);
  const [props, setProps] = useState<DraftQuestion[]>([{ id: newId(), label: '', options: ['Yes', 'No'] }]);
  const [toastOpen, setToastOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newGameId, setNewGameId] = useState<string | null>(null);

  /**
   * Changing the night count clamps every question into range. Lowering it moves questions
   * from removed nights down to the new last night rather than dropping them — silently
   * losing a question an admin typed would be far worse than putting it on the wrong night.
   */
  const changeDayCount = (next: number) => {
    const n = Math.max(1, Math.min(6, Math.floor(next) || 1));
    setDayCount(n);
    const clamp = (qs: DraftQuestion[]) => qs.map((q) => ({ ...q, day: Math.min(q.day ?? 1, n) }));
    setMatches(clamp);
    setProps(clamp);
  };

  // DraftQuestion -> domain question, dropping blank options/rows.
  const cleanQuestions = (qs: DraftQuestion[]) =>
    qs
      .map((q) => ({
        id: q.id,
        label: q.label.trim(),
        options: q.options.map((o) => o.trim()).filter(Boolean),
        posterUrl: q.posterUrl,
        day: q.day,
      }))
      .filter((q) => q.label && q.options.length >= 2);

  const publish = async () => {
    setError('');
    const cleanMatches = cleanQuestions(matches);
    const cleanProps = cleanQuestions(props);
    if (!name.trim() || !promotion.trim() || !eventDate || !lockTime || !tiebreaker.trim()) {
      setError('Fill in the game name, promotion, event date, lock time, and tiebreaker.');
      return;
    }
    if (cleanMatches.length === 0) {
      setError('Add at least one match with two or more options.');
      return;
    }
    const lockMs = new Date(lockTime).getTime();
    if (Number.isNaN(lockMs)) {
      setError('That lock time looks invalid.');
      return;
    }
    // A pasted link only becomes a poster once it's been fetched and re-hosted. Publishing
    // with one still in the box used to discard it silently, so the game went live with no
    // posters and no explanation.
    const stillPending = Object.values(pendingPosters).filter(Boolean).length;
    if (stillPending > 0) {
      setError(
        `${stillPending} poster ${stillPending === 1 ? 'link is' : 'links are'} still being added. ` +
          'Wait for the preview to appear, or clear the link box, then publish.',
      );
      return;
    }

    if (!isFirebaseConfigured || !user) {
      // Demo mode — no backend; just show the success toast.
      setToastOpen(true);
      return;
    }
    setBusy(true);
    try {
      const id = await createGame(
        {
          name,
          promotion,
          eventDate,
          lockTime: lockMs,
          dayCount,
          tiebreakerQuestion: tiebreaker,
          // Spread poster/day only when meaningful — Firestore rejects explicit `undefined`,
          // and single-night games shouldn't carry a redundant `day: 1` on every question.
          matches: cleanMatches.map((m) => ({
            id: m.id,
            name: m.label,
            options: m.options,
            ...(m.posterUrl ? { posterUrl: m.posterUrl } : {}),
            ...(dayCount > 1 ? { day: m.day ?? 1 } : {}),
          })),
          propBets: cleanProps.map((p) => ({
            id: p.id,
            question: p.label,
            options: p.options,
            ...(dayCount > 1 ? { day: p.day ?? 1 } : {}),
          })),
        },
        user,
      );
      setNewGameId(id);
      setToastOpen(true);
    } catch {
      setError('Could not publish the game. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <PageTitle>New Challenge</PageTitle>
      </div>

      <Card style={{ padding: 22, marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          <div>
            <label style={labelStyle}>Game name</label>
            <input placeholder="e.g. AEW Double or Nothing 2026" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Promotion</label>
            <input placeholder="AEW, WWE, TNA, NJPW…" value={promotion} onChange={(e) => setPromotion(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Event date</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Picks lock at</label>
            <input type="datetime-local" value={lockTime} onChange={(e) => setLockTime(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Nights</label>
            {/* A dropdown, not a number input: a controlled number field that clamps on every
                keystroke can't be typed into — "1" + "2" becomes "12", clamps, and lands on
                something you didn't ask for, and clearing it snaps straight back to 1. */}
            <select
              value={dayCount}
              onChange={(e) => changeDayCount(Number(e.target.value))}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} {i === 0 ? 'night' : 'nights'}
                </option>
              ))}
            </select>
          </div>
        </div>
        {dayCount > 1 && (
          <p style={{ color: '#6B7A99', fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
            It's still one game — picks for every night lock together at the time above. Assign
            each question to a night below.
          </p>
        )}
      </Card>

      <QuestionBuilder
        title="Match predictions"
        optionLabel="Match"
        questions={matches}
        setQuestions={setMatches}
        withPoster
        uid={user?.uid}
        dayCount={dayCount}
        onPosterPendingChange={(id, pending) => setPendingPosters((p) => ({ ...p, [id]: pending }))}
      />
      <QuestionBuilder title="Prop bets" optionLabel="Prop bet" questions={props} setQuestions={setProps} dayCount={dayCount} />

      <Card style={{ padding: 18, marginBottom: 22 }}>
        <label style={labelStyle}>Tiebreaker question</label>
        <input
          placeholder="e.g. Main event match length, in minutes"
          value={tiebreaker}
          onChange={(e) => setTiebreaker(e.target.value)}
          style={inputStyle}
        />
      </Card>

      {error && <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div className="flex gap-3 flex-wrap">
        <GoldButton onClick={publish} style={{ flex: 1, minWidth: 220, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Publishing…' : 'Publish game'}
        </GoldButton>
        <button
          onClick={() => navigate('/admin')}
          className="cursor-pointer bg-transparent font-extrabold"
          style={{ border: '1.5px solid rgba(255,255,255,.16)', color: '#F5F5F5', borderRadius: 13, padding: '0 26px' }}
        >
          Cancel
        </button>
      </div>

      <Toast
        open={toastOpen}
        title="Game published!"
        message="Your challenge is live. Share the join code with the pod and the countdown starts ticking."
        onClose={() => {
          setToastOpen(false);
          navigate(newGameId ? `/admin/game/${newGameId}` : '/admin');
        }}
      />
    </div>
  );
}
