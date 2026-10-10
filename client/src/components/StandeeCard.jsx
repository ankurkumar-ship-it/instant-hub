import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Room, Track } from 'livekit-client';
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
  ShieldAlert 
} from 'lucide-react';

export default function StandeeCard({ 
  session, 
  files = [], 
  participants = [], 
  onUploadFiles, 
  onKickParticipant 
}) {
  const [copied, setCopied] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // LiveKit Room instance reference
  const roomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Clean up LiveKit room on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  // Copy share URL handler
  const handleCopy = () => {
    if (session?.shareUrl) {
      navigator.clipboard.writeText(session.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // LiveKit Screen Share Toggle (50+ participants support)
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

    try {
      // Step 1: Fetch LiveKit Host Token from backend
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: session.code || session.roomCode,
          participantName: 'Host-Presenter',
          isHost: true
        })
      });

      const data = await res.json();
      if (!data.token || !data.serverUrl) {
        throw new Error('Token generate nahi ho paya');
      }

      // Step 2: Initialize & connect LiveKit Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          simulcast: true,
          screenShareEncoding: {
            maxBitrate: 1500000,
            maxFramerate: 24
          }
        }
      });

      await room.connect(data.serverUrl, data.token);
      roomRef.current = room;

      // Step 3: Trigger screen share with system audio
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: true,
        resolution: { width: 1920, height: 1080, frameRate: 24 }
      });

      // Handle user stopping screen share via browser's floating bar
      const tracks = room.localParticipant.getTrackPublications();
      for (const pub of tracks) {
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

  // Upload handler
  const handleFileChange = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setIsUploading(true);
    try {
      await onUploadFiles(selectedFiles);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const roomCode = session?.code || session?.roomCode || '';
  const shareUrl = session?.shareUrl || `https://instant-hub-server.onrender.com/room/${roomCode}`;

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
            {session?.title || 'Interactive Hub'}
          </h2>
          <p className="text-sm text-slate-400 max-w-md">
            Scan QR code or use the room code to join instantly with full real-time screen broadcast and asset sync.
          </p>
        </div>

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
              <p className="font-bold text-sm text-white">{roomCode.toUpperCase()}</p>
            </div>
            {session?.pin && (
              <div>
                <p className="text-slate-500 uppercase text-[10px] tracking-wider">Pin Code</p>
                <p className="font-bold text-sm text-indigo-400">{session.pin}</p>
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

        {/* Right Column (2 cols): Media Assets & Participants */}
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
                    {onKickParticipant && (
                      <button
                        onClick={() => onKickParticipant(p.id)}
                        className="text-slate-500 hover:text-red-400 ml-1 transition"
                        title="Remove attendee"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
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