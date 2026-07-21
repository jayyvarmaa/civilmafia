import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3000`;

export const GameProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [players, setPlayers] = useState({});
  const [roomState, setRoomState] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize unique player ID
  useEffect(() => {
    let id = localStorage.getItem('sleeper_player_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('sleeper_player_id', id);
    }
    setPlayerId(id);
    
    const storedName = localStorage.getItem('sleeper_player_name');
    if (storedName) setPlayerName(storedName);

    setLoading(false);
  }, []);

  const saveName = (name) => {
    setPlayerName(name);
    localStorage.setItem('sleeper_player_name', name);
  };

  const [socketConnected, setSocketConnected] = useState(false);

  // Initialize socket
  useEffect(() => {
    if (!playerId) return;
    console.log(`[SOCKET_INIT] Connecting to ${SERVER_URL} for player: ${playerId}`);
    const newSocket = io(SERVER_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 5000,
    });

    newSocket.on('connect', () => {
      console.log(`[SOCKET_CONNECT] Connected. Socket ID: ${newSocket.id}`);
      setSocketConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log(`[SOCKET_DISCONNECT] Socket disconnected`);
      setSocketConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('[SOCKET_ERROR] Connection failed:', err.message);
      setSocketConnected(false);
    });

    setSocket(newSocket);
    
    return () => newSocket.close();
  }, [playerId]);

  // Handle Socket events — listen for room state updates
  useEffect(() => {
    if (!socket || !roomCode || !socketConnected) return;
    
    console.log(`[SOCKET_EMIT] Joining socket room: ${roomCode}`);
    socket.emit('join_room', { roomCode, playerId });
    
    const handleRoomState = (data) => {
      console.log(`[SOCKET_ON_ROOM_STATE] Received room state:`, data);
      const { players: newPlayers, ...roomInfo } = data;
      
      // Store roomInfo WITH players merged back in so Lobby can access both
      setRoomState({ ...roomInfo, players: newPlayers });
      setPlayers(newPlayers || {});
      
      // Update isHost status
      if (newPlayers && newPlayers[playerId]) {
        setIsHost(newPlayers[playerId].isHost);
        console.log(`[SOCKET_ON_ROOM_STATE] isHost: ${newPlayers[playerId].isHost}`);
      }
    };

    const handleKicked = () => {
      console.log(`[SOCKET_KICKED] You were kicked from the room`);
      setRoomCode(null);
      setRoomState(null);
      window.location.href = '/'; // Redirect to home if kicked
    };

    socket.on('roomStateUpdate', handleRoomState);
    socket.on('kicked', handleKicked);

    return () => {
      socket.off('roomStateUpdate', handleRoomState);
      socket.off('kicked', handleKicked);
    };
  }, [socket, roomCode, playerId, socketConnected]);

  // Create room — server auto-adds host as player
  const createRoom = async () => {
    const name = playerName || localStorage.getItem('sleeper_player_name') || 'Host';
    console.log(`[API_CREATE_ROOM] Creating room... host: ${playerId}, name: ${name}`);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_id: playerId, host_name: name })
      });
      const data = await res.json();
      
      if (!res.ok) {
        console.error(`[API_CREATE_ROOM_FAIL]`, data);
        throw new Error(data.error || 'Failed to create room');
      }

      console.log(`[API_CREATE_ROOM_SUCCESS] Room created: ${data.roomCode}`);
      setRoomCode(data.roomCode);
      setIsHost(true);
      return data.roomCode;
    } catch (error) {
      console.error('[API_CREATE_ROOM_ERROR]', error);
      throw error;
    }
  };

  // Join an existing room
  const joinRoom = async (code, name) => {
    const resolvedName = name || playerName || localStorage.getItem('sleeper_player_name') || 'Player';
    console.log(`[API_JOIN_ROOM] Joining room ${code} as ${resolvedName}`);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerId,
          name: resolvedName
        })
      });
      const data = await res.json();
      
      if (!res.ok || data.error) {
        console.error(`[API_JOIN_ROOM_FAIL]`, data);
        throw new Error(data.error || 'Failed to join room');
      }
      
      console.log(`[API_JOIN_ROOM_SUCCESS] Joined room ${code}`);
      setRoomCode(code);
    } catch (error) {
      console.error('[API_JOIN_ROOM_ERROR]', error);
      throw error;
    }
  };

  const updateSettings = (newSettings) => {
    console.log(`[SETTINGS_UPDATE] socket: ${!!socket}, roomCode: ${roomCode}, isHost: ${isHost}`);
    if (socket && roomCode) {
      console.log(`[SETTINGS_UPDATE] Emitting update_settings`, newSettings);
      socket.emit('update_settings', { roomCode, settings: newSettings });
    } else {
      console.warn(`[SETTINGS_UPDATE] Cannot emit — socket or roomCode missing`);
    }
  };

  const startGame = () => {
    if (socket && roomCode) {
      console.log(`[SOCKET_EMIT] start_game`);
      socket.emit('start_game', { roomCode, playerId });
    }
  };

  const advancePhase = (targetPhase) => {
    if (socket && roomCode) {
      console.log(`[SOCKET_EMIT] advance_phase -> ${targetPhase}`);
      socket.emit('advance_phase', { roomCode, playerId, targetPhase });
    }
  };

  const castVote = (votedForId) => {
    if (socket && roomCode) {
      console.log(`[SOCKET_EMIT] cast_vote -> ${votedForId}`);
      socket.emit('cast_vote', { roomCode, playerId, votedForId });
    }
  };

  const endVoting = () => {
    if (socket && roomCode) {
      console.log(`[SOCKET_EMIT] end_voting`);
      socket.emit('end_voting', { roomCode, playerId });
    }
  };

  const resetGame = () => {
    if (socket && roomCode) {
      console.log(`[SOCKET_EMIT] reset_game`);
      socket.emit('reset_game', { roomCode, playerId });
    }
  };

  const kickPlayer = (targetPlayerId) => {
    if (socket && roomCode && isHost) {
      console.log(`[SOCKET_EMIT] kick_player -> ${targetPlayerId}`);
      socket.emit('kick_player', { roomCode, playerId, targetPlayerId });
    }
  };

  const value = {
    roomCode,
    players,
    roomState,
    isHost,
    playerId,
    playerName,
    loading,
    createRoom,
    joinRoom,
    updateSettings,
    setRoomCode,
    setIsHost,
    saveName,
    startGame,
    advancePhase,
    castVote,
    endVoting,
    resetGame,
    kickPlayer,
    socketConnected
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
