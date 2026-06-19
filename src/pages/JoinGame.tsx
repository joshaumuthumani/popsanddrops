import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Eyebrow, PageTitle, GoldButton } from '@/components/primitives';
import { isFirebaseConfigured } from '@/lib/firebase';
import { findGameByCode } from '@/lib/store';
import { MOCK_GAMES } from '@/data/mock';

/** Join via shareable link (/join/:code) or by entering a game code (PRD §5.4). */
export function JoinGame() {
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(routeCode ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    try {
      const game = isFirebaseConfigured
        ? await findGameByCode(trimmed)
        : MOCK_GAMES.find((g) => g.joinCode.toLowerCase() === trimmed.toLowerCase()) ?? null;
      if (!game) {
        setError("We couldn't find a game with that code.");
        return;
      }
      navigate(`/app/game/${game.id}`);
    } catch {
      setError('Something went wrong looking up that code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto" style={{ maxWidth: 460, paddingTop: 30 }}>
      <Eyebrow>Join a challenge</Eyebrow>
      <PageTitle>Enter your code</PageTitle>
      <Card style={{ padding: 22, marginTop: 18 }}>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
          placeholder="SLAM-4827"
          style={{
            width: '100%',
            textAlign: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            letterSpacing: '.14em',
            color: '#E7C92F',
            background: 'rgba(0,0,0,.3)',
            border: '1.5px dashed rgba(231,201,47,.4)',
            borderRadius: 11,
            padding: '14px 18px',
            outline: 'none',
            marginBottom: 16,
          }}
        />
        {error && <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</p>}
        <GoldButton full onClick={join} style={{ opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Looking…' : 'Join challenge'}
        </GoldButton>
      </Card>
      <p className="text-muted text-center" style={{ fontSize: 12.5, marginTop: 14 }}>
        Codes come from your pod's organizer. Try <span style={{ color: '#E7C92F' }}>SLAM-4827</span>.
      </p>
    </div>
  );
}
