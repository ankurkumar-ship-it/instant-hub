import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  // Google Meet ki tarah live date format
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60 sticky top-0 z-50 px-4 sm:px-8 py-3 flex items-center justify-between">
      {/* Left: Logo + App Name */}
      <Link to="/" className="flex items-center gap-3 group select-none">
        <img
          src="/icon.png"
          alt="Instant Hub Logo"
          className="w-9 h-9 rounded-xl object-contain shadow-md group-hover:scale-105 transition-transform duration-200"
          onError={(e) => {
            // Agar icon.png na mile to fallback placeholder icon
            e.target.style.display = 'none';
          }}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-indigo-400 transition-colors">
            Instant Hub
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </Link>

      {/* Right: Date indicator */}
      <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-full">
        <span>{today}</span>
      </div>
    </header>
  );
}
