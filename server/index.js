const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
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

// Map to track active timers for rooms (to prevent duplicate timers or leftover callbacks)
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

// Cryptographically secure shuffle (Fisher-Yates) using crypto.randomBytes
const secureShuffle = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Generate secure random number between 0 and i inclusive
    const randomBuf = crypto.randomBytes(4);
    const randomVal = randomBuf.readUInt32BE(0);
    const j = randomVal % (i + 1);
    
    // Swap elements
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Tie-breaker: securely pick one player from tied list
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

// --- Socket.io Events & Helpers ---

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

    // Fetch elimination history
    const historyRes = await pool.query(
      `SELECT round, eliminated_player_id, eliminated_role, was_tie 
       FROM elimination_history 
       WHERE room_code = $1 
       ORDER BY round ASC`,
      [roomCode]
    );

    const state = {
      ...roomRes.rows[0],
      players,
      eliminationHistory: historyRes.rows
    };

    console.log(`[SOCKET] Broadcasting room state for ${roomCode} — phase: ${state.phase}, players: ${playersRes.rows.length}`);
    io.to(roomCode).emit('roomStateUpdate', state);
  } catch (error) {
    console.error('[SOCKET] Error broadcasting state:', error.message);
  }
};

// Main Vote Resolution Engine
const resolveRoomVotes = async (roomCode) => {
  clearRoomTimer(roomCode);
  console.log(`[GAME_ENGINE] Resolving votes for room: ${roomCode}`);
  
  try {
    // 1. Fetch living players
    const playersRes = await pool.query(
      `SELECT player_id, name, role FROM players WHERE room_code = $1 AND is_alive = true`,
      [roomCode]
    );
    
    const livingPlayers = playersRes.rows;
    if (livingPlayers.length === 0) return;

    // 2. Fetch all votes cast in this room
    const votesRes = await pool.query(
      `SELECT voted_for FROM players WHERE room_code = $1 AND is_alive = true AND voted_for IS NOT NULL`,
      [roomCode]
    );

    // 3. Tally votes
    const voteTallies = {};
    livingPlayers.forEach(p => { voteTallies[p.player_id] = 0; });
    votesRes.rows.forEach(v => {
      if (voteTallies[v.voted_for] !== undefined) {
        voteTallies[v.voted_for]++;
      }
    });

    console.log(`[GAME_ENGINE] Vote tallies:`, voteTallies);

    // 4. Find highest vote count
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

    // Only eliminate if someone actually got votes
    if (maxVotes > 0) {
      if (candidates.length > 1) {
        // Resolve tie breaker using secure random pick
        eliminatedId = resolveTiedVote(candidates);
        wasTie = true;
        console.log(`[GAME_ENGINE] Tie detected between ${candidates.join(', ')}. Securely picked: ${eliminatedId}`);
      } else {
        eliminatedId = candidates[0];
      }
    }

    let eliminatedPlayer = null;
    if (eliminatedId) {
      eliminatedPlayer = livingPlayers.find(p => p.player_id === eliminatedId);
      
      // Update eliminated player status in DB
      await pool.query(
        `UPDATE players SET is_alive = false WHERE player_id = $1`,
        [eliminatedId]
      );
      
      // Get current round
      const roomRes = await pool.query(`SELECT current_round FROM rooms WHERE room_code = $1`, [roomCode]);
      const currentRound = roomRes.rows[0]?.current_round || 0;

      // Add to elimination history
      await pool.query(
        `INSERT INTO elimination_history (room_code, round, eliminated_player_id, eliminated_role, was_tie)
         VALUES ($1, $2, $3, $4, $5)`,
        [roomCode, currentRound + 1, eliminatedId, eliminatedPlayer.role, wasTie]
      );
    }

    // 5. Check Win Conditions
    const updatedPlayersRes = await pool.query(
      `SELECT role, is_alive FROM players WHERE room_code = $1 AND is_alive = true`,
      [roomCode]
    );

    const living = updatedPlayersRes.rows;
    const mafiaCount = living.filter(p => p.role === 'mafia').length;
    const civilianCount = living.filter(p => p.role === 'civilian').length;

    console.log(`[GAME_ENGINE] Win check — Living Mafia: ${mafiaCount}, Civilians: ${civilianCount}`);

    let winner = null;
    if (mafiaCount === 0) {
      winner = 'civilians';
    } else if (mafiaCount >= civilianCount) {
      winner = 'mafia';
    }

    // 6. Transition phase
    if (winner) {
      await pool.query(
        `UPDATE rooms SET phase = 'game_over', winner = $1 WHERE room_code = $2`,
        [winner, roomCode]
      );
    } else {
      await pool.query(
        `UPDATE rooms SET phase = 'elimination_reveal', current_round = current_round + 1 WHERE room_code = $2`,
        [roomCode]
      );
    }

    await broadcastRoomState(roomCode);
  } catch (err) {
    console.error(`[GAME_ENGINE] Error resolving votes:`, err.message);
  }
};

