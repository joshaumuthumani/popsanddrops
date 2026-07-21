import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Login } from '@/pages/Login';
import { JoinGame } from '@/pages/JoinGame';
import { UserDashboard } from '@/pages/user/Dashboard';
import { UserGame } from '@/pages/user/UserGame';
import { AdminGames } from '@/pages/admin/AdminGames';
import { AdminGame } from '@/pages/admin/AdminGame';
import { GameBuilder } from '@/pages/admin/GameBuilder';
import { EditGame } from '@/pages/admin/EditGame';
import { CloseGame } from '@/pages/admin/CloseGame';
import { AdminManagement } from '@/pages/admin/AdminManagement';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Login />} />

      {/* User app (auth required) */}
      <Route path="/join/:code?" element={<ProtectedRoute><JoinGame /></ProtectedRoute>} />
      <Route path="/app" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
      <Route path="/app/game/:gameId" element={<ProtectedRoute><UserGame /></ProtectedRoute>} />

      {/* Admin console (admin role required) */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminGames /></ProtectedRoute>} />
      <Route path="/admin/new" element={<ProtectedRoute adminOnly><GameBuilder /></ProtectedRoute>} />
      <Route path="/admin/game/:gameId" element={<ProtectedRoute adminOnly><AdminGame /></ProtectedRoute>} />
      <Route path="/admin/game/:gameId/edit" element={<ProtectedRoute superAdminOnly><EditGame /></ProtectedRoute>} />
      <Route path="/admin/game/:gameId/close" element={<ProtectedRoute adminOnly><CloseGame /></ProtectedRoute>} />
      <Route path="/admin/manage" element={<ProtectedRoute adminOnly><AdminManagement /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
