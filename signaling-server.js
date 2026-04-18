import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Neura Signaling Server',
    description: 'WebRTC Signaling Server for Rapid Intervention Team calls',
    connectedClients: io.engine.clientsCount
  });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Track connected admins (Android app) and kiosks separately
const rooms = {};

io.on('connection', (socket) => {
  console.log(`[Socket.io] New connection: ${socket.id}`);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);
    console.log(`[Room] ${socket.id} joined "${roomId}" | Members: ${rooms[roomId].length}`);

    // Notify others in the room that someone connected
    socket.to(roomId).emit('peer_connected', { peerId: socket.id });
  });

  // ── WebRTC Signaling Relay ─────────────────────────────────────────────────
  socket.on('offer', (data) => {
    console.log(`[Signaling] Offer from ${socket.id} → room: ${data.roomId}`);
    socket.to(data.roomId).emit('offer', data);
  });

  socket.on('answer', (data) => {
    console.log(`[Signaling] Answer from ${socket.id} → room: ${data.roomId}`);
    socket.to(data.roomId).emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', data);
  });

  // ── Call Status Events ──────────────────────────────────────────────────────
  socket.on('call_ended', (data) => {
    socket.to(data.roomId).emit('call_ended', data);
    console.log(`[Call] Ended in room: ${data.roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Disconnected: ${socket.id}`);
    // Clean up rooms
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🛰️  Neura Signaling Server running on port ${PORT}`);
});
