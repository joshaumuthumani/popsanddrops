import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ChevronMark, GoogleIcon } from '@/components/icons';

/** Login / Landing — CodWrestlePod badge, app mark, Google Sign-In only (PRD §8.4). */
export function Login() {
  const { user, signIn, demoMode } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  return (
    <div className="app-backdrop grid place-items-center" style={{ padding: 24 }}>
      <div className="w-full text-center" style={{ maxWidth: 420 }}>
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <img
            src="/codwrestlepod.jpg"
            alt="CodWrestlePod"
            width={44}
            height={44}
            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 1.5px #0B52A1' }}
          />
          <span style={{ fontWeight: 800, fontSize: 13, color: '#C8D4E8' }}>CodWrestlePod</span>
        </div>

        <div className="flex items-center justify-center gap-3 mb-3">
          <ChevronMark size={40} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px,9vw,68px)', letterSpacing: '.03em', lineHeight: 1 }}>
            POPS &amp; DROPS
          </span>
        </div>
        <div style={{ color: '#77E0E8', fontWeight: 800, letterSpacing: '.28em', fontSize: 12, marginBottom: 28 }}>
          CALL IT. OWN IT.
        </div>

        <p className="text-muted mb-8" style={{ fontSize: 15, lineHeight: 1.6 }}>
          Predict the card. Earn your <span style={{ color: '#E7C92F', fontWeight: 700 }}>Pops</span>, dodge the{' '}
          <span style={{ color: '#C0392B', fontWeight: 700 }}>Drops</span>, and climb the live Pop Rankings with the pod.
        </p>

        <button
          onClick={() => signIn()}
          className="cursor-pointer font-extrabold mx-auto"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            background: '#FFFFFF',
            color: '#1A1408',
            border: 'none',
            fontSize: 15.5,
            padding: 16,
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,.35)',
          }}
        >
          <GoogleIcon size={20} />
          Sign in with Google
        </button>

        <p className="text-muted" style={{ fontSize: 12, marginTop: 16 }}>
          {demoMode
            ? 'Demo mode — sign-in is mocked until Firebase is connected.'
            : 'Google is the only way in. No passwords, no extra accounts.'}
        </p>
      </div>
    </div>
  );
}
