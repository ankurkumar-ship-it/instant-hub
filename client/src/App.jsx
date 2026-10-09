import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CreateSession from './components/CreateSession';
import StandeeCard from './components/StandeeCard';
import GuestRoom from './components/GuestRoom';

function HostHome() {
  const [activeSession, setActiveSession] = useState(null);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {!activeSession ? (
        <CreateSession onSessionCreated={(data) => setActiveSession(data)} />
      ) : (
        <StandeeCard
          sessionData={activeSession}
          onReset={() => setActiveSession(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HostHome />} />
        <Route path="/room/:roomCode" element={<GuestRoom />} />
      </Routes>
    </BrowserRouter>
  );
}