io.on('connection', (socket) => {
  console.log(`[SOCKET] New connection: ${socket.id}`);

  socket.on('join_room', async ({ roomCode, playerId }) => {
    console.log(`[SOCKET] ${playerId} joining socket room ${roomCode}`);
    socket.join(roomCode);
    socket.playerId = playerId;
    socket.roomCode = roomCode;
    
    await broadcastRoomState(roomCode);
  });

  socket.on('update_settings', async ({ roomCode, settings }) => {
    console.log(`[SOCKET] Updating settings for room ${roomCode}`);
    await pool.query(`UPDATE rooms SET settings = $1 WHERE room_code = $2`, [settings, roomCode]);
    await broadcastRoomState(roomCode);
  });

  // START GAME: Role Assignment & Countdown
  socket.on('start_game', async ({ roomCode, playerId }) => {
    console.log(`[SOCKET] Start game request for room ${roomCode} from player ${playerId}`);
    try {
      const roomRes = await pool.query(`SELECT host_id, settings FROM rooms WHERE room_code = $1`, [roomCode]);
      if (roomRes.rows.length === 0) return;
      const room = roomRes.rows[0];

      // Verify host permission
      if (room.host_id !== playerId) {
        console.warn(`[SOCKET] Non-host ${playerId} tried to start room ${roomCode}`);
        return;
      }

      // Fetch all players currently in the lobby
      const playersRes = await pool.query(
        `SELECT player_id FROM players WHERE room_code = $1`,
        [roomCode]
      );
      const playerList = playersRes.rows;

      const totalPlayers = playerList.length;
      const settings = room.settings || {};
      const mafiaCount = Math.min(settings.mafiaCount || 1, totalPlayers - 1);

      // Securely shuffle player list
      const shuffledPlayers = secureShuffle(playerList.map(p => p.player_id));
      const mafiaIds = shuffledPlayers.slice(0, mafiaCount);

      console.log(`[SOCKET] Assigning roles for room ${roomCode}. Mafia: ${mafiaIds.join(', ')}`);

      // Write roles and reset player alive/vote statuses
      for (const p of playerList) {
        const role = mafiaIds.includes(p.player_id) ? 'mafia' : 'civilian';
        await pool.query(
          `UPDATE players 
           SET role = $1, is_alive = true, has_voted = false, voted_for = null 
           WHERE player_id = $2`,
          [role, p.player_id]
        );
      }

      // Set room phase to countdown and store settings syncs
      await pool.query(
        `UPDATE rooms SET phase = 'countdown', current_round = 0, winner = null WHERE room_code = $1`,
        [roomCode]
      );
      await broadcastRoomState(roomCode);

      // Set a server-side timeout to automatically advance to Role Reveal
      setTimeout(async () => {
        const checkRoom = await pool.query(`SELECT phase FROM rooms WHERE room_code = $1`, [roomCode]);
        // Only advance if the phase hasn't been reset mid-countdown
        if (checkRoom.rows[0]?.phase === 'countdown') {
          await pool.query(`UPDATE rooms SET phase = 'reveal' WHERE room_code = $1`, [roomCode]);
          await broadcastRoomState(roomCode);
        }
      }, 4000); // 4 seconds total to let the 3-2-1 countdown play smoothly

    } catch (err) {
      console.error(`[SOCKET] Start game failed:`, err.message);
    }
  });

  // ADVANCE PHASE: lobby -> countdown -> reveal -> discussion -> voting -> elimination_reveal
  socket.on('advance_phase', async ({ roomCode, playerId, targetPhase }) => {
    console.log(`[SOCKET] Advance phase request to ${targetPhase} for room ${roomCode} from player ${playerId}`);
    try {
      const roomRes = await pool.query(`SELECT host_id, settings FROM rooms WHERE room_code = $1`, [roomCode]);
      if (roomRes.rows.length === 0) return;
      const room = roomRes.rows[0];

      // Verify host permission
      if (room.host_id !== playerId) return;

      clearRoomTimer(roomCode);

      if (targetPhase === 'discussion') {
        const settings = room.settings || {};
        let discussionEndsAt = null;

        // If not unlimited, calculate timer expiry
        if (!settings.discussionUnlimited) {
          const secs = settings.discussionSeconds || 120;
          discussionEndsAt = new Date(Date.now() + secs * 1000);

          // Setup server-side auto-advancer to voting
          const timerId = setTimeout(async () => {
            await pool.query(
              `UPDATE rooms SET phase = 'voting' WHERE room_code = $1`,
              [roomCode]
            );
            // Reset votes before voting starts
            await pool.query(
              `UPDATE players SET has_voted = false, voted_for = null WHERE room_code = $1`,
              [roomCode]
            );
            await broadcastRoomState(roomCode);
            setupVotingTimer(roomCode, settings);
          }, secs * 1000);
          activeTimers.set(roomCode, timerId);
        }

        await pool.query(
          `UPDATE rooms SET phase = 'discussion', discussion_ends_at = $1 WHERE room_code = $2`,
          [discussionEndsAt, roomCode]
        );

      } else if (targetPhase === 'voting') {
        const settings = room.settings || {};
        
        // Reset player votes in DB
        await pool.query(
          `UPDATE players SET has_voted = false, voted_for = null WHERE room_code = $1`,
          [roomCode]
        );

        await pool.query(
          `UPDATE rooms SET phase = 'voting', voting_ends_at = $1 WHERE room_code = $2`,
          [null, roomCode] // We calculate it below and update it
        );

        setupVotingTimer(roomCode, settings);
      }

      await broadcastRoomState(roomCode);
    } catch (err) {
      console.error(`[SOCKET] Advance phase error:`, err.message);
    }
  });

  // Helper function to setup the Voting timer
  const setupVotingTimer = async (roomCode, settings) => {
    let votingEndsAt = null;

    if (!settings.votingUnlimited) {
      const secs = settings.votingSeconds || 60;
      votingEndsAt = new Date(Date.now() + secs * 1000);

      // Setup server-side auto-resolution
      const timerId = setTimeout(() => {
        resolveRoomVotes(roomCode);
      }, secs * 1000);
      activeTimers.set(roomCode, timerId);
    }

    await pool.query(
      `UPDATE rooms SET voting_ends_at = $1 WHERE room_code = $2`,
      [votingEndsAt, roomCode]
    );
    await broadcastRoomState(roomCode);
  };

  // CAST VOTE
  socket.on('cast_vote', async ({ roomCode, playerId, votedForId }) => {
    console.log(`[SOCKET] Vote cast: ${playerId} voted for ${votedForId} in room ${roomCode}`);
    try {
      // Set vote in DB
      await pool.query(
        `UPDATE players SET voted_for = $1, has_voted = true WHERE player_id = $2 AND room_code = $3`,
        [votedForId, playerId, roomCode]
      );
      await broadcastRoomState(roomCode);
    } catch (err) {
      console.error(`[SOCKET] Vote cast error:`, err.message);
    }
  });

  // END VOTING EARLY (HOST ONLY)
  socket.on('end_voting', async ({ roomCode, playerId }) => {
    console.log(`[SOCKET] Host requested End Voting for room ${roomCode}`);
    try {
      const roomRes = await pool.query(`SELECT host_id FROM rooms WHERE room_code = $1`, [roomCode]);
      if (roomRes.rows.length === 0) return;
      
      if (roomRes.rows[0].host_id === playerId) {
        await resolveRoomVotes(roomCode);
      }
    } catch (err) {
      console.error(`[SOCKET] End voting early error:`, err.message);
    }
  });

  // RESET GAME
  socket.on('reset_game', async ({ roomCode, playerId }) => {
    console.log(`[SOCKET] Reset game requested for room ${roomCode}`);
    try {
      const roomRes = await pool.query(`SELECT host_id FROM rooms WHERE room_code = $1`, [roomCode]);
      if (roomRes.rows.length === 0) return;
      
      if (roomRes.rows[0].host_id === playerId) {
        clearRoomTimer(roomCode);

        // Reset room properties
        await pool.query(
          `UPDATE rooms 
           SET phase = 'lobby', current_round = 0, winner = null, discussion_ends_at = null, voting_ends_at = null 
           WHERE room_code = $1`,
          [roomCode]
        );

        // Reset player properties
        await pool.query(
          `UPDATE players 
           SET role = null, is_alive = true, has_voted = false, voted_for = null 
           WHERE room_code = $1`,
          [roomCode]
        );

        // Clear elimination history
        await pool.query(
          `DELETE FROM elimination_history WHERE room_code = $1`,
          [roomCode]
        );

        await broadcastRoomState(roomCode);
      }
    } catch (err) {
      console.error(`[SOCKET] Reset game error:`, err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Disconnected: ${socket.id} (player: ${socket.playerId})`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
