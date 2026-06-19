import { Card, Eyebrow, PageTitle, SectionLabel } from '@/components/primitives';
import { Avatar } from '@/components/Avatar';
import type { Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/hooks/data';
import { setUserRole } from '@/lib/store';
import { isFirebaseConfigured } from '@/lib/firebase';
import { initialsFromName } from '@/lib/format';

const ROLE_COLOR: Record<Role, string> = { superadmin: '#E7C92F', admin: '#77E0E8', user: '#6B7A99' };

/** Admin Management — Super Admin promotes/demotes users (PRD §5.8). */
export function AdminManagement() {
  const { user } = useAuth();
  const { users, loading } = useUsers();
  const canManage = user?.role === 'superadmin';

  const changeRole = (uid: string, role: Role) => {
    if (!canManage || !isFirebaseConfigured) return;
    setUserRole(uid, role).catch(() => {});
  };

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>Admin console · Super Admin</Eyebrow>
        <PageTitle>Manage Admins</PageTitle>
      </div>

      <SectionLabel style={{ marginBottom: 14 }}>Community members</SectionLabel>
      {loading ? (
        <p className="text-muted">Loading members…</p>
      ) : users.length === 0 ? (
        <p className="text-muted">No members yet. They'll appear here once they sign in.</p>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          {users.map((u, i) => (
            <div
              key={u.uid}
              className="flex items-center gap-3 flex-wrap"
              style={{ padding: '14px 16px', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.05)' }}
            >
              <Avatar initials={initialsFromName(u.displayName)} highlight={u.role !== 'user'} size={34} />
              <div className="flex-1" style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  {u.displayName}
                  {u.uid === user?.uid && <span style={{ color: '#E7C92F', fontSize: 11, fontWeight: 800 }}> · you</span>}
                </div>
                <div className="text-muted" style={{ fontSize: 12 }}>{u.email}</div>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '.1em',
                  color: ROLE_COLOR[u.role],
                  textTransform: 'uppercase',
                  minWidth: 88,
                }}
              >
                {u.role}
              </span>
              <select
                value={u.role}
                disabled={!canManage}
                onChange={(e) => changeRole(u.uid, e.target.value as Role)}
                className={canManage ? 'cursor-pointer' : ''}
                style={{
                  background: 'rgba(0,0,0,.3)',
                  border: '1.5px solid rgba(255,255,255,.12)',
                  borderRadius: 9,
                  padding: '8px 10px',
                  color: '#F5F5F5',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  opacity: canManage ? 1 : 0.5,
                }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
          ))}
        </Card>
      )}
      <p className="text-muted" style={{ fontSize: 12.5, marginTop: 14 }}>
        {canManage
          ? 'Super Admins have global access to every game across all promotions. Game-level co-admins are managed per game.'
          : 'Only Super Admins can change roles. Game-level co-admins are managed from each game dashboard.'}
      </p>
    </div>
  );
}
