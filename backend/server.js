const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Enable CORS for Socket.io to allow connections from local dev
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

// Basic HTTP status endpoint
app.get('/status', (req, res) => {
  res.json({ status: 'active', rooms: Object.keys(rooms).length });
});

// In-memory database of room objects
const rooms = {};

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
}

// Start a timer for a room
function startRoomTimer(roomCode, duration, onComplete) {
  const room = rooms[roomCode];
  if (!room) return;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }

  room.timer = duration;
  io.to(roomCode).emit('roomStateUpdated', room);
  io.to(roomCode).emit('gameStateUpdated', room);

  room.timerInterval = setInterval(() => {
    const r = rooms[roomCode];
    if (!r) {
      clearInterval(r.timerInterval);
      return;
    }
    r.timer--;
    if (r.timer <= 0) {
      clearInterval(r.timerInterval);
      r.timerInterval = null;
      onComplete(r);
    } else {
      io.to(roomCode).emit('roomStateUpdated', r);
      io.to(roomCode).emit('gameStateUpdated', r);
    }
  }, 1000);
}

// Clear a room's timer
function clearRoomTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
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
    if (doctor) {
      io.to(doctor.id).emit('doctorTurn');
    }
    
    startRoomTimer(room.roomCode, 15, (r) => {
      resolveNightAndTransitionToDay(r);
    });
  } else {
    // Fake timeout: 3 to 6 seconds
    const fakeDelaySeconds = Math.floor(Math.random() * 4) + 3;
    startRoomTimer(room.roomCode, fakeDelaySeconds, (r) => {
      resolveNightAndTransitionToDay(r);
    });
  }
}

function checkWinConditions(room) {
  const aliveMafia = room.players.filter(p => p.role === 'MAFIA' && p.isAlive).length;
  const aliveCitizens = room.players.filter(p => p.role !== 'MAFIA' && p.isAlive).length;

  if (aliveMafia === 0) {
    room.gameState = 'LOBBY';
    room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Game Over: Civilians win; all Mafia eliminated!' });
    clearRoomTimer(room);
    io.to(room.roomCode).emit('roomStateUpdated', room);
    io.to(room.roomCode).emit('gameStateUpdated', room);
    return true;
  }

  if (aliveMafia >= aliveCitizens) {
    room.gameState = 'LOBBY';
    room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Game Over: Mafia wins; they outnumber Civilians!' });
    clearRoomTimer(room);
    io.to(room.roomCode).emit('roomStateUpdated', room);
    io.to(room.roomCode).emit('gameStateUpdated', room);
    return true;
  }

  return false;
}

function resolveNightAndTransitionToDay(room) {
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

  if (killTargetId) {
    if (killTargetId === room.doctorSave) {
      room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Night fell; Someone was attacked but saved by the Doctor.' });
    } else {
      const victim = room.players.find(p => p.id === killTargetId);
      if (victim) {
        victim.isAlive = false;
        room.systemLogs.push({ id: Date.now().toString(), text: `[SYSTEM] Night results: ${victim.name} was attacked and eliminated.` });
      }
    }
  } else {
    room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Night fell; Quiet night. No one was attacked.' });
  }

  room.mafiaVotes = {};
  room.doctorSave = null;

  const gameOver = checkWinConditions(room);
  if (!gameOver) {
    transitionToDay(room);
  }
}

function transitionToDay(room) {
  room.gameState = 'DAY';
  room.dayVotes = {};
  room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Day Discussion active.' });

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
    resolveVotingAndTransitionToNight(r);
  });
}

