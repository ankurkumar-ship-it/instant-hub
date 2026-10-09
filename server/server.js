import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { nanoid, customAlphabet } from 'nanoid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

// Uploads directory configuration with CORS & Cross-Origin-Resource-Policy headers
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${nanoid(6)}${ext}`);
  }
});
const upload = multer({ storage });

const generateRoomCode = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 6);
const generatePin = customAlphabet('0123456789', 4);

const sessions = new Map();
const sessionFiles = new Map();
const roomParticipants = new Map();

// Helper to determine server base URL dynamically
const getBaseUrl = (req) => {
  return `${req.protocol}://${req.get('host')}`;
};

// Root Health Check Route
app.get('/', (req, res) => {
  res.send('Instant Hub Server is running live!');
});

// Create Session API
app.post('/api/sessions/create', (req, res) => {
  const { title, durationHours = 4, requirePin = false } = req.body;
  const roomCode = generateRoomCode();
  const hostSecret = nanoid(32);
  const pin = requirePin ? generatePin() : null;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  const sessionData = {
    code: roomCode,
    title: title || 'Workspace Hub',
    hostSecret,
    pin,
    isProtected: requirePin,
    expiresAt,
    createdAt: new Date()
  };

  sessions.set(roomCode, sessionData);
  sessionFiles.set(roomCode, []);
  roomParticipants.set(roomCode, new Map());

  res.status(201).json({
    success: true,
    roomCode,
    hostSecret,
    pin,
    expiresAt,
    shareUrl: `https://reliable-crostata-0193c7.netlify.app/room/${roomCode}`
  });
});

// Info API
app.get('/api/sessions/:roomCode/info', (req, res) => {
  const roomCode = req.params.roomCode.toLowerCase();
  const session = sessions.get(roomCode);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (new Date() > new Date(session.expiresAt)) {
    sessions.delete(roomCode);
    sessionFiles.delete(roomCode);
    roomParticipants.delete(roomCode);
    return res.status(410).json({ error: 'Session has expired' });
  }
  res.json({
    title: session.title,
    isProtected: session.isProtected,
    expiresAt: session.expiresAt
  });
});

// Upload API
app.post('/api/sessions/:roomCode/upload', upload.array('files', 20), (req, res) => {
  const roomCode = req.params.roomCode.toLowerCase();
  const session = sessions.get(roomCode);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const baseUrl = getBaseUrl(req);
  const uploaded = (req.files || []).map(file => ({
    id: nanoid(8),
    originalName: file.originalname,
    fileName: file.filename,
    url: `${baseUrl}/uploads/${file.filename}`,
    type: file.mimetype.startsWith('video/') ? 'video' : 'image',
    uploadedAt: new Date()
  }));

  const existingFiles = sessionFiles.get(roomCode) || [];
  sessionFiles.set(roomCode, [...existingFiles, ...uploaded]);

  res.json({ success: true, files: uploaded });
});

// Get Files API
app.post('/api/sessions/:roomCode/files', (req, res) => {
  const roomCode = req.params.roomCode.toLowerCase();
  const { pin } = req.body;
  const session = sessions.get(roomCode);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.isProtected && session.pin !== pin) {
    return res.status(401).json({ error: 'Invalid PIN Code' });
  }
  const files = sessionFiles.get(roomCode) || [];
  res.json({ success: true, files });
});

// Socket.io WebRTC & Live Participant Hub
io.on('connection', (socket) => {
  socket.on('join-room', ({ roomCode, isHost, guestName }) => {
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.isHost = isHost;

    if (!isHost) {
      const name = (guestName || 'Guest User').trim();
      socket.data.name = name;

      let participants = roomParticipants.get(roomCode);
      if (!participants) {
        participants = new Map();
        roomParticipants.set(roomCode, participants);
      }

      for (const [sId, p] of participants.entries()) {
        if (p.name.toLowerCase() === name.toLowerCase()) {
          participants.delete(sId);
        }
      }

      participants.set(socket.id, { id: socket.id, name });

      const list = Array.from(participants.values());
      io.to(roomCode).emit('participants-update', list);
      socket.to(roomCode).emit('guest-joined', { guestId: socket.id, guestName: name });
    }
  });

  socket.on('kick-participant', ({ roomCode, guestId }) => {
    io.to(guestId).emit('kicked-out');
    const participants = roomParticipants.get(roomCode);
    if (participants) {
      participants.delete(guestId);
      io.to(roomCode).emit('participants-update', Array.from(participants.values()));
    }
  });

  socket.on('webrtc-offer', ({ guestId, offer }) => {
    io.to(guestId).emit('webrtc-offer', { hostId: socket.id, offer });
  });

  socket.on('webrtc-answer', ({ hostId, answer }) => {
    io.to(hostId).emit('webrtc-answer', { guestId: socket.id, answer });
  });

  socket.on('ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('ice-candidate', { candidate });
  });

  socket.on('screen-stopped', ({ roomCode }) => {
    socket.to(roomCode).emit('screen-stopped');
  });

  socket.on('disconnect', () => {
    const { roomCode, isHost } = socket.data;
    if (roomCode && !isHost) {
      const participants = roomParticipants.get(roomCode);
      if (participants) {
        participants.delete(socket.id);
        io.to(roomCode).emit('participants-update', Array.from(participants.values()));
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
