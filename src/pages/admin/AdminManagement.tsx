import { useState } from 'react';
import { Card, Eyebrow, PageTitle, SectionLabel } from '@/components/primitives';
import { Avatar } from '@/components/Avatar';
import type { Role } from '@/types';

interface ManagedUser {
  uid: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
}

const SEED: ManagedUser[] = [
  { uid: 'u-you', name: 'Jordan D.', email: 'jordan@example.com', initials: 'JD', role: 'superadmin' },
  { uid: 'u-steph', name: 'Steph R.', email: 'steph@example.com', initials: 'SR', role: 'admin' },
  { uid: 'u-dwayne', name: 'Dwayne K.', email: 'dwayne@example.com', initials: 'DK', role: 'user' },
  { uid: 'u-marcus', name: 'Marcus J.', email: 'marcus@example.com', initials: 'MJ', role: 'user' },
];

const ROLE_COLOR: Record<Role, string> = { superadmin: '#E7C92F', admin: '#77E0E8', user: '#6B7A99' };

/** Admin Management — Super Admin promotes/demotes users (PRD §5.8). */
export function AdminManagement() {
  const [users, setUsers] = useState(SEED);

  const setRole = (uid: string, role: Role) => setUsers((list) => list.map((u) => (u.uid === uid ? { ...u, role } : u)));

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>Admin console · Super Admin</Eyebrow>
        <PageTitle>Manage Admins</PageTitle>
      </div>

      <SectionLabel style={{ marginBottom: 14 }}>Community members</SectionLabel>
      <Card style={{ overflow: 'hidden' }}>
        {users.map((u, i) => (
          <div
            key={u.uid}
            className="flex items-center gap-3 flex-wrap"
            style={{ padding: '14px 16px', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.05)' }}
          >
            <Avatar initials={u.initials} highlight={u.role !== 'user'} size={34} />
            <div className="flex-1" style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div>
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
              onChange={(e) => setRole(u.uid, e.target.value as Role)}
              className="cursor-pointer"
              style={{
                background: 'rgba(0,0,0,.3)',
                border: '1.5px solid rgba(255,255,255,.12)',
                borderRadius: 9,
                padding: '8px 10px',
                color: '#F5F5F5',
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>
        ))}
      </Card>
      <p className="text-muted" style={{ fontSize: 12.5, marginTop: 14 }}>
        Super Admins have global access to every game across all promotions. Game-level co-admins are managed per game.
      </p>
    </div>
  );
}
