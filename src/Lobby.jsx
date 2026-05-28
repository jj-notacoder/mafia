import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Lobby({
  socket,
  playerName,
  setPlayerName,
  roomCode,
  setRoomCode,
  isJoining,
  setIsJoining,
  isAudioPlaying,
  toggleSound,
}) {
  // Socket.io room creation handler
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      alert('PLAYER NAME IS REQUIRED');
      return;
    }
    console.log('Action: EMIT createRoom', { playerName });
    socket.emit('createRoom', { playerName: playerName.toUpperCase() });
  };

  // Socket.io room joining handler
  const handleConfirmJoin = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      alert('PLAYER NAME IS REQUIRED');
      return;
    }
    if (!roomCode.trim() || roomCode.length < 4) {
      alert('INVALID ROOM CODE');
      return;
    }
    console.log('Action: EMIT joinRoom', { playerName, roomCode });
    socket.emit('joinRoom', {
      playerName: playerName.toUpperCase(),
      roomCode: roomCode.toUpperCase(),
    });
  };

  // Framer Motion Animation Variants
  const containerVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        delay: 2.0, // Fade in container 0.5s after title starts
        duration: 0.8,
        ease: 'easeOut'
      } 
    }
  };

  const utilityVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { 
        delay: 2.2, 
        duration: 0.6 
      } 
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between max-h-[85vh] px-4 py-8">
      
      {/* Top spacer */}
      <div className="h-4"></div>

      {/* Title block */}
      <div className="flex flex-col items-center justify-center">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1.0, ease: 'easeOut' }}
          className="text-6xl md:text-8xl font-black uppercase text-center tracking-tighter select-none arcade-marquee"
        >
          MAFIA
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 2.5, duration: 0.5 }}
          className="text-[9px] md:text-[11px] text-red-500 uppercase tracking-[0.25em] mt-3 text-center"
          style={{ textShadow: '0 0 5px rgba(220, 38, 38, 0.5)' }}
        >
          A Multiplayer Game of Deception
        </motion.p>
      </div>

      {/* Lobby Form Card */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm p-6 md:p-8 bg-black/85 backdrop-blur-[2px] pixel-container text-center flex flex-col gap-5 mt-2"
      >
        <div className="flex flex-col gap-2">
          <label className="text-[10px] md:text-xs text-left text-gray-400 uppercase tracking-widest">
            PLAYER IDENTITY:
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="ENTER_NAME_"
            maxLength={12}
            className="bg-black text-white px-4 py-3 text-center uppercase tracking-wider text-xs md:text-sm font-mono pixel-input"
          />
        </div>

        <AnimatePresence mode="wait">
          {!isJoining ? (
            <motion.div
              key="main-options"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <button
                onClick={handleCreateRoom}
                className="retro-btn retro-btn-red py-4 text-xs font-bold tracking-wider uppercase"
              >
                CREATE ROOM
              </button>
              <button
                onClick={() => setIsJoining(true)}
                className="retro-btn retro-btn-white py-4 text-xs font-bold tracking-wider uppercase"
              >
                JOIN ROOM
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="join-options"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <label className="text-[9px] text-red-500 uppercase tracking-widest text-left">
                  ENTER ROOM CODE:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="ROOM_CODE_"
                    maxLength={4}
                    className="flex-1 bg-black text-white px-3 py-3 text-center uppercase tracking-wider text-xs font-mono pixel-input"
                  />
                  <button
                    onClick={handleConfirmJoin}
                    className="retro-btn retro-btn-red px-5 text-xs font-bold tracking-wider uppercase"
                  >
                    OK
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsJoining(false);
                  setRoomCode('');
                }}
                className="text-[9px] text-gray-400 hover:text-white uppercase tracking-wider text-center mt-1 underline cursor-pointer"
              >
                &lt; GO BACK
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer Utility Area */}
      <motion.div
        variants={utilityVariants}
        initial="hidden"
        animate="visible"
        className="flex justify-between items-center w-full px-2"
      >
        <button
          onClick={toggleSound}
          className="classic-win95-btn px-4 py-2 text-[9px] tracking-wider font-bold cursor-pointer flex items-center gap-2"
        >
          <span className={`w-2.5 h-2.5 inline-block ${isAudioPlaying ? 'bg-green-600' : 'bg-red-600'} border border-black/50`}></span>
          SOUND: {isAudioPlaying ? 'ON' : 'OFF'}
        </button>

        <span className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-widest">
          v1.0.0 - Trust No One
        </span>
      </motion.div>
    </div>
  );
}
