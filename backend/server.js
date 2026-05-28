const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Enable CORS for Socket.io to allow connections from local dev and production client
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://mafia-five-pearl.vercel.app"],
    methods: ["GET", "POST"]
  }
});

// Basic HTTP status endpoint
app.get('/status', (req, res) => {
  res.json({ status: 'active', rooms: Object.keys(rooms).length });
});

// Express health check route for keeping Render awake
app.get('/health', (req, res) => {
  res.send('Awake');
});

// In-memory database of room objects
const rooms = {};
const roomIntervals = {};
const roomTimerCallbacks = {};

// Helper to generate a unique 4-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]); // Ensure uniqueness
  return code;
}

function sanitizeRoomStateForPlayer(room, socketId) {
  const playerObj = room.players.find(p => p.socketId === socketId);
  if (!playerObj) return room;

  const recipientRole = playerObj.role;

  // Mask roles of living players
  const sanitizedPlayers = room.players.map(p => {
    // Keep recipient's own role visible
    if (p.socketId === socketId) {
      return p;
    }
    // If recipient is Mafia, keep other Mafia roles visible
    if (recipientRole === 'MAFIA' && p.role === 'MAFIA') {
      return p;
    }
    // Mask role for all living players
    if (p.isAlive) {
      return {
        ...p,
        role: null
      };
    }
    // Dead player roles can be revealed
    return p;
  });

  const sanitizedRoom = {
    ...room,
    players: sanitizedPlayers
  };

  // Only reveal Mafia votes and vote status to Mafia
  if (recipientRole !== 'MAFIA') {
    sanitizedRoom.mafiaVotes = {};
    sanitizedRoom.mafiaVoteStatus = null;
  } else {
    const aliveMafia = room.players.filter(p => p.role === 'MAFIA' && p.isAlive);
    const votesCast = aliveMafia.filter(m => room.mafiaVotes[m.id] !== undefined).length;
    sanitizedRoom.mafiaVoteStatus = `${votesCast}/${aliveMafia.length} votes cast`;
  }

  return sanitizedRoom;
}

function broadcastRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const roomSockets = io.sockets.adapter.rooms.get(roomCode);
  if (!roomSockets) return;

  for (const socketId of roomSockets) {
    const sanitized = sanitizeRoomStateForPlayer(room, socketId);
    io.to(socketId).emit('roomStateUpdated', sanitized);
    io.to(socketId).emit('gameStateUpdated', sanitized);
  }
}

// Start a timer for a room
function startRoomTimer(roomCode, duration, onComplete) {
  const room = rooms[roomCode];
  if (!room) return;

  if (roomIntervals[roomCode]) {
    clearInterval(roomIntervals[roomCode]);
  }

  room.timer = duration;
  broadcastRoomState(roomCode);

  roomTimerCallbacks[roomCode] = onComplete;

  roomIntervals[roomCode] = setInterval(() => {
    const r = rooms[roomCode];
    if (!r) {
      clearInterval(roomIntervals[roomCode]);
      delete roomIntervals[roomCode];
      delete roomTimerCallbacks[roomCode];
      return;
    }
    r.timer--;
    if (r.timer <= 0) {
      clearInterval(roomIntervals[roomCode]);
      delete roomIntervals[roomCode];
      const cb = roomTimerCallbacks[roomCode];
      delete roomTimerCallbacks[roomCode];
      if (cb) cb(r);
    } else {
      broadcastRoomState(roomCode);
    }
  }, 1000);
}

// Clear a room's timer
function clearRoomTimer(room) {
  const roomCode = room.roomCode;
  if (roomIntervals[roomCode]) {
    clearInterval(roomIntervals[roomCode]);
    delete roomIntervals[roomCode];
  }
  delete roomTimerCallbacks[roomCode];
}

// Transition Functions
function transitionToRoleReveal(room) {
  room.gameState = 'ROLE_REVEAL';
  room.mafiaVotes = {};
  room.doctorSave = null;
  room.dayVotes = {};
  room.mafiaChatLogs = [];
  room.systemLogs = [{ id: 'init', text: '[SYSTEM] Roles assigned. Reveal active.' }];

  startRoomTimer(room.roomCode, 4, (r) => {
    transitionToNightMafia(r);
  });
}

