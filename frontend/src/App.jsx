import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import EntryPage from './pages/EntryPage';
import VotingPage from './pages/VotingPage';
import ResultsPage from './pages/ResultsPage';
import SignUpPage from './pages/SignUpPage';
import LoginPage from './pages/LoginPage';
import DashboardHomePage from './pages/DashboardHomePage';
import ElectionManagePage from './pages/ElectionManagePage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import LandingPage from './pages/LandingPage';
import KioskPage from './pages/KioskPage';
import ElectionEmbedWidget from './pages/ElectionEmbedWidget';
import NotFound from './pages/NotFound';
import Header from './components/Header';
import Footer from './components/Footer';
import NetworkStatusBadge from './components/NetworkStatusBadge';

function AppContent() {
  const location = useLocation();
  const isKiosk = location.pathname === '/kiosk' || location.pathname.endsWith('/kiosk');
  const isEmbed = location.pathname.endsWith('/embed');
  const isCleanLayout = isKiosk || isEmbed;

  return (
    <>
      {!isCleanLayout && <Header />}
      <main className={isCleanLayout ? 'w-full' : 'container mx-auto px-4 py-8'}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/entry" element={<EntryPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />

          {/* Organizer Multi-Election Workspace (Protected) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardHomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/elections/:electionId"
            element={
              <ProtectedRoute>
                <ElectionManagePage />
              </ProtectedRoute>
            }
          />

          {/* Public Per-Election Portals */}
          <Route path="/e/:slug" element={<EntryPage />} />
          <Route path="/e/:slug/voting" element={<VotingPage />} />
          <Route path="/e/:slug/results" element={<ResultsPage />} />
          <Route path="/e/:slug/embed" element={<ElectionEmbedWidget />} />
          <Route
            path="/e/:slug/kiosk"
            element={
              <ProtectedRoute>
                <KioskPage />
              </ProtectedRoute>
            }
          />

          {/* Legacy Routes Compatibility */}
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/voting" element={<Navigate to="/entry" replace />} />
          <Route path="/results" element={<Navigate to="/entry" replace />} />
          <Route path="/kiosk" element={<Navigate to="/dashboard" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isCleanLayout && <Footer />}
      {!isEmbed && <NetworkStatusBadge />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
