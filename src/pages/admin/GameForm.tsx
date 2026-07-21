import { useState, type Dispatch, type SetStateAction } from 'react';
import { Card, SectionLabel, GoldButton } from '@/components/primitives';
import { PosterPicker } from '@/components/PosterPicker';
import type { NewGameInput } from '@/lib/store';
import {
  cleanQuestions,
  newId,
  type DraftQuestion,
  type GameFormInitial,
} from '@/pages/admin/gameFormState';

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
  setQuestions: Dispatch<SetStateAction<DraftQuestion[]>>;
  /** Matches get a poster control; prop bets don't (PRD scope). */
  withPoster?: boolean;
  uid?: string;
  /** Night selectors only appear once the event runs more than one night. */
  dayCount?: number;
  /** Reports per-question whether a poster link is unsaved, keyed by question id. */
  onPosterPendingChange?: (questionId: string, pending: boolean) => void;
}) {
  /**
   * Keyed by question id, not array index, and updates functionally rather than closing over
   * `questions`. Both matter: a poster ingest started on blur can resolve AFTER its row was
   * removed, and the old index-based version wrote back the pre-removal array — resurrecting
   * the deleted question, or landing the poster on whichever match had inherited that index.
   * An id that no longer exists now patches nothing, which is the correct outcome.
   */
  const update = (
    id: string,
    patch: Partial<DraftQuestion> | ((q: DraftQuestion) => Partial<DraftQuestion>),
  ) =>
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, ...(typeof patch === 'function' ? patch(q) : patch) } : q)),
    );

  const remove = (id: string) => {
    // Drop any "poster link still pending" flag with the row. Left behind, it blocks publish
    // forever, pointing the admin at a link box that no longer exists on the page.
    onPosterPendingChange?.(id, false);
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel style={{ marginBottom: 14 }}>{title}</SectionLabel>
      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <Card key={q.id} style={{ padding: 16 }}>
            {withPoster && (
              <PosterPicker
                value={q.posterUrl}
                uid={uid}
                onChange={(posterUrl) => update(q.id, { posterUrl })}
                onPendingChange={(pending) => onPosterPendingChange?.(q.id, pending)}
              />
            )}
            <div className="flex items-center gap-2 mb-3">
              <input
                placeholder={`${optionLabel} name`}
                value={q.label}
                onChange={(e) => update(q.id, { label: e.target.value })}
                style={inputStyle}
              />
              {dayCount > 1 && (
                <select
                  value={q.day ?? 1}
                  onChange={(e) => update(q.id, { day: Number(e.target.value) })}
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
                onClick={() => remove(q.id)}
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
                    onChange={(e) => update(q.id, (cur) => ({ options: cur.options.map((o, i) => (i === oi ? e.target.value : o)) }))}
                    style={inputStyle}
                  />
                  {q.options.length > 2 && (
                    <button
                      onClick={() => update(q.id, (cur) => ({ options: cur.options.filter((_, i) => i !== oi) }))}
                      className="cursor-pointer bg-transparent text-muted"
                      style={{ border: 'none', fontSize: 18 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => update(q.id, (cur) => ({ options: [...cur.options, ''] }))}
                className="cursor-pointer bg-transparent self-start"
                style={{ border: '1.5px dashed rgba(255,255,255,.16)', color: '#6B7A99', borderRadius: 9, padding: '8px 14px', fontWeight: 800, fontSize: 13 }}
              >
                + Add option
              </button>
            </div>
          </Card>
        ))}
        <button
          onClick={() => setQuestions((qs) => [...qs, { id: newId(), label: '', options: ['', ''] }])}
          className="cursor-pointer bg-transparent font-extrabold"
          style={{ border: '1.5px dashed rgba(231,201,47,.4)', color: '#E7C92F', borderRadius: 11, padding: 14, fontSize: 13.5 }}
        >
          + Add {optionLabel.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

export interface GameFormProps {
  initial: GameFormInitial;
  submitLabel: string;
  busyLabel: string;
  /** Actually persists the built game (create vs update, and demo-mode handling, live here). */
  onSubmit: (input: NewGameInput) => Promise<void>;
  onCancel: () => void;
  /** Owner uid, threaded to the poster control for the Storage upload path. */
  uid?: string;
  /** Optional pre-commit gate (edit uses it for the orphan warning). Return false to abort. */
  beforeSubmit?: (input: NewGameInput) => Promise<boolean>;
}

/**
 * The shared game form (fields + question builders + validation + build). Both the create
 * screen (GameBuilder) and the edit screen (EditGame) render this; they differ only in the
 * initial state, the submit label, and what onSubmit does with the built NewGameInput.
 */
export function GameForm({ initial, submitLabel, busyLabel, onSubmit, onCancel, uid, beforeSubmit }: GameFormProps) {
  const [name, setName] = useState(initial.name);
  const [promotion, setPromotion] = useState(initial.promotion);
  const [eventDate, setEventDate] = useState(initial.eventDate);
  const [lockTime, setLockTime] = useState(initial.lockTimeLocal);
  const [tiebreaker, setTiebreaker] = useState(initial.tiebreaker);
  const [dayCount, setDayCount] = useState(initial.dayCount);
  const [pendingPosters, setPendingPosters] = useState<Record<string, boolean>>({});
  const [matches, setMatches] = useState<DraftQuestion[]>(() => initial.matches);
  const [props, setProps] = useState<DraftQuestion[]>(() => initial.props);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  const submit = async () => {
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
    // with one still in the box used to discard it silently. Count only questions still on
    // the page — a flag left by a removed row would block forever, pointing at a gone link box.
    const stillPending = matches.filter((m) => pendingPosters[m.id]).length;
    if (stillPending > 0) {
      setError(
        `${stillPending} poster ${stillPending === 1 ? 'link is' : 'links are'} still being added. ` +
          'Wait for the preview to appear, or clear the link box, then save.',
      );
      return;
    }

    const input: NewGameInput = {
      name,
      promotion,
      eventDate,
      lockTime: lockMs,
      dayCount,
      tiebreakerQuestion: tiebreaker,
      // Spread poster/day only when meaningful — Firestore rejects explicit `undefined`, and
      // single-night games shouldn't carry a redundant `day: 1` on every question.
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
    };

    if (beforeSubmit && !(await beforeSubmit(input))) return;
    setBusy(true);
    try {
      await onSubmit(input);
    } catch {
      setError('Could not save the game. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
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
        uid={uid}
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
        <GoldButton onClick={submit} style={{ flex: 1, minWidth: 220, opacity: busy ? 0.6 : 1 }}>
          {busy ? busyLabel : submitLabel}
        </GoldButton>
        <button
          onClick={onCancel}
          className="cursor-pointer bg-transparent font-extrabold"
          style={{ border: '1.5px solid rgba(255,255,255,.16)', color: '#F5F5F5', borderRadius: 13, padding: '0 26px' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
