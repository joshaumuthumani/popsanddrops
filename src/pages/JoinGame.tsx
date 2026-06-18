import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Eyebrow, PageTitle, GoldButton } from '@/components/primitives';
import { MOCK_GAMES } from '@/data/mock';

/** Join via shareable link (/join/:code) or by entering a game code (PRD §5.4). */
export function JoinGame() {
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(routeCode ?? '');
  const [error, setError] = useState('');

  const join = () => {
    const game = MOCK_GAMES.find((g) => g.joinCode.toLowerCase() === code.trim().toLowerCase());
    if (!game) {
      setError("We couldn't find a game with that code.");
      return;
    }
    navigate(`/app/game/${game.id}`);
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
        <GoldButton full onClick={join}>
          Join challenge
        </GoldButton>
      </Card>
      <p className="text-muted text-center" style={{ fontSize: 12.5, marginTop: 14 }}>
        Codes come from your pod's organizer. Try <span style={{ color: '#E7C92F' }}>SLAM-4827</span>.
      </p>
    </div>
  );
}
