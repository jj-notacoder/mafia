import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVATARS } from './avatars';

export default function Lobby({
  socket,
  playerName,
  setPlayerName,
  roomCode,
  setRoomCode,
  isJoining,
  setIsJoining,
  playerId,
}) {
  const [errorMsg, setErrorMsg] = useState('');
  const [joinError, setJoinError] = useState('');

  // Listen to socket error event locally to display error below the input field for 3s
  useEffect(() => {
    const handleError = (message) => {
      if (message === 'Incorrect code pls check it') {
        setJoinError('Incorrect code pls check it');
        const timer = setTimeout(() => {
          setJoinError('');
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        setErrorMsg(message);
        const timer = setTimeout(() => {
          setErrorMsg('');
        }, 3000);
        return () => clearTimeout(timer);
      }
    };

    socket.on('error', handleError);
    return () => {
      socket.off('error', handleError);
    };
  }, [socket]);

  // Socket.io room creation handler
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      alert('PLAYER NAME IS REQUIRED');
      return;
    }
    const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    console.log('Action: EMIT createRoom', { playerName, playerId, avatarId: randomAvatar.id });
    socket.emit('createRoom', { 
      playerName: playerName.toUpperCase(), 
      playerId, 
      avatarId: randomAvatar.id 
    });
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
    const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    console.log('Action: EMIT joinRoom', { playerName, roomCode, playerId, avatarId: randomAvatar.id });
    socket.emit('joinRoom', {
      playerName: playerName.toUpperCase(),
      roomCode: roomCode.toUpperCase(),
      playerId,
      avatarId: randomAvatar.id,
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
    <div className="w-full min-h-screen overflow-hidden flex flex-col items-center justify-between px-4 py-8 relative">
      
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
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase().trim())}
                    placeholder="ROOM_CODE_"
                    maxLength={4}
                    className="flex-1 bg-black text-white px-3 py-3 text-center uppercase tracking-wider text-xs font-mono pixel-input"
                  />
                  <button
                    onClick={handleConfirmJoin}
                    className="retro-btn retro-btn-red px-5 text-xs font-bold tracking-wider uppercase"
                  >
                    CONFIRM
                  </button>
                </div>
                {joinError && (
                  <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider text-left mt-1 animate-pulse">
                    {joinError}
                  </p>
                )}
                {!joinError && errorMsg && (
                  <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider text-left mt-1 animate-pulse">
                    {errorMsg}
                  </p>
                )}
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
    </div>
  );
}
