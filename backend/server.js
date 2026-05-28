const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Enable CORS for Socket.io to receive connections from Vite dev server on port 5173
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
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
      socket.emit('error', 'Room not found');
      return;
    }

    if (room.gameState !== 'LOBBY') {
      socket.emit('error', 'Game has already started in this room');
      return;
    }

    currentPlayerName = playerName;
    currentRoomCode = code;

    const newPlayer = {
      id: socket.id,
      name: playerName.toUpperCase(),
      isHost: false,
    };

    room.players.push(newPlayer);
    socket.join(code);

    console.log(`Player ${playerName} (${socket.id}) joined room: ${code}`);

    // Notify all players in room of state update
    io.to(code).emit('roomStateUpdated', room);
    
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

    room.gameState = 'PLAYING';
    console.log(`Room ${currentRoomCode} game starting...`);
    
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
