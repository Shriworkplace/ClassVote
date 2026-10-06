import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import EntryPage from './pages/EntryPage';
import VotingPage from './pages/VotingPage';
import ResultsPage from './pages/ResultsPage';
import AdminDashboard from './pages/AdminDashboard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import LandingPage from './pages/LandingPage';
import KioskPage from './pages/KioskPage';
import NotFound from './pages/NotFound';
import Header from './components/Header';
import Footer from './components/Footer';
import NetworkStatusBadge from './components/NetworkStatusBadge';

function AppContent() {
  const location = useLocation();
  const isKiosk = location.pathname === '/kiosk';

  return (
    <>
      {!isKiosk && <Header />}
      <main className={isKiosk ? 'w-full' : 'container mx-auto px-4 py-8'}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/entry" element={<EntryPage />} />
          <Route path="/voting" element={<VotingPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isKiosk && <Footer />}
      <NetworkStatusBadge />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
