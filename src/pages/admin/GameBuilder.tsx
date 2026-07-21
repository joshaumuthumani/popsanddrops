import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitle } from '@/components/primitives';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { createGame } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';
import { GameForm } from '@/pages/admin/GameForm';
import { emptyGameForm } from '@/pages/admin/gameFormState';

/** Game Builder — create a game for any promotion (PRD §5.2). Editing lives in EditGame. */
export function GameBuilder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [toastOpen, setToastOpen] = useState(false);
  const [newGameId, setNewGameId] = useState<string | null>(null);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <PageTitle>New Challenge</PageTitle>
      </div>

      <GameForm
        initial={emptyGameForm()}
        submitLabel="Publish game"
        busyLabel="Publishing…"
        uid={user?.uid}
        onCancel={() => navigate('/admin')}
        onSubmit={async (input) => {
          // Demo mode — no backend; just show the success toast.
          if (!isFirebaseConfigured || !user) {
            setToastOpen(true);
            return;
          }
          setNewGameId(await createGame(input, user));
          setToastOpen(true);
        }}
      />

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
