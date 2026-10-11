import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';
import { io } from 'socket.io-client';
import { Maximize2, Minimize2, Download, Image as ImageIcon, Video, User } from 'lucide-react';

export default function GuestRoom() {
  const { roomCode } = useParams();
  const cleanRoom = (roomCode || '').toLowerCase();

  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [files, setFiles] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const videoContainerRef = useRef(null);
  const videoElementRef = useRef(null);
  const roomRef = useRef(null);
  const socketRef = useRef(null);

  // 1. Join Form Submit
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setErrorMsg('');

      // Step A: Token fetch karein
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
        throw new Error(data.error || 'Token fetch fail ho gaya');
      }

      // Step B: Socket.io se host ko apna naam bhejein
      const socket = io();
      socketRef.current = socket;

      socket.emit('join-room', {
        roomCode: cleanRoom,
        isHost: false,
        guestName: name.trim()
      });

      // Host agar remove kare
      socket.on('kicked-out', () => {
        alert('Host ne aapko room se remove kar diya hai.');
        window.location.href = '/';
      });

      // Step C: LiveKit Stream Connect
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Video && videoElementRef.current) {
          track.attach(videoElementRef.current);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });

      await room.connect(data.serverUrl, data.token);

      // Agar screen track pehle se share ho raha ho
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.track && pub.track.kind === Track.Kind.Video && videoElementRef.current) {
            pub.track.attach(videoElementRef.current);
          }
        });
      });

      // Files load karein
      const fileRes = await fetch(`/api/sessions/${cleanRoom}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const fileData = await fileRes.json();
      if (fileData.success) setFiles(fileData.files || []);

      setJoined(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Room join karne me error');
    }
  };

  // 2. Google Meet jaisa Real Fullscreen Toggle
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

  // Download Handler
  const handleDownload = async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(fileUrl, '_blank');
    }
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form onSubmit={handleJoin} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Join Workspace</span>
            <h2 className="text-2xl font-bold text-white">Room: {cleanRoom.toUpperCase()}</h2>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Aapka Naam</label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-600/30 text-sm"
          >
            Join Workspace
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 space-y-4">
      {/* Google Meet Style Video Player */}
      <div
        ref={videoContainerRef}
        className={`relative w-full bg-black rounded-3xl overflow-hidden flex items-center justify-center border border-slate-800 ${
          isFullscreen ? 'w-screen h-screen rounded-none border-none' : 'aspect-video max-h-[70vh]'
        }`}
      >
        <video
          ref={videoElementRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />

        {/* Top Controls Overlay */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-xl backdrop-blur-md transition shadow-lg"
            title="Google Meet Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        {/* Screen Watermark */}
        <div className="absolute bottom-4 left-4 z-30 pointer-events-none">
          <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-[11px] text-slate-300 rounded-full border border-white/10">
            Live Stream • {cleanRoom.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Files Section */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
        <h3 className="text-base font-bold text-slate-200">Shared Files & Assets</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
          {files.length === 0 ? (
            <p className="text-xs text-slate-500 col-span-full">Abhi tak koi file share nahi ki gayi hai.</p>
          ) : (
            files.map((file) => (
              <div key={file.id || file.url} className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 truncate">
                  {file.type === 'video' ? <Video size={16} className="text-rose-400 shrink-0" /> : <ImageIcon size={16} className="text-indigo-400 shrink-0" />}
                  <span className="truncate">{file.originalName || file.fileName}</span>
                </div>
                <button
                  onClick={() => handleDownload(file.url, file.originalName || file.fileName)}
                  className="p-1.5 bg-slate-700 hover:bg-indigo-600 text-white rounded-lg transition shrink-0"
                >
                  <Download size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}