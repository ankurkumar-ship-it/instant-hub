import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import CreateSession from './components/CreateSession';
import StandeeCard from './components/StandeeCard';
import GuestRoom from './components/GuestRoom';

// Top Corner Branding Header (Google Meet style)
function AppHeader() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      {/* Top-Left Corner: Logo + Instant Hub Text */}
      <Link to="/" className="flex items-center gap-3 select-none no-underline group">
        <img
          src="/icon.png"
          alt="Instant Hub Logo"
          className="w-8 h-8 rounded-xl object-contain shadow-md transition-transform duration-200 group-hover:scale-105"
          onError={(e) => {
            // Fallback agar icon load na ho
            e.target.style.display = 'none';
          }}
        />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-indigo-400 transition-colors">
            Instant Hub
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </Link>

      {/* Top-Right Corner: Current Date Indicator */}
      <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-full shadow-inner">
        <span>{today}</span>
      </div>
    </header>
  );
}

// Host Home Controller
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

// Main Application Root
export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        {/* Persistent Branding Header */}
        <AppHeader />

        {/* View Routing */}
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<HostHome />} />
            <Route path="/room/:roomCode" element={<GuestRoom />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
