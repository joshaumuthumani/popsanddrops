import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/AppHeader';

/**
 * Gate for authenticated routes. Unauthenticated users go to the login page;
 * non-admins hitting an admin-only route are redirected to the User dashboard
 * (PRD §5.1, §10.1).
 */
export function ProtectedRoute({
  children,
  adminOnly = false,
  superAdminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-backdrop grid place-items-center">
        <span className="text-muted">Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  if ((adminOnly || superAdminOnly) && !isAdmin) {
    return <Navigate to="/app" replace />;
  }
  // A plain admin who reaches a super-admin-only route (e.g. edit game) lands back in the
  // admin console rather than the user app — they belong in the console, just not here.
  if (superAdminOnly && user.role !== 'superadmin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="app-backdrop" style={{ paddingBottom: 60 }}>
      <AppHeader />
      <main className="mx-auto" style={{ maxWidth: 1120, padding: '30px 24px 0' }}>
        {children}
      </main>
    </div>
  );
}
