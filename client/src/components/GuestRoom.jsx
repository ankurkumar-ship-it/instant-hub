import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';
import { io } from 'socket.io-client';
import { 
  Maximize2, 
  Minimize2, 
  Download, 
  ImageIcon, 
  Video, 
  Radio, 
  ShieldCheck, 
  ArrowLeft,
  Sparkles,
  FileDown,
  Monitor
} from 'lucide-react';

export default function GuestRoom() {
  const { roomCode } = useParams();
  const cleanRoom = (roomCode || '').toLowerCase();

  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [files, setFiles] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasActiveStream, setHasActiveStream] = useState(false);

  const videoContainerRef = useRef(null);
  const videoElementRef = useRef(null);
  const roomRef = useRef(null);
  const socketRef = useRef(null);

  // 1. Join Workspace Session
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setErrorMsg('');

      // Step A: Request LiveKit Participant Token
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: cleanRoom,
          participantName: name.trim(),
          isHost: false
        })
      });

      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Failed to authenticate workspace token');
      }

      // Step B: Socket.io Participant Sync
      const socket = io();
      socketRef.current = socket;

      socket.emit('join-room', {
        roomCode: cleanRoom,
        isHost: false,
        guestName: name.trim()
      });

      socket.on('kicked-out', () => {
        alert('You have been removed from this session by the host.');
        window.location.href = '/';
      });

      // Step C: High-Fidelity LiveKit Room Initialization
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && videoElementRef.current) {
          track.attach(videoElementRef.current);
          setHasActiveStream(true);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        setHasActiveStream(false);
      });

      await room.connect(data.serverUrl, data.token);

      // Check existing published tracks
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.track && publication.track.kind === Track.Kind.Video && videoElementRef.current) {
            publication.track.attach(videoElementRef.current);
            setHasActiveStream(true);
          }
        });
      });

      // Step D: Fetch Shared Assets
      const fileRes = await fetch(`/api/sessions/${cleanRoom}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const fileData = await fileRes.json();
      if (fileData.success) {
        setFiles(fileData.files || []);
      }

      setJoined(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Unable to connect to the session. Please check your network.');
    }
  };

  // 2. Fullscreen Toggle (Google Meet Landscape Fit)
  const toggleFullscreen = () => {
    const elem = videoContainerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      if (roomRef.current) roomRef.current.disconnect();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // 3. Asset Download Handler
  const handleDownload = async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'presentation-asset';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(fileUrl, '_blank');
    }
  };

  // Join Modal Screen
  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition">
              <ArrowLeft size={16} />
              Home
            </Link>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold">
              <Radio size={12} className="animate-pulse" />
              Room: {cleanRoom.toUpperCase()}
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Join Workspace</h2>
            <p className="text-xs font-medium text-slate-500">
              Enter your name to connect to this live presentation room.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Your Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-medium bg-slate-50/50 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 text-sm"
            >
              <Sparkles size={16} />
              Join Workspace Now
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs pt-1">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Encrypted Live Stream • 1080p Ultra HD</span>
          </div>
        </div>
      </div>
    );
  }

  // Active Presentation View (White Workspace + Mobile Window Display)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl space-y-6">

        {/* Top Room Information Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Monitor size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Live Broadcast Window
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Room: <span className="font-bold text-slate-700 font-mono">{cleanRoom.toUpperCase()}</span> • Viewer: {name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl text-xs font-bold transition shadow-md"
            >
              <Maximize2 size={15} />
              Fullscreen View
            </button>
          </div>
        </div>

        {/* Native Mobile Window Frame Container */}
        <div
          ref={videoContainerRef}
          className={`relative bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col justify-center items-center ${
            isFullscreen ? 'w-screen h-screen rounded-none border-none' : 'w-full aspect-[16/9] min-h-[360px] max-h-[75vh]'
          }`}
        >
          {/* Stream Overlay Status Header */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-white text-xs font-medium">
              <span className={`w-2 h-2 rounded-full ${hasActiveStream ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {hasActiveStream ? 'Crisp Screen Share Active' : 'Waiting for Host Screen...'}
            </div>

            <button
              onClick={toggleFullscreen}
              className="pointer-events-auto p-2 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-xl backdrop-blur-md transition shadow-md border border-white/10"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>

          {/* High-Fidelity Video Surface */}
          <video
            ref={videoElementRef}
            autoPlay
            playsInline
            muted
            style={{
              imageRendering: '-webkit-optimize-contrast',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden'
            }}
            className="w-full h-full object-contain select-none"
          />

          {/* Waiting Placeholder */}
          {!hasActiveStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10 bg-slate-950/90 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Radio size={26} className="animate-pulse" />
              </div>
              <p className="text-white text-sm font-semibold tracking-wide">
                Waiting for host to start screen broadcast
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                As soon as the presenter shares their screen, it will automatically render here in high definition.
              </p>
            </div>
          )}
        </div>

        {/* Shared Files & Presentation Assets */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileDown size={18} className="text-indigo-600" />
                Session Assets & Downloads
              </h2>
              <p className="text-xs text-slate-500">Tap to download files uploaded by the presenter</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
              {files.length} Files
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-64 overflow-y-auto pr-1">
            {files.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400 text-xs">
                No files or slides shared yet for this session.
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id || file.url}
                  className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-100/80 transition"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {file.type === 'video' ? (
                      <Video size={18} className="text-rose-500 shrink-0" />
                    ) : (
                      <ImageIcon size={18} className="text-indigo-500 shrink-0" />
                    )}
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {file.originalName || file.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {file.type}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(file.url, file.originalName || file.fileName)}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition shrink-0"
                    title="Download asset"
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
