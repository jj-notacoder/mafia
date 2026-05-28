import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './Lobby';
import WaitingRoom from './WaitingRoom';
import GameArena from './GameArena';

const socket = io('https://mafia-back.onrender.com', {
  autoConnect: true,
});

const getPlayerId = () => {
  let id = sessionStorage.getItem('mafia_player_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('mafia_player_id', id);
  }
  return id;
};

function App() {
  const [playerId] = useState(getPlayerId);
  // Global routing and lobby states
  const [screen, setScreen] = useState('LOBBY'); // 'LOBBY' or 'WAITING_ROOM'
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [kickedAlert, setKickedAlert] = useState(false);
  
  // Media states (defaulting to true)
  const [isAudioPlaying, setIsAudioPlaying] = useState(true);
  const audioRef = useRef(null);

  // Keep Render backend awake on initial page load
  useEffect(() => {
    fetch('https://mafia-back.onrender.com/health')
      .then((res) => res.text())
      .then((data) => console.log('[HEALTH] Render server response:', data))
      .catch((err) => console.warn('[HEALTH] Failed to ping Render server:', err));
  }, []);

  // Audio state effect handler
  useEffect(() => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.play().catch((err) => {
          console.warn('Playback prevented by browser policy until user interaction:', err);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isAudioPlaying]);

  // Document interaction autoplay bypass effect
  useEffect(() => {
    const handleFirstClick = () => {
      if (audioRef.current && isAudioPlaying && audioRef.current.paused) {
        audioRef.current.play().catch((err) => {
          console.warn('Click interaction audio play blocked:', err);
        });
      }
      document.removeEventListener('click', handleFirstClick);
    };

    document.addEventListener('click', handleFirstClick);
    return () => {
      document.removeEventListener('click', handleFirstClick);
    };
  }, [isAudioPlaying]);

  // Global socket listener hooks
  useEffect(() => {
    // Socket connection logger
    socket.on('connect', () => {
      console.log('[SOCKET] Connected to backend ID:', socket.id);
    });

    // Room creation success
    socket.on('roomCreated', ({ roomCode, roomState }) => {
      console.log(`Room created: ${roomCode}`, roomState);
      setRoomCode(roomCode);
      setRoomState(roomState);
      setScreen('WAITING_ROOM');
    });

    // Room join success (guest side)
    socket.on('roomJoined', ({ roomCode, roomState }) => {
      console.log(`Successfully joined room: ${roomCode}`, roomState);
      setRoomCode(roomCode);
      setRoomState(roomState);
      setScreen('WAITING_ROOM');
    });

    // Sync room data broadcasted from server
    const handleRoomStateUpdate = (updatedState) => {
      console.log('Room state updated:', updatedState);
      setRoomState(updatedState);
      
      // If the guest is in the waiting room and the host changes, or players disconnect
      if (updatedState.roomCode) {
        setRoomCode(updatedState.roomCode);
      }

      // If the game has been reset to LOBBY, transition back to WAITING_ROOM screen
      if (updatedState.gameState === 'LOBBY') {
        setScreen('WAITING_ROOM');
      }
    };

    socket.on('roomStateUpdated', handleRoomStateUpdate);
    socket.on('gameStateUpdated', handleRoomStateUpdate);

    // Game starts trigger
    socket.on('gameStarted', () => {
      console.log('Game is starting...');
      setIsAudioPlaying(false); // Cut music when game starts
      setScreen('GAME'); // Transition to gameplay arena
    });

    // Handle generic server errors silently in global app context (Lobby will handle displaying them)
    socket.on('error', (message) => {
      console.error('Socket error:', message);
    });

    socket.on('kickedByHost', () => {
      console.log('You were kicked by the host.');
      sessionStorage.removeItem('mafia_player_id');
      socket.disconnect();
      setScreen('LOBBY');
      setKickedAlert(true);
      setTimeout(() => {
        setKickedAlert(false);
      }, 5000);
      setTimeout(() => {
        socket.connect();
      }, 100);
    });

    return () => {
      socket.off('connect');
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('roomStateUpdated', handleRoomStateUpdate);
      socket.off('gameStateUpdated', handleRoomStateUpdate);
      socket.off('gameStarted');
      socket.off('error');
      socket.off('kickedByHost');
    };
  }, []);

  // Sound toggle helper
  const toggleSound = () => {
    setIsAudioPlaying((prev) => !prev);
  };

  return (
    <div className="relative w-full min-h-screen bg-black overflow-hidden select-none pixel-font text-white flex flex-col items-center justify-center">
      
      {/* Global styling injected for persistent CRT overlays and retro layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        
        .pixel-font {
          font-family: 'Press Start 2P', monospace;
        }
        
        /* CRT scanline effects */
        .crt-scanlines {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(
            rgba(18, 16, 16, 0) 50%, 
            rgba(0, 0, 0, 0.4) 50%
          ), linear-gradient(
            90deg,
            rgba(255, 0, 0, 0.05),
            rgba(0, 255, 0, 0.02),
            rgba(0, 0, 255, 0.05)
          );
          background-size: 100% 4px, 6px 100%;
          z-index: 10;
          pointer-events: none;
          opacity: 0.85;
        }
        
        .crt-vignette {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(circle, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0.8) 100%);
          pointer-events: none;
          z-index: 12;
        }
        
        .crt-light-roll {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(
            rgba(18, 16, 16, 0) 0%,
            rgba(255, 255, 255, 0.08) 10%,
            rgba(18, 16, 16, 0) 20%
          );
          background-size: 100% 300%;
          animation: crt-roll-anim 9s linear infinite;
          z-index: 11;
          pointer-events: none;
        }
        
        @keyframes crt-roll-anim {
          0% { background-position: 0 0; }
          100% { background-position: 0 -300%; }
        }
        
        .crt-flicker {
          animation: crt-flicker-anim 0.15s infinite;
        }
        
        @keyframes crt-flicker-anim {
          0% { opacity: 0.985; }
          50% { opacity: 1; }
          100% { opacity: 0.985; }
        }
        
        /* NES retro borders */
        .pixel-container {
          border: 4px solid #fff;
          box-shadow: 
            0 -4px 0 -2px #000, 
            0 4px 0 -2px #000,
            -4px 0 0 -2px #000, 
            4px 0 0 -2px #000,
            0 0 0 4px #000,
            0 15px 35px rgba(0, 0, 0, 0.9);
        }
        
        /* Arcade button press mechanics */
        .retro-btn {
          position: relative;
          border: 4px solid #000;
          box-shadow: 0 4px 0 #000;
          transition: all 0.05s ease;
        }
        .retro-btn:active {
          transform: translateY(4px);
          box-shadow: 0 0px 0 #000;
        }
        
        .retro-btn-red {
          background: #dc2626;
          color: #fff;
        }
        .retro-btn-red:hover {
          background: #ef4444;
        }
        
        .retro-btn-white {
          background: #e5e7eb;
          color: #000;
        }
        .retro-btn-white:hover {
          background: #ffffff;
        }
        
        /* Win95 classic sound button */
        .classic-win95-btn {
          background: #c0c0c0;
          color: #000;
          border-top: 3px solid #fff;
          border-left: 3px solid #fff;
          border-right: 3px solid #808080;
          border-bottom: 3px solid #808080;
          box-shadow: 
            inset 1px 1px 0px #fff, 
            inset -1px -1px 0px #808080;
          transition: all 0.05s ease;
        }
        .classic-win95-btn:active {
          border-top: 3px solid #808080;
          border-left: 3px solid #808080;
          border-right: 3px solid #fff;
          border-bottom: 3px solid #fff;
          box-shadow: inset 1px 1px 0px #808080;
          transform: translate(1px, 1px);
        }
        
        .pixel-input {
          border: 4px solid #4b5563;
        }
        .pixel-input:focus {
          border-color: #dc2626;
          outline: none;
        }
        
        .arcade-marquee {
          color: #ff0c2b;
          text-shadow: 
            4px 4px 0px #000,
            -1px -1px 0px #000,
            1px -1px 0px #000,
            -1px 1px 0px #000,
            0 0 12px rgba(255, 12, 43, 0.8),
            0 0 24px rgba(255, 12, 43, 0.4);
        }
      ` }} />

      {/* Kicked by Host Alert Banner */}
      {kickedAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border-4 border-black text-white px-6 py-3 font-mono text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(220,38,38,0.8)] animate-bounce select-none">
          YOU WERE KICKED FROM THE ROOM.
        </div>
      )}

      {/* CRT Overlay elements (Persistent across page screen changes) */}
      <div className="crt-scanlines crt-flicker"></div>
      <div className="crt-light-roll"></div>
      <div className="crt-vignette"></div>

      {/* Audio Element for Background Music */}
      <audio
        ref={audioRef}
        src="desktop/mafia/bgmusic1.mp3"
        autoPlay
        loop
      />

      {/* Atmospheric dark cinematic video background (Persistent and will not reset) */}
      <video
        src="desktop/mafia/backgroundvideo.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      
      {/* Hard black transparent layer */}
      <div className="absolute inset-0 bg-black/60 z-1 pointer-events-none"></div>

      {/* Global Sound Control Button */}
      <button
        onClick={toggleSound}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-[calc(1rem+env(safe-area-inset-left))] z-50 classic-win95-btn px-4 py-2 text-[9px] tracking-wider font-bold cursor-pointer flex items-center gap-2 pixel-font"
      >
        <span className={`w-2.5 h-2.5 inline-block ${isAudioPlaying ? 'bg-green-600' : 'bg-red-600'} border border-black/50`}></span>
        SOUND: {isAudioPlaying ? 'ON' : 'OFF'}
      </button>

      {/* Global version text */}
      <div className="fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] w-full text-center z-50 text-[8px] md:text-[9px] text-gray-500 uppercase tracking-widest pixel-font pointer-events-none">
        v1.0.0 - Trust No One
      </div>

      {/* Conditional Screen Rendering Engine */}
      <div className="relative z-10 w-full flex-1 flex flex-col">
        {screen === 'LOBBY' ? (
          <Lobby
            socket={socket}
            playerName={playerName}
            setPlayerName={setPlayerName}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            isJoining={isJoining}
            setIsJoining={setIsJoining}
            playerId={playerId}
          />
        ) : screen === 'WAITING_ROOM' ? (
          <WaitingRoom
            socket={socket}
            roomCode={roomCode}
            roomState={roomState}
            setAudioPlaying={setIsAudioPlaying}
            playerId={playerId}
          />
        ) : (
          <GameArena
            socket={socket}
            localPlayerId={playerId}
            roomState={roomState}
            playerId={playerId}
            onTransitionToWaitingRoom={() => setScreen('WAITING_ROOM')}
          />
        )}
      </div>
    </div>
  );
}

export default App;