function resolveVotingAndTransitionToNight(room) {
  const voteCounts = {};
  const votersCount = Object.keys(room.dayVotes).length;

  if (votersCount > 0) {
    Object.values(room.dayVotes).forEach(targetId => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    let maxVotes = 0;
    let eliminateId = null;
    let isTie = false;

    Object.keys(voteCounts).forEach(tid => {
      if (voteCounts[tid] > maxVotes) {
        maxVotes = voteCounts[tid];
        eliminateId = tid;
        isTie = false;
      } else if (voteCounts[tid] === maxVotes) {
        isTie = true;
      }
    });

    if (eliminateId && !isTie) {
      const victim = room.players.find(p => p.id === eliminateId);
      if (victim) {
        victim.isAlive = false;
        room.systemLogs.push({ id: Date.now().toString(), text: `[SYSTEM] Voting results: ${victim.name} was voted out and eliminated.` });
      }
    } else {
      room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Voting results: No one was eliminated due to a tie or lack of majority.' });
    }
  } else {
    room.systemLogs.push({ id: Date.now().toString(), text: '[SYSTEM] Voting results: No votes cast. No one was eliminated.' });
  }

  room.dayVotes = {};

  const gameOver = checkWinConditions(room);
  if (!gameOver) {
    transitionToNightMafia(room);
  }
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Track the room and player name associated with this socket
  let currentRoomCode = null;
  let currentPlayerName = null;

  // Event: CREATE ROOM (Host trigger)
  socket.on('createRoom', ({ playerName }) => {
    if (!playerName) {
      socket.emit('error', 'Player name is required');
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
          id: socket.id,
          name: playerName.toUpperCase(),
          role: null,
          isAlive: true,
          isHost: true,
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
    };

    socket.join(roomCode);
    console.log(`Room created: ${roomCode} by host: ${playerName} (${socket.id})`);
    
    // Send configuration back to host
    socket.emit('roomCreated', {
      roomCode,
      roomState: rooms[roomCode]
    });
  });

  // Event: JOIN ROOM (Guest trigger)
  socket.on('joinRoom', ({ playerName, roomCode }) => {
    const code = roomCode ? roomCode.toUpperCase().trim() : '';
    if (!playerName || !code) {
      socket.emit('error', 'Name and Room Code are required');
      return;
    }

    const room = rooms[code];
    if (!room) {
      socket.emit('error', 'Invalid Room Code');
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
      id: socket.id,
      name: playerName,
      role: null,
      isAlive: true,
      isHost: false,
    };

    room.players.push(newPlayer);
    socket.join(code);

    console.log(`Player ${playerName} (${socket.id}) joined room: ${code}`);

    // Notify all players in room of state update
    io.to(code).emit('roomStateUpdated', room);
    io.to(code).emit('gameStateUpdated', room);
    
    // Explicitly send success payload back to guest to transition screen
    socket.emit('roomJoined', {
      roomCode: code,
      roomState: room
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
    io.to(currentRoomCode).emit('roomStateUpdated', room);
  });

  // Event: START GAME (Host begins match)
  socket.on('startGame', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;

    const room = rooms[currentRoomCode];
    if (room.hostId !== socket.id) {
      socket.emit('error', 'Only the host can start the game');
      return;
    }

    const players = room.players;
    const N = players.length;

    if (N < 3) {
      socket.emit('error', 'Need at least 3 players');
      return;
    }

    // Role count calculation
    const doctorCount = 1;
    let mafiaCount = 1;
    if (N >= 5 && N <= 7) {
      mafiaCount = 2;
    } else if (N >= 8) {
      mafiaCount = 3;
    }
    const civilianCount = N - doctorCount - mafiaCount;

    // Fill roles array
    const roles = [];
    for (let i = 0; i < mafiaCount; i++) roles.push('MAFIA');
    for (let i = 0; i < doctorCount; i++) roles.push('DOCTOR');
    for (let i = 0; i < civilianCount; i++) roles.push('CIVILIAN');

    // Shuffle roles randomly
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    // Assign roles to players in original room list
    room.players.forEach((player, idx) => {
      player.role = roles[idx];
      player.isAlive = true;
    });

    console.log(`Room ${currentRoomCode} starting with roles:`, roles);

    // Transition to role reveal phase (4 seconds)
    transitionToRoleReveal(room);

    // Emit match start triggers
    io.to(currentRoomCode).emit('gameStarted');
  });

  // Event: MAFIA TARGET ACTION
  socket.on('mafiaTarget', ({ targetId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.gameState !== 'NIGHT_MAFIA') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'MAFIA' || !player.isAlive) return;

    room.mafiaVotes[socket.id] = targetId;
    console.log(`Mafia ${player.name} voted for target ${targetId}`);

    const aliveMafia = room.players.filter(p => p.role === 'MAFIA' && p.isAlive);
    const votes = aliveMafia.map(m => room.mafiaVotes[m.id]);
    
    const allVoted = votes.every(v => v !== undefined);
    const unanimous = votes.every(v => v === votes[0]);

    io.to(currentRoomCode).emit('roomStateUpdated', room);
    io.to(currentRoomCode).emit('gameStateUpdated', room);

    if (allVoted && unanimous) {
      clearRoomTimer(room);
      transitionToNightDoctor(room);
    }
  });

  // Event: DOCTOR TARGET ACTION
  socket.on('doctorTarget', ({ targetId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.gameState !== 'NIGHT_DOCTOR') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'DOCTOR' || !player.isAlive) return;

    room.doctorSave = targetId;
    console.log(`Doctor ${player.name} protected ${targetId}`);

    io.to(currentRoomCode).emit('roomStateUpdated', room);
    io.to(currentRoomCode).emit('gameStateUpdated', room);

    clearRoomTimer(room);
    resolveNightAndTransitionToDay(room);
  });

  // Event: DAY VOTE ACTION
  socket.on('dayVote', ({ targetId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.gameState !== 'VOTING') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive) return;

    room.dayVotes[socket.id] = targetId;
    console.log(`Player ${player.name} voted for ${targetId}`);

    const alivePlayers = room.players.filter(p => p.isAlive);
    const allVoted = alivePlayers.every(p => room.dayVotes[p.id] !== undefined);

    io.to(currentRoomCode).emit('roomStateUpdated', room);
    io.to(currentRoomCode).emit('gameStateUpdated', room);

    if (allVoted) {
      clearRoomTimer(room);
      resolveVotingAndTransitionToNight(room);
    }
  });

  // Event: MAFIA CHAT MESSAGE
  socket.on('mafiaChat', ({ msg }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'MAFIA' || !player.isAlive) return;

    const msgObj = { id: Date.now().toString(), text: `[MAFIA] ${player.name}: ${msg}` };
    room.mafiaChatLogs.push(msgObj);

    room.players.forEach(p => {
      if (p.role === 'MAFIA') {
        io.to(p.id).emit('mafiaChatReceived', msgObj);
      }
    });
  });

  // Event: DISCONNECT (Cleanup logic)
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    if (currentRoomCode && rooms[currentRoomCode]) {
      const room = rooms[currentRoomCode];
      
      // Filter out the disconnected player
      room.players = room.players.filter((p) => p.id !== socket.id);
      
      if (room.players.length === 0) {
        // If room is empty, clean it up from memory
        delete rooms[currentRoomCode];
        console.log(`Room ${currentRoomCode} deleted (empty)`);
      } else {
        // If host disconnected, assign the crown to the next active player
        // If host disconnected, assign the crown to the next active player
        if (room.hostId === socket.id) {
          const newHost = room.players[0];
          room.hostId = newHost.id;
          newHost.isHost = true;
          console.log(`New host for room ${currentRoomCode} assigned: ${newHost.name}`);
        }
        
        // Clear timer if no one is left
        if (room.players.length === 0) {
          clearRoomTimer(room);
        }

        // Notify remaining players in the room
        io.to(currentRoomCode).emit('roomStateUpdated', room);
        io.to(currentRoomCode).emit('gameStateUpdated', room);
      }
      }
    }
  });
});

server.listen(3001, () => {
  console.log('Server running on port 3001');
});
