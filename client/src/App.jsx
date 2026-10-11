import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import CreateSession from './components/CreateSession';
import StandeeCard from './components/StandeeCard';
import GuestRoom from './components/GuestRoom';

function HostHome() {
  const [activeSession, setActiveSession] = useState(null);

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-950 flex items-center justify-center p-4">
      {!activeSession ? (
        <CreateSession onSessionCreated={(data) => setActiveSession(data)} />
      ) : (
        <StandeeCard
          sessionData={activeSession}
          session={activeSession}
          onReset={() => setActiveSession(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Top-Left Corner Brand Header */}
        <Navbar />

        {/* App Pages */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HostHome />} />
            <Route path="/room/:roomCode" element={<GuestRoom />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
