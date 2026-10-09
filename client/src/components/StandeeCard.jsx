import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Printer, Copy, Check, ArrowLeft, Upload, CheckCircle2, 
  Monitor, StopCircle, Users, UserX, RotateCw, X, Download, Eye
} from 'lucide-react';
import { io } from 'socket.io-client';

const BACKEND_URL = 'https://instant-hub-server.onrender.com';

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export default function StandeeCard({ sessionData, onReset }) {
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeMedia, setActiveMedia] = useState(null);
  const [rotation, setRotation] = useState(0);

  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const peersRef = useRef({});

  useEffect(() => {
    fetchFiles();

    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.emit('join-room', { roomCode: sessionData.roomCode, isHost: true });

    socket.on('participants-update', (list) => {
      setParticipants(list);
    });

    socket.on('guest-joined', async ({ guestId }) => {
      if (!streamRef.current) return;
      const peer = new RTCPeerConnection(rtcConfig);
      peersRef.current[guestId] = peer;

      streamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, streamRef.current);
      });

      peer.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('ice-candidate', { targetId: guestId, candidate: event.candidate });
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('webrtc-offer', { guestId, offer });
    });

    socket.on('webrtc-answer', async ({ guestId, answer }) => {
      const peer = peersRef.current[guestId];
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      Object.values(peersRef.current).forEach((p) => {
        if (p && candidate) p.addIceCandidate(new RTCIceCandidate(candidate));
      });
    });

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [sessionData.roomCode]);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionData.roomCode}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionData.pin }),
      });
      const data = await res.json();
      if (data.files) setUploadedFiles(data.files);
    } catch (e) {
      console.error('File fetch error:', e);
    }
  };

  const kickGuest = (guestId) => {
    if (socketRef.current) {
      socketRef.current.emit('kick-participant', { roomCode: sessionData.roomCode, guestId });
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      setIsSharing(true);

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error('Screen sharing error:', err);
    }
  };

  const stopScreenShare = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    Object.values(peersRef.current).forEach((p) => p.close());
    peersRef.current = {};
    setIsSharing(false);
    if (socketRef.current) {
      socketRef.current.emit('screen-stopped', { roomCode: sessionData.roomCode });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sessionData.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionData.roomCode}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        fetchFiles();
      }
    } catch (err) {
      alert('Upload failed: Server connection issue');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-5">
      {/* Top Controls */}
      <div className="flex gap-2 print:hidden">
        <button
          onClick={onReset}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
          title="Back to Setup"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={() => window.print()}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl font-semibold transition shadow-md shadow-indigo-100"
        >
          <Printer size={18} /> Print Standee
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 px-4 rounded-xl font-medium transition"
        >
          {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
          {copied ? 'Copied' : 'Copy URL'}
        </button>
      </div>

      {/* Printable Standee Card */}
      <div className="print-area bg-white border border-slate-200/90 rounded-3xl p-8 text-center shadow-lg">
        <span className="text-[11px] uppercase tracking-widest font-extrabold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full">
          Instant Scan & View
        </span>
        
        <h2 className="text-2xl font-black text-slate-800 mt-4 tracking-tight">
          {sessionData.title}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Scan with any mobile camera to view presentation and assets
        </p>

        <div className="inline-block p-4 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner my-5">
          <QRCodeSVG
            value={sessionData.shareUrl}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="pt-4 border-t border-dashed border-slate-200 flex justify-center gap-8">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Room</p>
            <p className="text-sm font-extrabold text-slate-900 font-mono tracking-wide">{sessionData.roomCode.toUpperCase()}</p>
          </div>
          {sessionData.pin && (
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PIN Code</p>
              <p className="text-sm font-extrabold text-indigo-600 font-mono tracking-wide">{sessionData.pin}</p>
            </div>
          )}
        </div>

        <p className="text-[10px] text-slate-400 mt-4">
          No app download required • Direct browser access
        </p>
      </div>

      {/* Live Connected Viewers & Kick Controller */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm print:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Connected Viewers</h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
            {participants.length} Active
          </span>
        </div>

        {participants.length === 0 ? (
          <p className="text-xs text-slate-400">Waiting for participants to scan or join...</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {participants.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <span className="font-semibold text-slate-800">{user.name}</span>
                <button
                  onClick={() => kickGuest(user.id)}
                  className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition"
                >
                  <UserX size={13} /> Kick
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Screen Sharing Control */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm print:hidden">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Live Screen Share</h3>
        {!isSharing ? (
          <button
            onClick={startScreenShare}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition shadow"
          >
            <Monitor size={18} /> Start Sharing My Screen
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 px-4 py-2.5 rounded-xl text-xs font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                Screen is Live
              </span>
              <span>All viewers can view</span>
            </div>
            <button
              onClick={stopScreenShare}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition"
            >
              <StopCircle size={18} /> Stop Sharing
            </button>
          </div>
        )}
      </div>

      {/* Host Upload Area & Real-time Uploaded Preview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm print:hidden">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Upload Assets (Images & Videos)</h3>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-xl p-4 cursor-pointer hover:bg-indigo-50/50 transition mb-4">
          <Upload className="text-indigo-600 mb-1" size={24} />
          <span className="text-xs font-semibold text-indigo-600">
            {uploading ? 'Uploading Files...' : 'Click to Upload Images or Videos'}
          </span>
          <span className="text-[11px] text-slate-400">Multiple files supported</span>
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>

        {/* Host File Previews */}
        {uploadedFiles.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-600 mb-2">Uploaded Assets ({uploadedFiles.length}):</h4>
            <div className="grid grid-cols-4 gap-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => { setActiveMedia(file); setRotation(0); }}
                  className="group relative h-20 rounded-lg overflow-hidden border border-slate-200 cursor-pointer bg-slate-100"
                >
                  {file.type === 'image' ? (
                    <img src={file.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white text-[10px]">Video</div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                    <Eye size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Media Lightbox with Rotate Tool */}
      {activeMedia && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center">
            <div className="w-full flex justify-between items-center text-white mb-3">
              <span className="text-xs truncate max-w-[200px]">{activeMedia.originalName}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition flex items-center gap-1 text-xs"
                >
                  <RotateCw size={14} /> Rotate
                </button>
                <a
                  href={activeMedia.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                >
                  <Download size={14} />
                </a>
                <button
                  onClick={() => setActiveMedia(null)}
                  className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="w-full h-[60vh] flex items-center justify-center overflow-hidden bg-black/50 rounded-xl">
              {activeMedia.type === 'image' ? (
                <img
                  src={activeMedia.url}
                  alt=""
                  style={{ transform: `rotate(${rotation}deg)` }}
                  className="max-h-full max-w-full object-contain transition-transform duration-300"
                />
              ) : (
                <video
                  src={activeMedia.url}
                  controls
                  style={{ transform: `rotate(${rotation}deg)` }}
                  className="max-h-full max-w-full object-contain transition-transform duration-300"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
