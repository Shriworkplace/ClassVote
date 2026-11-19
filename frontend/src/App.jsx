import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { dark } from '@clerk/themes';
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

const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_bG92ZWQtbWFncGllLTYzNzEuY2xlcmsuYWNjb3VudHMuZGV2JA';

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
          <Route path="/signup/*" element={<SignUpPage />} />
          <Route path="/login/*" element={<LoginPage />} />
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
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#06b6d4',
          colorBackground: '#0b1329',
          colorText: '#f8fafc',
          colorTextSecondary: '#94a3b8',
          colorInputBackground: '#060d1f',
          colorInputText: '#f8fafc',
          borderRadius: '16px'
        },
        elements: {
          card: 'bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-xl',
          headerTitle: 'font-heading font-black text-white text-xl',
          headerSubtitle: 'text-slate-400 text-xs',
          formButtonPrimary: 'btn-primary py-2.5 text-sm font-semibold',
          footerActionLink: 'text-cyan-400 hover:text-cyan-300'
        }
      }}
    >
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ClerkProvider>
  );
}

export default App;
