const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'] // keep both but frontend can prefer websocket
});

// --- IN-MEMORY DATA STORE ---
const db = {
  rooms: new Map(),
  players: new Map(), // Map of roomCode -> Map of playerId -> player object
  history: new Map()  // Map of roomCode -> Array of history objects
};

// Map to track active timers for rooms
const activeTimers = new Map();

// Helper to generate 8-character alphanumeric code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Cryptographically secure shuffle
const secureShuffle = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomBuf = crypto.randomBytes(4);
    const randomVal = randomBuf.readUInt32BE(0);
    const j = randomVal % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Tie-breaker
const resolveTiedVote = (tiedPlayerIds) => {
  if (tiedPlayerIds.length === 0) return null;
  const randomBuf = crypto.randomBytes(4);
  const randomVal = randomBuf.readUInt32BE(0);
  const index = randomVal % tiedPlayerIds.length;
  return tiedPlayerIds[index];
};

// Clear active timer for a room
const clearRoomTimer = (roomCode) => {
  if (activeTimers.has(roomCode)) {
    clearTimeout(activeTimers.get(roomCode));
    activeTimers.delete(roomCode);
  }
};

// Ensure room map structures exist
const initRoomStorage = (roomCode) => {
  if (!db.players.has(roomCode)) db.players.set(roomCode, new Map());
  if (!db.history.has(roomCode)) db.history.set(roomCode, []);
};

// --- REST Endpoints ---

// Create Room
app.post('/api/rooms', (req, res) => {
  const { host_id, host_name } = req.body;
  const roomCode = generateRoomCode();
  
  // Create the room
  db.rooms.set(roomCode, {
    room_code: roomCode,
    host_id,
    phase: 'lobby',
    current_round: 0,
    winner: null,
    settings: {},
    created_at: Date.now()
  });

  initRoomStorage(roomCode);

  // Auto-add host as player
  db.players.get(roomCode).set(host_id, {
    player_id: host_id,
    name: host_name || 'Host',
    is_host: true,
    role: null,
    is_alive: true,
    has_voted: false,
    voted_for: null,
    joined_at: Date.now()
  });

  res.json({ roomCode });
});

// Join Room
app.post('/api/rooms/:code/join', (req, res) => {
  const roomCode = req.params.code.toUpperCase();
  const { player_id, name } = req.body;
  
  if (!db.rooms.has(roomCode)) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const room = db.rooms.get(roomCode);
  const isHost = room.host_id === player_id;

  initRoomStorage(roomCode);
  
  const roomPlayers = db.players.get(roomCode);
  if (!roomPlayers.has(player_id)) {
    roomPlayers.set(player_id, {
      player_id: player_id,
      name: name,
      is_host: isHost,
      role: null,
      is_alive: true,
      has_voted: false,
      voted_for: null,
      joined_at: Date.now()
    });
  } else {
    // Update existing player name
    const p = roomPlayers.get(player_id);
    p.name = name;
    p.is_host = isHost;
  }

  res.json({ success: true, roomCode });
});

// --- Socket.io Events & Helpers ---

const broadcastRoomState = (roomCode) => {
  if (!db.rooms.has(roomCode)) return;
  const room = db.rooms.get(roomCode);
  const roomPlayers = db.players.get(roomCode);
  const history = db.history.get(roomCode);

  const playersObj = {};
  if (roomPlayers) {
    const sortedPlayers = Array.from(roomPlayers.values()).sort((a, b) => a.joined_at - b.joined_at);
    sortedPlayers.forEach(p => {
      playersObj[p.player_id] = {
        player_id: p.player_id,
        name: p.name,
        isHost: p.is_host,
        role: p.role,
        isAlive: p.is_alive,
        hasVoted: p.has_voted,
        votedFor: p.voted_for
      };
    });
  }

  const state = {
    ...room,
    players: playersObj,
    eliminationHistory: history || []
  };

  io.to(roomCode).emit('roomStateUpdate', state);
};

