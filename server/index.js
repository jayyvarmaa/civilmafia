const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

// Helper to generate 8-character alphanumeric code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// --- REST Endpoints ---

// Create Room — also auto-adds the host as a player
app.post('/api/rooms', async (req, res) => {
  const { host_id, host_name } = req.body;
  console.log(`[API] POST /api/rooms — host_id: ${host_id}, host_name: ${host_name}`);
  try {
    const roomCode = generateRoomCode();
    
    // Create the room
    await pool.query(
      `INSERT INTO rooms (room_code, host_id, phase) VALUES ($1, $2, $3)`,
      [roomCode, host_id, 'lobby']
    );
    console.log(`[API] Room ${roomCode} created in DB`);

    // Auto-add host as the first player (upsert in case they were in a previous room)
    await pool.query(
      `INSERT INTO players (player_id, room_code, name, is_host) VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id) DO UPDATE SET room_code = $2, name = $3, is_host = $4`,
      [host_id, roomCode, host_name || 'Host', true]
    );
    console.log(`[API] Host ${host_id} added as player in room ${roomCode}`);

    res.json({ roomCode });
  } catch (error) {
    console.error('[API] Error creating room:', error.message);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join Room — auto-detects if the player is the host
app.post('/api/rooms/:code/join', async (req, res) => {
  const roomCode = req.params.code.toUpperCase();
  const { player_id, name } = req.body;
  console.log(`[API] POST /api/rooms/${roomCode}/join — player_id: ${player_id}, name: ${name}`);
  try {
    const roomRes = await pool.query(`SELECT * FROM rooms WHERE room_code = $1`, [roomCode]);
    if (roomRes.rows.length === 0) {
      console.log(`[API] Room ${roomCode} not found`);
      return res.status(404).json({ error: 'Room not found' });
    }

    // Auto-detect if this player is the host
    const isHost = roomRes.rows[0].host_id === player_id;
    console.log(`[API] Player ${player_id} isHost: ${isHost}`);

    // Upsert player
    await pool.query(
      `INSERT INTO players (player_id, room_code, name, is_host) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (player_id) DO UPDATE SET room_code = $2, name = $3, is_host = $4`,
      [player_id, roomCode, name, isHost]
    );
    console.log(`[API] Player ${player_id} (${name}) joined room ${roomCode}`);

    res.json({ success: true, roomCode });
  } catch (error) {
    console.error('[API] Error joining room:', error.message);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// --- Socket.io Events ---

const broadcastRoomState = async (roomCode) => {
  try {
    const roomRes = await pool.query(`SELECT * FROM rooms WHERE room_code = $1`, [roomCode]);
    if (roomRes.rows.length === 0) return;
    
    const playersRes = await pool.query(`SELECT * FROM players WHERE room_code = $1 ORDER BY joined_at ASC`, [roomCode]);
    
    // Map players to object keyed by player_id
    const players = {};
    playersRes.rows.forEach(p => {
      players[p.player_id] = {
        name: p.name,
        isHost: p.is_host,
        role: p.role,
        isAlive: p.is_alive,
        hasVoted: p.has_voted,
        votedFor: p.voted_for
      };
    });

    const state = {
      ...roomRes.rows[0],
      players
    };

    console.log(`[SOCKET] Broadcasting room state for ${roomCode} — ${playersRes.rows.length} players`);
    io.to(roomCode).emit('roomStateUpdate', state);
  } catch (error) {
    console.error('[SOCKET] Error broadcasting state:', error.message);
  }
};

io.on('connection', (socket) => {
  console.log(`[SOCKET] New connection: ${socket.id}`);

  socket.on('join_room', async ({ roomCode, playerId }) => {
    console.log(`[SOCKET] ${playerId} joining socket room ${roomCode}`);
    socket.join(roomCode);
    socket.playerId = playerId;
    socket.roomCode = roomCode;
    
    // Broadcast initial state
    await broadcastRoomState(roomCode);
  });

  socket.on('update_settings', async ({ roomCode, settings }) => {
    console.log(`[SOCKET] Updating settings for room ${roomCode}`);
    await pool.query(`UPDATE rooms SET settings = $1 WHERE room_code = $2`, [settings, roomCode]);
    await broadcastRoomState(roomCode);
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Disconnected: ${socket.id} (player: ${socket.playerId})`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
