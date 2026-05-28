import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './Lobby';
import WaitingRoom from './WaitingRoom';

// Temporarily hardcode your live Render URL to guarantee it connects.
// Make sure you replace this string with your ACTUAL Render URL!
// DO NOT put a slash (/) at the very end of the URL.
const socket = io('https://mafia-1-mtgl.onrender.com', {
  autoConnect: true,
});

function App() {
  // Global routing and lobby states
  const [screen, setScreen] = useState('LOBBY'); // 'LOBBY' or 'WAITING_ROOM'
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [roomState, setRoomState] = useState(null);
  
  // Media states
  const [isAudioPlaying, setIsAudioPlaying] = useState(true);
  const audioRef = useRef(null);

  // Audio persistence lifecycle - instantiated once at the root level
  useEffect(() => {
    const audio = new Audio('desktop/mafia/bgmusic1.mp3');
    audio.loop = true;
    audio.volume = 0.25;
    audioRef.current = audio;

    // Try to play immediately (browser autoplay policy may block it until interaction)
    audio.play().catch((err) => {
      console.warn('Initial autoplay blocked by browser policy. Will play on first user interaction:', err);
    });

    // Interaction fallback: play on first click anywhere on page (except sound button)
    const handleFirstClick = (e) => {
      if (e.target && e.target.closest('.classic-win95-btn')) {
        document.removeEventListener('click', handleFirstClick);
        return;
      }
      
      if (audioRef.current && audioRef.current.paused && isAudioPlaying) {
        audioRef.current.play().catch((err) => {
          console.warn('Playback failed on interaction gesture:', err);
        });
      }
      document.removeEventListener('click', handleFirstClick);
    };

    document.addEventListener('click', handleFirstClick);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = null;
      document.removeEventListener('click', handleFirstClick);
    };
  }, []);

  // Global socket listener hooks
  useEffect(() => {
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
    socket.on('roomStateUpdated', (updatedState) => {
      console.log('Room state updated:', updatedState);
      setRoomState(updatedState);
      
      // If the guest is in the waiting room and the host changes, or players disconnect
      if (updatedState.roomCode) {
        setRoomCode(updatedState.roomCode);
      }
    });

    // Game starts trigger
    socket.on('gameStarted', () => {
      console.log('Game is starting...');
      alert('GAME IS STARTING NOW! Trust no one...');
      // TODO: Transition to gameplay screen here (e.g. setScreen('GAME'))
    });

    // Handle generic server errors (e.g. room not found)
    socket.on('error', (message) => {
      alert(message);
    });

    return () => {
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('roomStateUpdated');
      socket.off('gameStarted');
      socket.off('error');
    };
  }, []);

  // Audio utility control functions passed to children
  const toggleSound = () => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn('Audio playback blocked on user click:', err);
      });
    }
    setIsAudioPlaying(!isAudioPlaying);
  };

  const stopMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsAudioPlaying(false);
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none pixel-font text-white flex flex-col items-center justify-center">
      
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

      {/* CRT Overlay elements (Persistent across page screen changes) */}
      <div className="crt-scanlines crt-flicker"></div>
      <div className="crt-light-roll"></div>
      <div className="crt-vignette"></div>

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

      {/* Conditional Screen Rendering Engine */}
      <div className="relative z-10 w-full h-full">
        {screen === 'LOBBY' ? (
          <Lobby
            socket={socket}
            playerName={playerName}
            setPlayerName={setPlayerName}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            isJoining={isJoining}
            setIsJoining={setIsJoining}
            isAudioPlaying={isAudioPlaying}
            toggleSound={toggleSound}
          />
        ) : (
          <WaitingRoom
            socket={socket}
            roomCode={roomCode}
            roomState={roomState}
            isAudioPlaying={isAudioPlaying}
            toggleSound={toggleSound}
            stopMusic={stopMusic}
          />
        )}
      </div>
    </div>
  );
}

export default App;
