import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';
import { 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  LogOut, 
  Image as ImageIcon, 
  Video, 
  Download, 
  Lock, 
  Radio, 
  Eye 
} from 'lucide-react';

export default function GuestRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  // State management
  const [guestName, setGuestName] = useState(() => localStorage.getItem('hub_guest_name') || '');
  const [isJoined, setIsJoined] = useState(false);
  const [pin, setPin] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // LiveKit Stream & Fullscreen states
  const [hasLiveScreen, setHasLiveScreen] = useState(false);
  const [isLandscapeFs, setIsLandscapeFs] = useState(false);

  // References
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const currentTrackRef = useRef(null);

  // Fetch Room Information on load
  const fetchRoomInfo = async () => {
    try {
      const res = await fetch(`/api/sessions/${roomCode}/info`);
      if (res.status === 404) throw new Error('Room nahi mila ya galat code hai.');
      if (res.status === 410) throw new Error('Session expire ho chuka hai.');
      const data = await res.json();
      setSessionInfo(data);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  useEffect(() => {
    fetchRoomInfo();
  }, [roomCode]);

  // Fetch Session Files
  const fetchFiles = async (pinCode = pin) => {
    try {
      const res = await fetch(`/api/sessions/${roomCode}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode })
      });
      const data = await res.json();
      if (data.success) {
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Files fetch error:', err);
    }
  };

  // Join Room & Connect to LiveKit
  const handleJoin = async (e) => {
    e?.preventDefault();
    if (!guestName.trim()) {
      setErrorMsg('Kripya apna naam darj karein');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      // Step 1: Verify PIN if protected
      if (sessionInfo?.isProtected) {
        const testRes = await fetch(`/api/sessions/${roomCode}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (testRes.status === 401) {
          throw new Error('Galat PIN code darj kiya hai.');
        }
      }

      localStorage.setItem('hub_guest_name', guestName.trim());
      await fetchFiles(pin);

      // Step 2: Fetch LiveKit Guest Token
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          participantName: guestName.trim(),
          isHost: false
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.token || !tokenData.serverUrl) {
        throw new Error('Live stream connect nahi ho payi.');
      }

      // Step 3: Connect to LiveKit Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true
      });

      // Handle subscribed track (Host's screen)
      room.on(RoomEvent.TrackSubscribed, (track, publication) => {
        if (track.kind === Track.Kind.Video) {
          currentTrackRef.current = track;
          if (videoRef.current) {
            track.attach(videoRef.current);
          }
          setHasLiveScreen(true);
        }
      });

      // Handle unsubscribed track
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          track.detach();
          currentTrackRef.current = null;
          setHasLiveScreen(false);
          setIsLandscapeFs(false);
        }
      });

      await room.connect(tokenData.serverUrl, tokenData.token);
      roomRef.current = room;

      // Check if host is already sharing screen
      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          if (pub.track && pub.track.kind === Track.Kind.Video) {
            currentTrackRef.current = pub.track;
            if (videoRef.current) {
              pub.track.attach(videoRef.current);
            }
            setHasLiveScreen(true);
          }
        }
      }

      setIsJoined(true);
    } catch (err) {
      setErrorMsg(err.message || 'Room join karne me error aaya');
    } finally {
      setLoading(false);
    }
  };

  // Re-attach video if element mounts/updates
  useEffect(() => {
    if (hasLiveScreen && currentTrackRef.current && videoRef.current) {
      currentTrackRef.current.attach(videoRef.current);
    }
  }, [hasLiveScreen, isLandscapeFs]);

  // Clean up on leave
  const handleExit = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsJoined(false);
    navigate('/');
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  // Toggle Landscape Fullscreen
  const toggleFullscreen = () => {
    setIsLandscapeFs(prev => !prev);
  };

  // Join Screen (Entry gate)
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-800/40">
              Live Workspace Hub
            </span>
            <h1 className="text-2xl font-black text-white">{sessionInfo?.title || 'Connect to Session'}</h1>
            <p className="text-xs text-slate-400">Room Code: <span className="font-mono text-indigo-400 font-bold">{roomCode?.toUpperCase()}</span></p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Aapka Naam</label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ex. Rahul Kumar"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {sessionInfo?.isProtected && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock size={12} className="text-amber-400" /> Room PIN
                </label>
                <input
                  type="password"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="4-digit PIN"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 tracking-widest text-center"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Join Workspace'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active Workspace Room
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 pb-20">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Connected</span>
            </div>
            <h2 className="text-lg font-extrabold text-white">{sessionInfo?.title || 'Live Workspace'}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchFiles()}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              title="Refresh Files"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition"
            >
              <LogOut size={14} /> Exit
            </button>
          </div>
        </div>

        {/* Live Host Screen Broadcast Section */}
        {hasLiveScreen ? (
          <div
            className={
              isLandscapeFs
                ? "fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden w-screen h-screen"
                : "bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative w-full flex flex-col"
            }
          >
            {/* Screen Wrapper with Force Landscape CSS Transform */}
            <div
              className={
                isLandscapeFs
                  ? "w-[100vh] h-[100vw] rotate-90 flex flex-col justify-center items-center relative"
                  : "w-full flex flex-col"
              }
            >
              {/* Header / Controls */}
              <div className="w-full bg-slate-900/90 px-4 py-2.5 flex items-center justify-between text-xs text-slate-200 border-b border-slate-800 shrink-0 z-10">
                <span className="flex items-center gap-2 font-bold text-red-400">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  Live Host Screen Broadcast
                </span>
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition shadow"
                >
                  {isLandscapeFs ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  {isLandscapeFs ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
              </div>

              {/* Video Element */}
              <div className="w-full flex-1 flex items-center justify-center bg-black overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={
                    isLandscapeFs
                      ? "w-full h-full object-contain"
                      : "w-full h-auto max-h-[75vh] object-contain bg-black"
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-8 text-center space-y-3">
            <Radio size={36} className="mx-auto text-indigo-400 animate-pulse" />
            <h3 className="text-base font-bold text-white">Screen Broadcast Offline</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Host ne abhi screen broadcast start nahi kiya hai. Jaise hi host screen share karega, stream yahan automatically live ho jayegi.
            </p>
          </div>
        )}

        {/* Uploaded Assets & Media Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Eye size={18} className="text-indigo-400" />
              Uploaded Assets & Media
            </h3>
            <span className="text-xs text-slate-400">{files.length} items</span>
          </div>

          {files.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              Abhi tak koi assets upload nahi hue hain.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {files.map((file) => (
                <div
                  key={file.id || file.url}
                  className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-800 transition"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-indigo-500/10 rounded-xl shrink-0">
                      {file.type === 'video' ? (
                        <Video size={18} className="text-rose-400" />
                      ) : (
                        <ImageIcon size={18} className="text-indigo-400" />
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {file.originalName || file.fileName}
                    </span>
                  </div>

                  <a
                    href={file.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-slate-700 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl transition shrink-0"
                    title="Download / View"
                  >
                    <Download size={15} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}