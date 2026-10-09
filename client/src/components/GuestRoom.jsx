import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Lock, Image as ImageIcon, Download, RefreshCw, 
  Maximize2, RotateCw, X, User, AlertOctagon, LogOut 
} from 'lucide-react';
import { io } from 'socket.io-client';

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export default function GuestRoom() {
  const { roomCode } = useParams();
  const [sessionInfo, setSessionInfo] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [files, setFiles] = useState([]);
  const [hasLiveScreen, setHasLiveScreen] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Lightbox & Rotate State
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [rotation, setRotation] = useState(0);

  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    fetchSessionInfo();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (peerRef.current) peerRef.current.close();
    };
  }, [roomCode]);

  const handleLeaveRoom = () => {
    if (socketRef.current) socketRef.current.disconnect();
    if (peerRef.current) peerRef.current.close();
    window.location.href = '/';
  };

  const initWebRTC = (name) => {
    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('join-room', { roomCode, isHost: false, guestName: name || 'Participant' });

    socketRef.current.on('kicked-out', () => {
      setKicked(true);
      if (peerRef.current) peerRef.current.close();
      if (videoRef.current) videoRef.current.srcObject = null;
    });

    socketRef.current.on('webrtc-offer', async ({ hostId, offer }) => {
      peerRef.current = new RTCPeerConnection(rtcConfig);

      peerRef.current.ontrack = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          setHasLiveScreen(true);
        }
      };

      peerRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit('ice-candidate', { targetId: hostId, candidate: event.candidate });
        }
      };

      await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socketRef.current.emit('webrtc-answer', { hostId, answer });
    });

    socketRef.current.on('ice-candidate', async ({ candidate }) => {
      if (peerRef.current && candidate) {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socketRef.current.on('screen-stopped', () => {
      if (videoRef.current) videoRef.current.srcObject = null;
      setHasLiveScreen(false);
    });
  };

  const fetchSessionInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/sessions/${roomCode}/info`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSessionInfo(data);
    } catch (err) {
      setError(err.message || 'Error loading session');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (enteredPin) => {
    try {
      const res = await fetch(`http://localhost:5000/api/sessions/${roomCode}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFiles(data.files);
      setIsUnlocked(true);
      setError('');
      initWebRTC(guestName);
    } catch (err) {
      setError(err.message || 'Incorrect PIN code');
    }
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError('Please enter your name');
      return;
    }
    loadFiles(pin);
  };

  const toggleFullscreen = () => {
    if (videoContainerRef.current) {
      if (!document.fullscreenElement) {
        videoContainerRef.current.requestFullscreen().catch(err => alert(err.message));
      } else {
        document.exitFullscreen();
      }
    }
  };

  if (kicked) {
    return (
      <div className="flex h-screen items-center justify-center p-4 bg-slate-50">
        <div className="bg-white p-8 rounded-3xl border border-red-200 text-center max-w-sm shadow-xl">
          <AlertOctagon size={44} className="mx-auto text-red-600 mb-3" />
          <h2 className="text-xl font-bold text-slate-800">Removed from Room</h2>
          <p className="text-xs text-slate-500 mt-2">The host has removed you from this workspace session.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-500 font-semibold">Connecting to Hub...</div>;
  }

  if (error && !sessionInfo) {
    return (
      <div className="flex h-screen items-center justify-center p-4 bg-slate-50">
        <div className="bg-white p-6 rounded-2xl shadow border border-red-100 text-center max-w-sm">
          <p className="text-red-600 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-indigo-600">Live Workspace Hub</span>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">{sessionInfo?.title}</h1>
          </div>
          
          {isUnlocked && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadFiles(pin)}
                className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-semibold transition"
              >
                <RefreshCw size={14} /> Refresh
              </button>
              <button
                onClick={handleLeaveRoom}
                className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-3.5 py-2 rounded-xl font-semibold border border-red-200 hover:border-red-600 transition duration-200"
              >
                <LogOut size={14} /> Exit
              </button>
            </div>
          )}
        </div>

        {/* Join Screen: Enter Name & PIN */}
        {!isUnlocked ? (
          <div className="max-w-sm mx-auto bg-white p-7 rounded-3xl border border-slate-200 shadow-md text-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <User size={22} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Join Workspace</h2>
            <p className="text-xs text-slate-400 mt-1 mb-5">Provide your identity to access live media</p>
            
            <form onSubmit={handleJoinSubmit} className="space-y-3.5 text-left">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-medium"
                />
              </div>

              {sessionInfo?.isProtected && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">4-Digit Security PIN</label>
                  <input
                    type="text"
                    maxLength="4"
                    placeholder="0000"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full text-center tracking-[0.4em] text-xl font-mono py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold"
                  />
                </div>
              )}

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <button
                type="submit"
                className="w-full mt-2 bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition shadow-md shadow-indigo-100"
              >
                Enter Hub
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Live Screen Video Element with Edge-to-Edge Fullscreen */}
            <div 
              ref={videoContainerRef}
              className={`bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative ${hasLiveScreen ? 'flex flex-col' : 'hidden'}`}
            >
              <div className="bg-slate-900/90 px-4 py-2.5 flex items-center justify-between text-xs text-slate-200 border-b border-slate-800 shrink-0">
                <span className="flex items-center gap-2 font-bold">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  Live Host Screen Broadcast
                </span>
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition"
                >
                  <Maximize2 size={14} /> Fullscreen
                </button>
              </div>
              
              <div className="w-full flex-1 flex items-center justify-center bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto max-h-[75vh] object-contain bg-black"
                />
              </div>
            </div>

            {/* Media Gallery Section */}
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <ImageIcon size={18} className="text-indigo-600" /> Uploaded Assets & Media
              </h2>
              {files.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
                  <ImageIcon className="mx-auto text-slate-300 mb-2" size={36} />
                  <p className="text-slate-600 text-sm font-medium">No assets uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {files.map((file) => (
                    <div 
                      key={file.id} 
                      onClick={() => { setSelectedMedia(file); setRotation(0); }}
                      className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm cursor-pointer"
                    >
                      {file.type === 'image' ? (
                        <img src={file.url} alt={file.originalName} className="w-full h-44 object-cover" />
                      ) : (
                        <video src={file.url} className="w-full h-44 object-cover bg-black" />
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition">
                        Open Preview
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Lightbox Modal with 90° Rotate & Download */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center">
            <div className="w-full flex justify-between items-center text-white mb-3">
              <span className="text-xs truncate max-w-[250px] font-medium">{selectedMedia.originalName}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition flex items-center gap-1.5 text-xs font-medium"
                >
                  <RotateCw size={14} /> Rotate
                </button>
                <a
                  href={selectedMedia.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                  title="Download"
                >
                  <Download size={15} />
                </a>
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="w-full h-[65vh] flex items-center justify-center overflow-hidden bg-black/50 rounded-xl">
              {selectedMedia.type === 'image' ? (
                <img
                  src={selectedMedia.url}
                  alt=""
                  style={{ transform: `rotate(${rotation}deg)` }}
                  className="max-h-full max-w-full object-contain transition-transform duration-300"
                />
              ) : (
                <video
                  src={selectedMedia.url}
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