// Main Vote Resolution Engine
const resolveRoomVotes = (roomCode) => {
  clearRoomTimer(roomCode);
  const room = db.rooms.get(roomCode);
  const roomPlayers = db.players.get(roomCode);
  if (!room || !roomPlayers) return;

  const livingPlayers = Array.from(roomPlayers.values()).filter(p => p.is_alive);
  if (livingPlayers.length === 0) return;

  const voteTallies = {};
  livingPlayers.forEach(p => { voteTallies[p.player_id] = 0; });
  
  livingPlayers.forEach(p => {
    if (p.has_voted && p.voted_for && voteTallies[p.voted_for] !== undefined) {
      voteTallies[p.voted_for]++;
    }
  });

  let maxVotes = -1;
  let candidates = [];
  Object.entries(voteTallies).forEach(([playerId, votes]) => {
    if (votes > maxVotes) {
      maxVotes = votes;
      candidates = [playerId];
    } else if (votes === maxVotes) {
      candidates.push(playerId);
    }
  });

  let eliminatedId = null;
  let wasTie = false;

  if (maxVotes > 0) {
    if (candidates.length > 1) {
      eliminatedId = resolveTiedVote(candidates);
      wasTie = true;
    } else {
      eliminatedId = candidates[0];
    }
  }

  if (eliminatedId) {
    const eliminatedPlayer = roomPlayers.get(eliminatedId);
    if (eliminatedPlayer) {
      eliminatedPlayer.is_alive = false;
      db.history.get(roomCode).push({
        round: (room.current_round || 0) + 1,
        eliminated_player_id: eliminatedId,
        eliminated_role: eliminatedPlayer.role,
        was_tie: wasTie
      });
    }
  }

  // Check Win Conditions
  const living = Array.from(roomPlayers.values()).filter(p => p.is_alive);
  const mafiaCount = living.filter(p => p.role === 'mafia').length;
  const civilianCount = living.filter(p => p.role === 'civilian').length;

  let winner = null;
  if (mafiaCount === 0) {
    winner = 'civilians';
  } else if (mafiaCount >= civilianCount) {
    winner = 'mafia';
  }

  if (winner) {
    room.phase = 'game_over';
    room.winner = winner;
  } else {
    room.phase = 'elimination_reveal';
    room.current_round = (room.current_round || 0) + 1;
  }

  broadcastRoomState(roomCode);
};

// Helper function to setup the Voting timer
const setupVotingTimer = (roomCode, settings) => {
  const room = db.rooms.get(roomCode);
  if (!room) return;

  let votingEndsAt = null;
  if (!settings.votingUnlimited) {
    const secs = settings.votingSeconds || 60;
    votingEndsAt = new Date(Date.now() + secs * 1000);
    const timerId = setTimeout(() => resolveRoomVotes(roomCode), secs * 1000);
    activeTimers.set(roomCode, timerId);
  }
  room.voting_ends_at = votingEndsAt;
  broadcastRoomState(roomCode);
};