function transitionToNightMafia(room) {
  room.gameState = 'NIGHT_MAFIA';
  room.mafiaVotes = {};
  room.doctorSave = null;
  room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Night fell; Mafia turn active.' });

  const duration = room.settings?.night || 45;
  startRoomTimer(room.roomCode, duration, (r) => {
    transitionToNightDoctor(r);
  });
}

function transitionToNightDoctor(room) {
  room.gameState = 'NIGHT_DOCTOR';
  room.doctorSave = null;
  room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Doctor turn active.' });

  const doctorAlive = room.players.some(p => p.role === 'DOCTOR' && p.isAlive);

  if (doctorAlive) {
    // Notify Doctor player
    const doctor = room.players.find(p => p.role === 'DOCTOR' && p.isAlive);
    if (doctor && doctor.socketId) {
      io.to(doctor.socketId).emit('doctorTurn');
    }
    
    startRoomTimer(room.roomCode, 15, (r) => {
      transitionToMorningReveal(r);
    });
  } else {
    // Fake timeout: 3 to 6 seconds
    const fakeDelaySeconds = Math.floor(Math.random() * 4) + 3;
    startRoomTimer(room.roomCode, fakeDelaySeconds, (r) => {
      transitionToMorningReveal(r);
    });
  }
}

function checkWinConditions(room) {
  const aliveMafia = room.players.filter(p => p.role === 'MAFIA' && p.isAlive).length;
  const aliveDoctor = room.players.filter(p => p.role === 'DOCTOR' && p.isAlive).length;
  const aliveCivilian = room.players.filter(p => p.role === 'CIVILIAN' && p.isAlive).length;
  const aliveOthers = aliveDoctor + aliveCivilian;

  if (aliveMafia === 0) {
    room.gameState = 'GAME_OVER_CIVILIANS';
    room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Game Over: Civilians win; all Mafia eliminated!' });
    clearRoomTimer(room);
    broadcastRoomState(room.roomCode);
    return true;
  }

  if (aliveMafia >= aliveOthers) {
    room.gameState = 'GAME_OVER_MAFIA';
    room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Game Over: Mafia wins; they outnumber the Town!' });
    clearRoomTimer(room);
    broadcastRoomState(room.roomCode);
    return true;
  }

  return false;
}

function transitionToMorningReveal(room) {
  const aliveMafia = room.players.filter(p => p.role === 'MAFIA' && p.isAlive);
  const targetCounts = {};
  
  aliveMafia.forEach(m => {
    const vote = room.mafiaVotes[m.id];
    if (vote) {
      targetCounts[vote] = (targetCounts[vote] || 0) + 1;
    }
  });

  let killTargetId = null;
  let maxVotes = 0;
  Object.keys(targetCounts).forEach(tid => {
    if (targetCounts[tid] > maxVotes) {
      maxVotes = targetCounts[tid];
      killTargetId = tid;
    }
  });

  let morningMsg = 'No one was eliminated';
  if (killTargetId) {
    if (killTargetId === room.doctorSave) {
      room.nightResult = { killed: null };
      room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Night results: Someone was attacked but saved by the Doctor.' });
    } else {
      const victim = room.players.find(p => p.id === killTargetId);
      if (victim) {
        victim.isAlive = false;
        room.nightResult = { killed: killTargetId };
        morningMsg = `${victim.name} was eliminated`;
        room.systemLogs.push({ id: Date.now().toString(), text: `[SYSTEM] Night results: ${victim.name} was attacked and eliminated.` });
      }
    }
  } else {
    room.nightResult = { killed: null };
    room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Night results: Quiet night. No one was attacked.' });
  }

  // Clear night actions
  room.mafiaVotes = {};
  room.doctorSave = null;

  // Set buffer state
  room.gameState = 'MORNING_REVEAL';
  room.morningRevealMessage = morningMsg;
  broadcastRoomState(room.roomCode);

  // Transition after 5 seconds
  startRoomTimer(room.roomCode, 5, (r) => {
    r.morningRevealMessage = null;
    const gameOver = checkWinConditions(r);
    if (!gameOver) {
      transitionToDay(r);
    }
  });
}

function transitionToDay(room) {
  room.gameState = 'DAY';
  room.dayVotes = {};
  room.roundNumber = (room.roundNumber || 0) + 1;
  room.systemLogs.push({ id: Date.now().toString(), text: `[SYSTEM] Day Discussion active for Round ${room.roundNumber}.` });

  const duration = room.settings?.day || 240;
  startRoomTimer(room.roomCode, duration, (r) => {
    transitionToVoting(r);
  });
}

