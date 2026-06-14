import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import GroupPage from './pages/GroupPage';
import ImportPage from './pages/ImportPage';

function App() {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/groups/:groupId" element={<GroupPage />} />
      <Route path="/groups/:groupId/import" element={<ImportPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
