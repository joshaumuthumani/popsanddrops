import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Eyebrow, PageTitle, SectionLabel, GoldButton } from '@/components/primitives';
import { Toast } from '@/components/Toast';

interface DraftQuestion {
  id: string;
  label: string;
  options: string[];
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
}: {
  title: string;
  optionLabel: string;
  questions: DraftQuestion[];
  setQuestions: (q: DraftQuestion[]) => void;
}) {
  const update = (idx: number, patch: Partial<DraftQuestion>) =>
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel style={{ marginBottom: 14 }}>{title}</SectionLabel>
      <div className="flex flex-col gap-3">
        {questions.map((q, idx) => (
          <Card key={q.id} style={{ padding: 16 }}>
            <div className="flex items-center gap-2 mb-3">
              <input
                placeholder={`${optionLabel} name`}
                value={q.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                style={inputStyle}
              />
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
  const [name, setName] = useState('');
  const [promotion, setPromotion] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [lockTime, setLockTime] = useState('');
  const [tiebreaker, setTiebreaker] = useState('');
  const [matches, setMatches] = useState<DraftQuestion[]>([{ id: newId(), label: '', options: ['', ''] }]);
  const [props, setProps] = useState<DraftQuestion[]>([{ id: newId(), label: '', options: ['Yes', 'No'] }]);
  const [toastOpen, setToastOpen] = useState(false);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>Admin console · Organizer</Eyebrow>
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
        </div>
      </Card>

      <QuestionBuilder title="Match predictions" optionLabel="Match" questions={matches} setQuestions={setMatches} />
      <QuestionBuilder title="Prop bets" optionLabel="Prop bet" questions={props} setQuestions={setProps} />

      <Card style={{ padding: 18, marginBottom: 22 }}>
        <label style={labelStyle}>Tiebreaker question</label>
        <input
          placeholder="e.g. Main event match length, in minutes"
          value={tiebreaker}
          onChange={(e) => setTiebreaker(e.target.value)}
          style={inputStyle}
        />
      </Card>

      <div className="flex gap-3 flex-wrap">
        <GoldButton onClick={() => setToastOpen(true)} style={{ flex: 1, minWidth: 220 }}>
          Publish game
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
          navigate('/admin');
        }}
      />
    </div>
  );
}