function transitionToVoting(room) {
  room.gameState = 'VOTING';
  room.dayVotes = {};
  room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Discussion ended; Voting phase active.' });

  const duration = room.settings?.voting || 30;
  startRoomTimer(room.roomCode, duration, (r) => {
    resolveVotingAndTransitionToReveal(r);
  });
}

function resolveVotingAndTransitionToReveal(room) {
  const alivePlayers = room.players.filter(p => p.isAlive);
  const tally = { 'SKIP': 0 };
  alivePlayers.forEach(p => {
    tally[p.id] = 0;
  });

  Object.values(room.dayVotes).forEach(voteTarget => {
    if (voteTarget) {
      tally[voteTarget] = (tally[voteTarget] || 0) + 1;
    }
  });

  let maxVotes = -1;
  let winners = [];
  Object.entries(tally).forEach(([targetId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      winners = [targetId];
    } else if (count === maxVotes) {
      winners.push(targetId);
    }
  });

  let victimId = null;
  let victimRole = null;
  let victimName = null;
  let lynchMsg = 'No one was eliminated';

  if (winners.length === 1 && winners[0] !== 'SKIP' && maxVotes > 0) {
    const victim = room.players.find(p => p.id === winners[0]);
    if (victim) {
      victim.isAlive = false;
      victimId = victim.id;
      victimRole = victim.role;
      victimName = victim.name;
      
      let roleText = 'an INNOCENT CIVILIAN';
      if (victim.role === 'MAFIA') roleText = 'the MAFIA';
      if (victim.role === 'DOCTOR') roleText = 'the DOCTOR';
      
      lynchMsg = `${victim.name} was ${roleText}`;
      room.systemLogs.push({
        id: Date.now().toString(),
        text: `[SYSTEM] Voting results: ${victim.name} was voted out and eliminated.`
      });
    }
  } else {
    room.systemLogs.push({
      id: Date.now().toString(),
      text: '[SYSTEM] Voting results: No one was eliminated due to a tie or skip majority.'
    });
  }

  // Save lynch result
  room.lynchResult = {
    killed: victimId,
    role: victimRole,
    name: victimName
  };
  room.lynchRevealMessage = lynchMsg;

  room.dayVotes = {};

  // Set buffer state
  room.gameState = 'LYNCH_REVEAL';
  broadcastRoomState(room.roomCode);

  startRoomTimer(room.roomCode, 5, (r) => {
    r.lynchResult = null;
    r.lynchRevealMessage = null;
    const gameOver = checkWinConditions(r);
    if (!gameOver) {
      transitionToNightMafia(r);
    }
  });
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Track the room and player name associated with this socket
  let currentRoomCode = null;
  let currentPlayerName = null;

  function handleVoteUpdate(targetId) {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.isAlive) return;

    if (room.gameState === 'NIGHT_MAFIA') {
      if (player.role !== 'MAFIA') return;

      if (targetId) {
        const target = room.players.find(p => p.id === targetId);
        if (!target || !target.isAlive || target.role === 'MAFIA') {
          socket.emit('error', 'Cannot target yourself or another Mafia member.');
          return;
        }
      }
      room.mafiaVotes[player.id] = targetId;
      console.log(`Mafia ${player.name} updated vote to ${targetId}`);

      broadcastRoomState(currentRoomCode);

      const aliveMafia = room.players.filter(p => p.role === 'MAFIA' && p.isAlive);
      const votes = aliveMafia.map(m => room.mafiaVotes[m.id]);
      const allVoted = votes.every(v => v !== undefined && v !== null);
      const unanimous = votes.every(v => v === votes[0]);

      if (allVoted && unanimous) {
        clearRoomTimer(room);
        transitionToNightDoctor(room);
      }

    } else if (room.gameState === 'VOTING') {
      if (targetId && targetId !== 'SKIP') {
        const target = room.players.find(p => p.id === targetId);
        if (!target || !target.isAlive) {
          socket.emit('error', 'Invalid target chosen');
          return;
        }
      }
      room.dayVotes[player.id] = targetId;
      console.log(`Player ${player.name} updated vote to ${targetId}`);

      broadcastRoomState(currentRoomCode);

      const alivePlayers = room.players.filter(p => p.isAlive);
      const allVoted = alivePlayers.every(p => room.dayVotes[p.id] !== undefined && room.dayVotes[p.id] !== null);

      if (allVoted) {
        clearRoomTimer(room);
        resolveVotingAndTransitionToReveal(room);
      }
    }
  }

  // Event: CREATE ROOM (Host trigger)
  socket.on('createRoom', ({ playerName, playerId, avatarId }) => {
    if (!playerName || !playerId) {
      socket.emit('error', 'Player name and ID are required');
      return;
    }

    const roomCode = generateRoomCode();
    currentPlayerName = playerName;
    currentRoomCode = roomCode;

    rooms[roomCode] = {
      roomCode,
      hostId: socket.id,
      players: [
        {
          id: playerId,
          socketId: socket.id,
          name: playerName.toUpperCase(),
          role: null,
          isAlive: true,
          isHost: true,
          connected: true,
          avatarId: avatarId || null,
        }
      ],
      gameState: 'LOBBY',
      settings: {
        night: 45,
        day: 240,
        voting: 30,
      },
      timer: 0,
      systemLogs: [],
      mafiaVotes: {},
      doctorSave: null,
      dayVotes: {},
      mafiaChatLogs: [],
      dayChatLogs: [],
      roundNumber: 0,
      nightResult: null,
      lynchResult: null,
      morningRevealMessage: null,
      lynchRevealMessage: null,
    };

    console.log('\n[CREATE] Room created:', roomCode);
    console.log('[STATE] Active rooms in memory:', Object.keys(rooms));

    socket.join(roomCode);
    console.log(`Room created: ${roomCode} by host: ${playerName} (${socket.id})`);
    
    // Send sanitized configuration back to host
    socket.emit('roomCreated', {
      roomCode,
      roomState: sanitizeRoomStateForPlayer(rooms[roomCode], socket.id)
    });
  });

  // Event: JOIN ROOM (Guest trigger)
  socket.on('joinRoom', (payload) => {
    console.log('\n[JOIN] Attempting to join room:', payload ? payload.roomCode : undefined);
    console.log('[STATE] Active rooms currently in memory:', Object.keys(rooms));
    console.log("JOIN ATTEMPT RECEIVED:", payload);
    if (!payload) {
      socket.emit('error', 'Invalid join request payload');
      return;
    }
    const { playerName, roomCode, playerId, avatarId } = payload;
    const code = roomCode ? roomCode.toUpperCase().trim() : '';
    if (!code || !rooms[code]) {
      socket.emit('error', 'Incorrect code pls check it');
      return;
    }

    const room = rooms[code];

    // Reconnection Logic
    const existingPlayer = room.players.find(p => p.id === playerId);
    if (existingPlayer) {
      const oldSocketId = existingPlayer.socketId;
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;

      if (room.hostId === oldSocketId) {
        room.hostId = socket.id;
      }

      currentPlayerName = existingPlayer.name;
      currentRoomCode = code;

      socket.join(code);
      console.log(`Player ${existingPlayer.name} reconnected. New socket: ${socket.id}`);

      // Broadcast state update immediately to all connected clients in the room
      io.to(code).emit('gameStateUpdated', room);
      broadcastRoomState(code);

      // Explicitly send success payload back to guest
      socket.emit('roomJoined', {
        roomCode: code,
        roomState: sanitizeRoomStateForPlayer(room, socket.id)
      });
      return;
    }

    if (room.players.length >= 10) {
      socket.emit('error', 'Room is full, max 10');
      return;
    }

    if (room.gameState !== 'LOBBY') {
      socket.emit('error', 'Game already in progress');
      return;
    }

    currentPlayerName = playerName;
    currentRoomCode = code;

    const newPlayer = {
      id: playerId,
      socketId: socket.id,
      name: playerName.toUpperCase(),
      role: null,
      isAlive: true,
      isHost: false,
      connected: true,
      avatarId: avatarId || null,
    };

    room.players.push(newPlayer);
    socket.join(code);

    console.log(`Player ${playerName} (${socket.id}) joined room: ${code}`);

    // Broadcast state update immediately to all connected clients in the room
    io.to(code).emit('gameStateUpdated', room);
    broadcastRoomState(code);
    
    // Explicitly send success payload back to guest to transition screen
    socket.emit('roomJoined', {
      roomCode: code,
      roomState: sanitizeRoomStateForPlayer(room, socket.id)
    });
  });

  // Event: UPDATE SETTINGS (Host adjustments)
  socket.on('updateSettings', ({ settings }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    
    const room = rooms[currentRoomCode];
    // Enforce that only the host can update room settings
    if (room.hostId !== socket.id) {
      socket.emit('error', 'Only the room host can change rules');
      return;
    }

    room.settings = {
      night: Number(settings.night),
      day: Number(settings.day),
      voting: Number(settings.voting),
    };

    console.log(`Room ${currentRoomCode} settings updated:`, room.settings);
    
    // Broadcast state update to everyone in the room
    broadcastRoomState(currentRoomCode);
  });

  // Event: START GAME (Host begins match)
  socket.on('startGame', (roomCode) => {
    const code = roomCode || currentRoomCode;
    const room = rooms[code];
    if (!room) return;

    const numPlayers = room.players.length;

    // Safety check: You MUST have at least 3 tabs open to test this!
    if (numPlayers < 3) {
      socket.emit('error', 'Need at least 3 players to start.');
      return;
    }

    // 1. Calculate the exact number of each role based on our rules
    let mafiaCount = 1;
    if (numPlayers >= 5 && numPlayers <= 7) mafiaCount = 2;
    if (numPlayers >= 8) mafiaCount = 3;

    let doctorCount = 1;
    let civilianCount = numPlayers - mafiaCount - doctorCount;

    // 2. Build the "Deck" of roles
    let roleDeck = [];
    for (let i = 0; i < mafiaCount; i++) roleDeck.push('MAFIA');
    for (let i = 0; i < doctorCount; i++) roleDeck.push('DOCTOR');
    for (let i = 0; i < civilianCount; i++) roleDeck.push('CIVILIAN');

    // 3. Shuffle the deck thoroughly (Fisher-Yates shuffle)
    for (let i = roleDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roleDeck[i], roleDeck[j]] = [roleDeck[j], roleDeck[i]];
    }

    // 4. Deal the roles out to the players
    room.players = room.players.map((player, index) => {
      return {
        ...player,
        role: roleDeck[index],
        isAlive: true,
        hasVotedFor: null
      };
    });

    // 5. Update the game state and tell all tabs the game has started
    room.gameState = 'ROLE_REVEAL';
    
    // This broadcasts the updated room data (with roles) to everyone
    broadcastRoomState(code);
    io.to(code).emit('gameStarted'); 

    // Auto-transition timer starting for Role Reveal phase
    transitionToRoleReveal(room);
  });

  // Event: UPDATE VOTE ACTION
  socket.on('updateVote', ({ targetId }) => {
    handleVoteUpdate(targetId);
  });

  // Event: MAFIA TARGET ACTION (wrapper)
  socket.on('mafiaTarget', ({ targetId }) => {
    handleVoteUpdate(targetId);
  });

  // Event: DOCTOR TARGET ACTION
  socket.on('doctorTarget', ({ targetId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.gameState !== 'NIGHT_DOCTOR') return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.role !== 'DOCTOR' || !player.isAlive) return;

    // Validate target (can protect any alive player, including themselves)
    const target = room.players.find(p => p.id === targetId);
    if (!target || !target.isAlive) {
      socket.emit('error', 'Invalid save target chosen');
      return;
    }

    room.doctorSave = targetId;
    console.log(`Doctor ${player.name} protected ${targetId}`);

    broadcastRoomState(currentRoomCode);

    clearRoomTimer(room);
    transitionToMorningReveal(room);
  });

  // Event: DAY VOTE ACTION (wrapper)
  socket.on('dayVote', ({ targetId }) => {
    handleVoteUpdate(targetId);
  });

  // Event: MAFIA CHAT MESSAGE
  socket.on('mafiaChat', ({ msg }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.role !== 'MAFIA' || !player.isAlive) return;

    const msgObj = { id: Date.now().toString(), text: `[MAFIA] ${player.name}: ${msg}` };
    room.mafiaChatLogs.push(msgObj);

    room.players.forEach(p => {
      if (p.role === 'MAFIA' && p.socketId) {
        io.to(p.socketId).emit('mafiaChatReceived', msgObj);
      }
    });
  });

  // Event: SEND DAY MESSAGE (Global chat during DAY phase)
  socket.on('sendDayMessage', ({ msg }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.gameState !== 'DAY') return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.isAlive) return;

    const msgObj = { id: Date.now().toString(), text: `${player.name}: ${msg}`, senderId: player.id };
    if (!room.dayChatLogs) {
      room.dayChatLogs = [];
    }
    room.dayChatLogs.push(msgObj);

    broadcastRoomState(currentRoomCode);
  });

  // Event: TRANSFER HOST (Host delegates to another user)
  socket.on('transferHost', ({ targetId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    
    // Check if the current client is the host
    if (room.hostId !== socket.id) {
      socket.emit('error', 'Only the room host can delegate host privileges');
      return;
    }

    const targetPlayer = room.players.find(p => p.id === targetId);
    if (!targetPlayer) {
      socket.emit('error', 'Target player not found');
      return;
    }

    room.hostId = targetPlayer.socketId;
    room.players.forEach(p => {
      p.isHost = (p.id === targetPlayer.id);
    });

    console.log(`Host privileges transferred to ${targetPlayer.name} (${targetPlayer.socketId})`);
    broadcastRoomState(currentRoomCode);
  });

  // Event: PLAY AGAIN (Reset game state to LOBBY, keeps players list)
  socket.on('playAgain', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];

    // Check if the gameState is a Game Over state
    if (room.gameState === 'GAME_OVER_CIVILIANS' || room.gameState === 'GAME_OVER_MAFIA') {
      // Reset player states but keep players list
      room.players = room.players.map(p => ({
        ...p,
        role: null,
        isAlive: true,
        hasVotedFor: null,
        avatarId: null,
      }));

      // Reset game states
      room.gameState = 'LOBBY';
      room.timer = 0;
      room.systemLogs = [];
      room.mafiaVotes = {};
      room.doctorSave = null;
      room.dayVotes = {};
      room.mafiaChatLogs = [];
      room.dayChatLogs = [];
      room.roundNumber = 0;
      room.nightResult = null;
      room.lynchResult = null;
      room.morningRevealMessage = null;
      room.lynchRevealMessage = null;

      clearRoomTimer(room);

      console.log(`Room ${currentRoomCode} reset to LOBBY via playAgain by socket ${socket.id}`);
      
      // Broadcast updated state to all clients in the room
      broadcastRoomState(currentRoomCode);
    }
  });

  // Event: SELECT AVATAR (Player claims a character avatar)
  socket.on('selectAvatar', ({ roomId, playerId, avatarId }) => {
    const code = roomId || currentRoomCode;
    if (!code || !rooms[code]) return;
    const room = rooms[code];

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    // Check if another player has already selected this avatarId in the room
    const isAlreadyClaimed = room.players.some(p => p.id !== player.id && p.avatarId === avatarId);
    if (isAlreadyClaimed) {
      socket.emit('error', 'Avatar is already selected by another player');
      return;
    }

    player.avatarId = avatarId;
    console.log(`Player ${player.name} selected avatar: ${avatarId}`);

    // Broadcast state update immediately to all clients in the room
    io.to(code).emit('gameStateUpdated', room);
    broadcastRoomState(code);
  });

  // Event: KICK PLAYER (Host restricts user from lobby or match)
  socket.on('kickPlayer', ({ targetPlayerId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];

    // Security Check: Verify host
    if (room.hostId !== socket.id) {
      socket.emit('error', 'Only the host can kick players');
      return;
    }

    const targetIndex = room.players.findIndex(p => p.id === targetPlayerId);
    if (targetIndex === -1) {
      socket.emit('error', 'Target player not found');
      return;
    }

    const targetPlayer = room.players[targetIndex];
    room.players.splice(targetIndex, 1);
    console.log(`Player ${targetPlayer.name} was kicked from room ${currentRoomCode}`);

    // Notify the kicked player's client to disconnect and exit
    if (targetPlayer.socketId) {
      io.to(targetPlayer.socketId).emit('kickedByHost');
    }

    // Mid-Game Safety Checks
    const isGameOverState = room.gameState === 'GAME_OVER_CIVILIANS' || room.gameState === 'GAME_OVER_MAFIA';
    if (room.gameState !== 'LOBBY' && !isGameOverState) {
      // 1. Nullify night actions if target player was doctor save or mafia target
      if (room.doctorSave === targetPlayerId) {
        room.doctorSave = null;
      }
      Object.keys(room.mafiaVotes).forEach(voterId => {
        if (room.mafiaVotes[voterId] === targetPlayerId) {
          delete room.mafiaVotes[voterId];
        }
      });
      Object.keys(room.dayVotes).forEach(voterId => {
        if (room.dayVotes[voterId] === targetPlayerId) {
          delete room.dayVotes[voterId];
        }
      });

      // 2. Re-run win conditions
      const gameOver = checkWinConditions(room);
      if (!gameOver) {
        // 3. Re-verify active voting/target thresholds
        if (room.gameState === 'NIGHT_MAFIA') {
          // Remove votes of kicked players
          Object.keys(room.mafiaVotes).forEach(voterId => {
            if (!room.players.some(p => p.id === voterId && p.role === 'MAFIA' && p.isAlive)) {
              delete room.mafiaVotes[voterId];
            }
          });
          const aliveMafia = room.players.filter(p => p.role === 'MAFIA' && p.isAlive);
          const votes = aliveMafia.map(m => room.mafiaVotes[m.id]);
          const allVoted = votes.every(v => v !== undefined && v !== null);
          const unanimous = votes.every(v => v === votes[0]);
          if (allVoted && unanimous && aliveMafia.length > 0) {
            clearRoomTimer(room);
            transitionToNightDoctor(room);
          }
        } else if (room.gameState === 'VOTING') {
          // Remove votes of kicked players
          Object.keys(room.dayVotes).forEach(voterId => {
            if (!room.players.some(p => p.id === voterId && p.isAlive)) {
              delete room.dayVotes[voterId];
            }
          });
          const alivePlayers = room.players.filter(p => p.isAlive);
          const allVoted = alivePlayers.every(p => room.dayVotes[p.id] !== undefined && room.dayVotes[p.id] !== null);
          if (allVoted && alivePlayers.length > 0) {
            clearRoomTimer(room);
            resolveVotingAndTransitionToReveal(room);
          }
        }

        // Broadcast updated state
        broadcastRoomState(currentRoomCode);
      }
    } else {
      // Lobby or Game Over state
      broadcastRoomState(currentRoomCode);
    }
  });

  // Event: FORCE SKIP PHASE (Host bypass timer bug)
  socket.on('forceSkipPhase', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];

    // Security Check: Verify host
    if (room.hostId !== socket.id) {
      socket.emit('error', 'Only the host can force skip the phase');
      return;
    }

    const cb = roomTimerCallbacks[currentRoomCode];
    if (cb) {
      console.log(`Host force skipped phase in room ${currentRoomCode}`);
      clearInterval(roomIntervals[currentRoomCode]);
      delete roomIntervals[currentRoomCode];
      delete roomTimerCallbacks[currentRoomCode];
      cb(room);
    }
  });

  // Event: RESET ROOM (Host play again trigger)
  socket.on('resetRoom', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.hostId !== socket.id) {
      socket.emit('error', 'Only the room host can reset the game');
      return;
    }

    // Reset player states
    room.players = room.players.map(p => ({
      ...p,
      role: null,
      isAlive: true,
      hasVotedFor: null,
      avatarId: null,
    }));

    // Reset game states
    room.gameState = 'LOBBY';
    room.timer = 0;
    room.systemLogs = [];
    room.mafiaVotes = {};
    room.doctorSave = null;
    room.dayVotes = {};
    room.mafiaChatLogs = [];
    room.dayChatLogs = [];
    room.roundNumber = 0;
    room.nightResult = null;
    room.lynchResult = null;
    room.morningRevealMessage = null;
    room.lynchRevealMessage = null;

    clearRoomTimer(room);

    console.log(`Room ${currentRoomCode} reset to LOBBY by host`);
    
    // Broadcast updated state to all clients in the room
    broadcastRoomState(currentRoomCode);
  });

  // Event: DISCONNECT (Cleanup logic)
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    if (currentRoomCode && rooms[currentRoomCode]) {
      const room = rooms[currentRoomCode];
      
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.connected = false;
        console.log(`Player ${player.name} marked disconnected`);
      }

      // Check if all players in the room are disconnected
      const anyConnected = room.players.some(p => p.connected);
      if (!anyConnected) {
        delete rooms[currentRoomCode];
        clearRoomTimer(room);
        console.log(`Room ${currentRoomCode} deleted (all players disconnected)`);
      } else {
        // Broadcast the updated state showing player disconnected
        broadcastRoomState(currentRoomCode);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
