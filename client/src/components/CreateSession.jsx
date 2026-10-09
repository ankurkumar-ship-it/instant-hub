import React, { useState } from 'react';
import { Sparkles, ShieldCheck, Clock, Layers } from 'lucide-react';

export default function CreateSession({ onSessionCreated }) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('4');
  const [requirePin, setRequirePin] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('https://instant-hub-server.onrender.com/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'Live Collaboration Hub',
          durationHours: Number(duration),
          requirePin,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onSessionCreated(data);
      }
    } catch (err) {
      alert('Unable to connect to server. Please check port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
          <Layers size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Instant Hub</h1>
          <p className="text-xs text-slate-500 font-medium">Create a fast QR workspace for team media & screen sharing</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Session Title
          </label>
          <input
            type="text"
            placeholder="e.g. Design Sync / Client Presentation"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-medium transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Auto-Expire After
          </label>
          <div className="relative">
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-medium bg-white appearance-none transition"
            >
              <option value="1">1 Hour</option>
              <option value="4">4 Hours</option>
              <option value="12">12 Hours</option>
              <option value="24">24 Hours</option>
            </select>
            <Clock size={16} className="absolute right-4 top-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="pt-1">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/80 cursor-pointer transition">
            <input
              type="checkbox"
              checked={requirePin}
              onChange={(e) => setRequirePin(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <ShieldCheck size={16} className="text-indigo-600" />
              Require 4-Digit Security Passcode
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-3 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-indigo-100 disabled:opacity-50"
        >
          <Sparkles size={18} />
          {loading ? 'Creating Hub...' : 'Generate Standee & Launch'}
        </button>
      </form>
    </div>
  );
}
