import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ipToUuid } from './utils/session';
import { HomePage } from './pages/home/HomePage';
import { ChatPage } from './pages/chat/ChatPage';

// ── Chat Redirect Handler (IP -> UUID Session) ─────────────────────────────
function ChatRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const uuid = ipToUuid('127.0.0.1');
    navigate(`/chat/${uuid}`, { replace: true });
  }, [navigate]);

  return null;
}

// ── App Router ───────────────────────────────────────────────────────────────
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/chat" element={<ChatRedirect />} />
      <Route path="/chat/:sessionId" element={<ChatPage />} />
    </Routes>
  );
}

export default App;