io.on('connection', (socket) => {
  socket.on('join_room', ({ roomCode, playerId }) => {
    socket.join(roomCode);
    socket.playerId = playerId;
    socket.roomCode = roomCode;
    broadcastRoomState(roomCode);
  });

  socket.on('update_settings', ({ roomCode, settings }) => {
    const room = db.rooms.get(roomCode);
    if (room) {
      room.settings = settings;
      broadcastRoomState(roomCode);
    }
  });

  // KICK PLAYER (HOST ONLY)
  socket.on('kick_player', ({ roomCode, playerId, targetPlayerId }) => {
    const room = db.rooms.get(roomCode);
    if (!room) return;
    if (room.host_id !== playerId) return; // Only host can kick
    
    const roomPlayers = db.players.get(roomCode);
    if (roomPlayers && roomPlayers.has(targetPlayerId)) {
      roomPlayers.delete(targetPlayerId);
      
      // Force the kicked player's socket to leave the room (if they are connected)
      io.in(roomCode).fetchSockets().then(sockets => {
        sockets.forEach(s => {
          if (s.playerId === targetPlayerId) {
            s.leave(roomCode);
            s.emit('kicked'); // Tell client they were kicked
          }
        });
      });

      broadcastRoomState(roomCode);
    }
  });

  socket.on('start_game', ({ roomCode, playerId }) => {
    const room = db.rooms.get(roomCode);
    if (!room || room.host_id !== playerId) return;

    const roomPlayers = db.players.get(roomCode);
    if (!roomPlayers) return;
    const playerList = Array.from(roomPlayers.values());
    const totalPlayers = playerList.length;
    
    const settings = room.settings || {};
    const mafiaCount = Math.min(settings.mafiaCount || 1, Math.max(1, totalPlayers - 1));

    const shuffledIds = secureShuffle(playerList.map(p => p.player_id));
    const mafiaIds = shuffledIds.slice(0, mafiaCount);

    playerList.forEach(p => {
      p.role = mafiaIds.includes(p.player_id) ? 'mafia' : 'civilian';
      p.is_alive = true;
      p.has_voted = false;
      p.voted_for = null;
    });

    room.phase = 'countdown';
    room.current_round = 0;
    room.winner = null;
    broadcastRoomState(roomCode);

    setTimeout(() => {
      if (db.rooms.get(roomCode)?.phase === 'countdown') {
        db.rooms.get(roomCode).phase = 'reveal';
        broadcastRoomState(roomCode);
      }
    }, 4000);
  });

  socket.on('advance_phase', ({ roomCode, playerId, targetPhase }) => {
    const room = db.rooms.get(roomCode);
    if (!room || room.host_id !== playerId) return;

    clearRoomTimer(roomCode);
    const roomPlayers = db.players.get(roomCode);

    if (targetPhase === 'discussion') {
      const settings = room.settings || {};
      let discussionEndsAt = null;

      if (!settings.discussionUnlimited) {
        const secs = settings.discussionSeconds || 120;
        discussionEndsAt = new Date(Date.now() + secs * 1000);

        const timerId = setTimeout(() => {
          const r = db.rooms.get(roomCode);
          if (r) {
            r.phase = 'voting';
            if (roomPlayers) {
              roomPlayers.forEach(p => { p.has_voted = false; p.voted_for = null; });
            }
            broadcastRoomState(roomCode);
            setupVotingTimer(roomCode, settings);
          }
        }, secs * 1000);
        activeTimers.set(roomCode, timerId);
      }
      room.phase = 'discussion';
      room.discussion_ends_at = discussionEndsAt;

    } else if (targetPhase === 'voting') {
      const settings = room.settings || {};
      if (roomPlayers) {
        roomPlayers.forEach(p => { p.has_voted = false; p.voted_for = null; });
      }
      room.phase = 'voting';
      setupVotingTimer(roomCode, settings);
    }

    broadcastRoomState(roomCode);
  });

  socket.on('cast_vote', ({ roomCode, playerId, votedForId }) => {
    const roomPlayers = db.players.get(roomCode);
    if (roomPlayers && roomPlayers.has(playerId)) {
      const p = roomPlayers.get(playerId);
      p.voted_for = votedForId;
      p.has_voted = true;
      broadcastRoomState(roomCode);
    }
  });

  socket.on('end_voting', ({ roomCode, playerId }) => {
    const room = db.rooms.get(roomCode);
    if (room && room.host_id === playerId) {
      resolveRoomVotes(roomCode);
    }
  });

  socket.on('reset_game', ({ roomCode, playerId }) => {
    const room = db.rooms.get(roomCode);
    if (room && room.host_id === playerId) {
      clearRoomTimer(roomCode);
      room.phase = 'lobby';
      room.current_round = 0;
      room.winner = null;
      room.discussion_ends_at = null;
      room.voting_ends_at = null;

      const roomPlayers = db.players.get(roomCode);
      if (roomPlayers) {
        roomPlayers.forEach(p => {
          p.role = null;
          p.is_alive = true;
          p.has_voted = false;
          p.voted_for = null;
        });
      }
      db.history.set(roomCode, []);
      broadcastRoomState(roomCode);
    }
  });

  socket.on('disconnect', () => {
    // Intentionally left minimal. Reconnect logic handled by client.
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});

// Auto-cleanup rooms older than 6 hours
setInterval(() => {
  const threshold = Date.now() - (6 * 60 * 60 * 1000);
  for (const [roomCode, room] of db.rooms.entries()) {
    if (room.created_at < threshold) {
      db.rooms.delete(roomCode);
      db.players.delete(roomCode);
      db.history.delete(roomCode);
      clearRoomTimer(roomCode);
    }
  }
}, 60 * 60 * 1000);
