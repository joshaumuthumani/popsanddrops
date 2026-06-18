import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ChevronMark, UserIcon, ShieldIcon } from '@/components/icons';
import { Avatar } from '@/components/Avatar';
import { initialsFromName } from '@/lib/format';

/** Sticky blurred top bar: CodWrestlePod badge + Pops & Drops mark, nav, account. */
export function AppHeader() {
  const { user, signOut, demoMode, setDemoRole } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const navPill = (active: boolean) =>
    ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontWeight: 800,
      fontSize: 13.5,
      padding: '9px 16px',
      borderRadius: 8,
      background: active ? 'linear-gradient(120deg,#F4DB6B,#E7C92F 55%,#C9A91F)' : 'transparent',
      color: active ? '#1A1408' : '#6B7A99',
      textDecoration: 'none',
    }) as const;

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(8,8,16,.9)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(231,201,47,.14)',
      }}
    >
      <div
        className="mx-auto flex items-center justify-between gap-4 flex-wrap"
        style={{ maxWidth: 1120, padding: '14px 24px' }}
      >
        {/* Brand cluster */}
        <button
          onClick={() => navigate('/app')}
          className="flex items-center gap-3 cursor-pointer bg-transparent border-0 p-0"
        >
          <div className="flex items-center gap-2.5">
            <img
              src="/codwrestlepod.jpg"
              alt="CodWrestlePod"
              width={38}
              height={38}
              style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 1.5px #0B52A1' }}
            />
            <span style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: '.01em', color: '#C8D4E8' }}>
              CodWrestlePod
            </span>
          </div>
          <span style={{ width: 1, height: 28, background: 'rgba(255,255,255,.14)' }} />
          <div className="flex items-center gap-2.5">
            <ChevronMark />
            <span className="flex flex-col" style={{ lineHeight: 1 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 21, letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
                POPS &amp; DROPS
              </span>
              <span style={{ fontSize: 8, letterSpacing: '.28em', color: '#77E0E8', fontWeight: 800 }}>
                CALL IT. OWN IT.
              </span>
            </span>
          </div>
        </button>

        {/* Right side: nav + account */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {demoMode && (
            <div
              className="flex items-center gap-1"
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 11, padding: 4 }}
              title="Demo only — replaced by Google auth + role gating once Firebase is connected"
            >
              <NavLink to="/app" style={({ isActive }) => navPill(isActive)}>
                <UserIcon size={15} /> User app
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" style={({ isActive }) => navPill(isActive)}>
                  <ShieldIcon size={15} /> Admin console
                </NavLink>
              )}
            </div>
          )}
          {user && (
            <button
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              className="flex items-center gap-2.5 bg-transparent border-0 cursor-pointer"
              title="Sign out"
            >
              <Avatar initials={initialsFromName(user.displayName)} photoURL={user.photoURL} highlight />
            </button>
          )}
        </div>
      </div>

      {/* Demo-mode role preview switch (hidden once Firebase is connected) */}
      {demoMode && isAdmin && (
        <div className="mx-auto" style={{ maxWidth: 1120, padding: '0 24px 8px' }}>
          <span style={{ fontSize: 10, color: '#6B7A99' }}>
            Demo preview — sign-in &amp; roles are mocked.{' '}
            <button onClick={() => setDemoRole('user')} className="underline bg-transparent border-0 cursor-pointer" style={{ color: '#77E0E8' }}>
              view as User
            </button>{' '}
            ·{' '}
            <button onClick={() => setDemoRole('superadmin')} className="underline bg-transparent border-0 cursor-pointer" style={{ color: '#77E0E8' }}>
              view as Admin
            </button>
          </span>
        </div>
      )}
    </header>
  );
}
