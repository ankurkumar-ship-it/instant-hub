import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Room, Track } from 'livekit-client';
import { io } from 'socket.io-client';
import { 
  Share2, 
  Copy, 
  Check, 
  Tv, 
  Users, 
  FolderPlus, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Trash2, 
  LogOut 
} from 'lucide-react';

export default function StandeeCard({ sessionData, session, onReset }) {
  // sessionData ya session dono ko support karega
  const currentSession = sessionData || session || {};
  const roomCode = (currentSession.roomCode || currentSession.code || '').toLowerCase();

  const [copied, setCopied] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [participants, setParticipants] = useState([]);

  const roomRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);

  const shareUrl = currentSession.shareUrl || `${window.location.origin}/room/${roomCode}`;

  // 1. Socket.io Connection & Files load setup
  useEffect(() => {
    if (!roomCode) return;

    // Load initial files
    const loadFiles = async () => {
      try {
        const res = await fetch(`/api/sessions/${roomCode}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: currentSession.pin })
        });
        const data = await res.json();
        if (data.success) setFiles(data.files || []);
      } catch (err) {
        console.error('Files load error:', err);
      }
    };
    loadFiles();

    // Setup Socket.io for Host to see live participants
    const socket = io();
    socketRef.current = socket;

    socket.emit('join-room', {
      roomCode: roomCode,
      isHost: true
    });

    socket.on('participants-update', (list) => {
      setParticipants(list || []);
    });

    return () => {
      if (socket) socket.disconnect();
      if (roomRef.current) roomRef.current.disconnect();
    };
  }, [roomCode]);

  // Copy share URL handler
  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 2. Upload Files Handler
  const handleFileChange = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || !roomCode) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }

    try {
      const res = await fetch(`/api/sessions/${roomCode}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setFiles(prev => [...prev, ...data.files]);
      } else {
        alert('File upload nahi ho saki');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 3. Kick Participant
  const handleKick = (guestId) => {
    if (socketRef.current && roomCode) {
      socketRef.current.emit('kick-participant', { roomCode, guestId });
    }
  };

  // 4. LiveKit Screen Share Toggle (Ultra-low Latency, 50+ Peers)
  const handleToggleScreenShare = async () => {
    if (isSharingScreen) {
      if (roomRef.current) {
        await roomRef.current.localParticipant.setScreenShareEnabled(false);
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
      setIsSharingScreen(false);
      return;
    }

    if (!roomCode) {
      alert('Room Code nahi mila! Kripya page refresh karke dobara create karein.');
      return;
    }

    try {
      // Step A: Token API request
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: roomCode,
          participantName: 'Host-Presenter',
          isHost: true
        })
      });

      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Token generate nahi ho paya');
      }

      // Step B: LiveKit connect
      const room = new Room({
        adaptiveStream: true,
        dynacast: true
      });

      await room.connect(data.serverUrl, data.token);
      roomRef.current = room;

      // Step C: Publish Screen
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: true
      });

      // Browser ke stop floating button ko capture karna
      for (const pub of room.localParticipant.videoTrackPublications.values()) {
        if (pub.source === Track.Source.ScreenShare && pub.track) {
          pub.track.mediaStreamTrack.onended = async () => {
            await handleToggleScreenShare();
          };
        }
      }

      setIsSharingScreen(true);
    } catch (err) {
      console.error('Screen sharing error:', err);
      alert('Screen share shuru nahi ho paya ya cancel kar diya gaya.');
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
      setIsSharingScreen(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Banner & Screen Broadcast Trigger */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-semibold rounded-full border border-indigo-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LiveKit High Capacity Hub (50+ Peers)
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {currentSession?.title || 'Interactive Hub'}
          </h2>
          <p className="text-sm text-slate-400 max-w-md">
            Scan QR code or use the room code to join instantly with full real-time screen broadcast and asset sync.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleScreenShare}
            className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg ${
              isSharingScreen
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25 ring-4 ring-red-500/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            <Tv size={18} />
            {isSharingScreen ? 'Stop Screen Sharing' : 'Start Sharing My Screen'}
          </button>

          {onReset && (
            <button
              onClick={onReset}
              className="p-3 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-2xl transition"
              title="Close Hub"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: QR Code Standee */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center text-center space-y-5 shadow-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-800/40">
            Instant Scan & View
          </span>

          <div className="p-4 bg-white rounded-2xl shadow-inner flex items-center justify-center">
            <QRCode value={shareUrl} size={180} />
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-300 font-mono">
            <div>
              <p className="text-slate-500 uppercase text-[10px] tracking-wider">Room</p>
              <p className="font-bold text-sm text-white">{roomCode ? roomCode.toUpperCase() : '...'}</p>
            </div>
            {currentSession?.pin && (
              <div>
                <p className="text-slate-500 uppercase text-[10px] tracking-wider">Pin Code</p>
                <p className="font-bold text-sm text-indigo-400">{currentSession.pin}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-4 rounded-xl text-xs font-medium transition"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? 'Link Copied!' : 'Copy Share Link'}
          </button>
        </div>

        {/* Right Column: Files & Participants */}
        <div className="md:col-span-2 space-y-6">
          {/* File Upload & Assets List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText size={18} className="text-indigo-400" />
                  Presentation Assets & Files
                </h3>
                <p className="text-xs text-slate-400">Upload images or videos for viewers</p>
              </div>
              <div>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,video/*"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-xl text-xs font-semibold transition"
                >
                  <FolderPlus size={16} />
                  {isUploading ? 'Uploading...' : 'Upload Files'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-56 overflow-y-auto pr-1">
              {files.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                  No assets uploaded yet. Upload files to share with viewers.
                </div>
              ) : (
                files.map((file) => (
                  <a
                    key={file.id || file.url}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center gap-2.5 hover:bg-slate-800 transition text-slate-200 text-xs truncate"
                  >
                    {file.type === 'video' ? (
                      <Video size={16} className="text-rose-400 shrink-0" />
                    ) : (
                      <ImageIcon size={16} className="text-indigo-400 shrink-0" />
                    )}
                    <span className="truncate">{file.originalName || file.fileName}</span>
                  </a>
                ))
              )}
            </div>
          </div>

          {/* Active Participants List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-emerald-400" />
                Live Participants ({participants.length})
              </h3>
            </div>

            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
              {participants.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">Waiting for attendees to connect...</p>
              ) : (
                participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-200"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{p.name}</span>
                    <button
                      onClick={() => handleKick(p.id)}
                      className="text-slate-500 hover:text-red-400 ml-1 transition"
                      title="Remove attendee"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
