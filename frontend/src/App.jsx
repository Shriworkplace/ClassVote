import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import EntryPage from './pages/EntryPage';
import VotingPage from './pages/VotingPage';
import ResultsPage from './pages/ResultsPage';
import AdminDashboard from './pages/AdminDashboard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Header from './components/Header';
import Footer from './components/Footer';

function App() {
  return (
    <Router>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/entry" replace />} />
          <Route path="/entry" element={<EntryPage />} />
          <Route path="/voting" element={<VotingPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        </Routes>
      </main>
      <Footer />
    </Router>
  );
}

export default App;
