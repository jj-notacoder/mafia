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
  return code;
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
      }
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
    const numPlayers = players.length;

    // Shuffle players to assign roles randomly
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Assign roles: 1 Mafia, 1 Doctor (if >= 3 players), rest Civilians
    shuffled.forEach((player, idx) => {
      let role = 'CIVILIAN';
      if (idx === 0) {
        role = 'MAFIA';
      } else if (idx === 1 && numPlayers >= 3) {
        role = 'DOCTOR';
      }
      
      const originalPlayer = room.players.find((p) => p.id === player.id);
      if (originalPlayer) {
        originalPlayer.role = role;
        originalPlayer.isAlive = true;
      }
    });

    room.gameState = 'PLAYING';
    console.log(`Room ${currentRoomCode} game starting...`);
    
    // Broadcast updated state with player roles first
    io.to(currentRoomCode).emit('roomStateUpdated', room);
    io.to(currentRoomCode).emit('gameStateUpdated', room);

    // Emit match start triggers
    io.to(currentRoomCode).emit('gameStarted');
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
        if (room.hostId === socket.id) {
          const newHost = room.players[0];
          room.hostId = newHost.id;
          newHost.isHost = true;
          console.log(`New host for room ${currentRoomCode} assigned: ${newHost.name}`);
        }
        
        // Notify remaining players in the room
        io.to(currentRoomCode).emit('roomStateUpdated', room);
      }
    }
  });
});

server.listen(3001, () => {
  console.log('Server running on port 3001');
});
