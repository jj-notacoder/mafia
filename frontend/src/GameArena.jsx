import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVATARS } from './avatars';

const availableAvatars = AVATARS;

export default function GameArena({
  socket,
  localPlayerId,
  roomState,
  playerId,
  onTransitionToWaitingRoom,
}) {
  const [isRevealing, setIsRevealing] = useState(true);
  const [targetPlayer, setTargetPlayer] = useState('');
  const [mafiaChatMsg, setMafiaChatMsg] = useState('');
  const [dayChatMsg, setDayChatMsg] = useState('');
  const [showHostControls, setShowHostControls] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showHostBanner, setShowHostBanner] = useState(false);
  
  // Extract values from roomState
  const gameState = roomState ? roomState.gameState : 'LOBBY';
  const players = roomState ? roomState.players : [];
  const systemLogs = roomState ? roomState.systemLogs : [];
  const mafiaChatLogs = roomState ? roomState.mafiaChatLogs : [];
  
  const chatEndRef = useRef(null);

  // Auto-scroll chat / logs to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mafiaChatLogs, systemLogs, roomState?.dayChatLogs]);

  // Role reveal timer - exactly 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRevealing(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Socket listeners for alerts and host delegation
  useEffect(() => {
    const handleSystemAlert = (msg) => {
      setToastMsg(msg);
      const timer = setTimeout(() => {
        setToastMsg('');
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleHostTransferred = () => {
      setShowHostBanner(true);
      const timer = setTimeout(() => {
        setShowHostBanner(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    socket.on('systemAlert', handleSystemAlert);
    socket.on('hostTransferred', handleHostTransferred);

    return () => {
      socket.off('systemAlert', handleSystemAlert);
      socket.off('hostTransferred', handleHostTransferred);
    };
  }, [socket]);

  // Morning banner effect handled globally by server gameState changes

  // Retrieve local player details
  const localPlayer = players.find((p) => p.id === localPlayerId) || {
    name: 'UNKNOWN',
    role: 'CIVILIAN',
    isAlive: true,
    isHost: false,
  };

  const role = localPlayer.role || 'CIVILIAN';
  const isAlive = localPlayer.isAlive;
  const otherMafias = players.filter(p => p.role === 'MAFIA' && p.id !== localPlayerId);

  // Set role colors and subtexts
  let roleColorClass = 'text-blue-300';
  let roleBorderColor = 'border-blue-400';
  let roleBgClass = 'bg-blue-950/20';
  let subtext = 'FIND THE KILLERS';

  if (role === 'MAFIA') {
    roleColorClass = 'text-red-600';
    roleBorderColor = 'border-red-600';
    roleBgClass = 'bg-red-950/20';
    subtext = 'ELIMINATE THE TOWN';
  } else if (role === 'DOCTOR') {
    roleColorClass = 'text-white';
    roleBorderColor = 'border-white';
    roleBgClass = 'bg-gray-900/60';
    subtext = 'PROTECT THE INNOCENT';
  }

  // Determine game phase
  const isNight = gameState === 'NIGHT_MAFIA' || gameState === 'NIGHT_DOCTOR';

  // Blocker text overlay logic for inactive players during night phases
  let showBlockerOverlay = false;
  let blockerText = '';

  if (!isRevealing && isAlive) {
    if (gameState === 'NIGHT_MAFIA' && role !== 'MAFIA') {
      showBlockerOverlay = true;
      blockerText = 'THE MAFIA IS PLOTTING...';
    } else if (gameState === 'NIGHT_DOCTOR' && role !== 'DOCTOR') {
      showBlockerOverlay = true;
      blockerText = 'THE DOCTOR IS MAKING THEIR ROUNDS...';
    }
  }

  // Deterministic 8-bit sprite generator for retro avatars
  const getAvatarSvg = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const grid = [];
    for (let r = 0; r < 8; r++) {
      grid[r] = [];
      for (let c = 0; c < 4; c++) {
        const bit = (hash >> (r * 4 + c)) & 1;
        grid[r][c] = bit;
      }
    }
    
    const pixels = [];
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
    const color = colors[Math.abs(hash) % colors.length];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isColored = c < 4 ? grid[r][c] : grid[r][7 - c];
        if (isColored) {
          pixels.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill={color} />);
        }
      }
    }
    return (
      <svg className="w-12 h-12 border-2 border-gray-600 bg-black/60 p-1 flex-shrink-0" viewBox="0 0 8 8" style={{ imageRendering: 'pixelated' }}>
        {pixels}
      </svg>
    );
  };

  const handleSendMafiaMsg = (e) => {
    e.preventDefault();
    if (!mafiaChatMsg.trim()) return;
    socket.emit('mafiaChat', { msg: mafiaChatMsg });
    setMafiaChatMsg('');
  };

  const handleActionSubmit = (e) => {
    e.preventDefault();
    if (!targetPlayer) return;
    const eventName = role === 'MAFIA' ? 'mafiaTarget' : 'doctorTarget';
    socket.emit(eventName, { targetId: targetPlayer });
    setTargetPlayer('');
  };

  const handleSendDayMsg = (e) => {
    e.preventDefault();
    if (!dayChatMsg.trim()) return;
    socket.emit('sendDayMessage', { msg: dayChatMsg });
    setDayChatMsg('');
  };

  // Vote checking helper variables

  return (
    <div className="w-full min-h-screen overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Top-Left Layout Container */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        <button
          onClick={() => setShowLeaveModal(true)}
          className="retro-btn retro-btn-red px-3 py-2 text-xs md:text-sm lg:text-base tracking-wider font-bold cursor-pointer pixel-font"
        >
          LEAVE GAME
        </button>

        {localPlayer?.isHost && (
          <button
            onClick={() => setShowHostControls(prev => !prev)}
            className="retro-btn retro-btn-white px-3 py-2 text-xs md:text-sm lg:text-base tracking-wider font-bold cursor-pointer pixel-font"
          >
            HOST CONTROLS
          </button>
        )}
      </div>

      {/* Host Controls Slide-Out Panel */}
      <AnimatePresence>
        {showHostControls && localPlayer?.isHost && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 w-64 h-full bg-black/95 border-r-4 border-gray-700 z-[65] p-5 flex flex-col justify-between pixel-font text-white"
          >
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
                <span className="text-[10px] md:text-xs text-yellow-500 font-bold uppercase tracking-wider">HOST PANEL</span>
                <button
                  onClick={() => setShowHostControls(false)}
                  className="text-gray-400 hover:text-white font-bold text-xs"
                >
                  [X]
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
                <span className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">PLAYER ROSTER:</span>
                {players.map((p) => (
                  <div key={p.id} className="flex justify-between items-center p-2 border border-gray-800 bg-black/40 text-[9px]">
                    <div className="truncate max-w-[120px] flex flex-col">
                      <span className={p.isAlive ? 'text-white' : 'text-gray-600 line-through'}>{p.name}</span>
                      <span className="text-[6px] text-gray-500">
                        {p.isHost ? 'HOST' : p.isAlive ? 'ALIVE' : 'DEAD'} {p.connected === false ? '(AWAY)' : ''}
                      </span>
                    </div>
                    {!p.isHost && (
                      <div className="flex gap-1.5">
                        {p.connected !== false && (
                          <button
                            onClick={() => socket.emit('transferHost', { targetPlayerId: p.id })}
                            className="retro-btn bg-yellow-500 hover:bg-yellow-400 text-black px-1.5 py-0.5 text-[6px] font-black uppercase tracking-wider cursor-pointer"
                          >
                            MAKE HOST
                          </button>
                        )}
                        <button
                          onClick={() => socket.emit('kickPlayer', { targetPlayerId: p.id })}
                          className="retro-btn retro-btn-red px-1.5 py-0.5 text-[6px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          KICK
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4 mt-4">
              <button
                onClick={() => socket.emit('forceSkipPhase')}
                className="w-full retro-btn retro-btn-red py-2.5 text-[8px] font-bold tracking-widest uppercase cursor-pointer"
              >
                FORCE SKIP PHASE
              </button>
              <p className="text-[6px] text-gray-500 text-center mt-2 leading-normal uppercase">
                Use if timer or phase transition gets stuck.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave Game Confirmation Modal */}
      <AnimatePresence>
        {showLeaveModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLeaveModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-black/90 border-4 border-red-600 p-6 md:p-8 max-w-sm w-full mx-4 shadow-[8px_8px_0_rgba(0,0,0,0.8)] z-10 text-center pixel-font"
            >
              <h2 className="text-red-500 text-xs md:text-sm font-bold uppercase tracking-wider mb-4 leading-relaxed">
                ARE YOU SURE YOU WANT TO LEAVE? YOU CANNOT JOIN BACK.
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="retro-btn retro-btn-white px-4 py-2.5 text-[9px] md:text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => {
                    socket.emit('leaveRoom', { roomCode: roomState?.roomCode });
                    sessionStorage.clear();
                    localStorage.clear();
                    socket.disconnect();
                    window.location.reload();
                  }}
                  className="retro-btn retro-btn-red px-4 py-2.5 text-[9px] md:text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  CONFIRM
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Alerts system - systemAlert Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-black/95 border-4 border-red-600 text-red-500 px-6 py-3 font-mono text-[9px] md:text-xs font-bold tracking-wider uppercase pixel-font shadow-[0_0_15px_rgba(220,38,38,0.5)] flex items-center justify-center text-center"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Alerts system - hostTransferred Banner */}
      <AnimatePresence>
        {showHostBanner && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-black border-4 border-yellow-500 px-8 py-6 text-center shadow-[0_0_30px_rgba(234,179,8,0.6)]">
              <h1 className="text-xl md:text-3xl font-black text-yellow-400 uppercase tracking-widest pixel-font animate-pulse">
                YOU ARE NOW THE HOST
              </h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned Round, Phase & Countdown Timer - Pinned permanently to top center of screen */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex gap-2 md:gap-4 select-none whitespace-nowrap">
        <div className="bg-black/90 border-4 border-yellow-400 text-yellow-400 px-3 md:px-4 py-2 font-mono text-[9px] md:text-sm font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(234,179,8,0.4)]">
          ROUND: {roomState ? roomState.roundNumber || 1 : 1}
        </div>
        <div className="bg-black/90 border-4 border-yellow-400 text-yellow-400 px-3 md:px-4 py-2 font-mono text-[9px] md:text-sm font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(234,179,8,0.4)]">
          PHASE: {gameState === 'NIGHT_MAFIA' || gameState === 'NIGHT_DOCTOR' ? 'NIGHT' : gameState}
        </div>
        <div className="bg-black/90 border-4 border-yellow-400 text-yellow-400 px-3 md:px-4 py-2 font-mono text-[9px] md:text-sm font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(234,179,8,0.4)]">
          TIME: {roomState ? roomState.timer : 0}s
        </div>
      </div>

      {/* Ghost Mode Indicator */}
      {!isAlive && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-red-950/90 border-2 border-red-600 text-red-500 px-4 py-1.5 text-[8px] font-bold tracking-widest uppercase pixel-font animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]">
          GHOST MODE - SPECTATING
        </div>
      )}

      {/* Cinematic Reveal Banner Overlay */}
      {(gameState === 'MORNING_REVEAL' || gameState === 'LYNCH_REVEAL') && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center select-none">
          {/* CRT overlay elements */}
          <div className="crt-scanlines crt-flicker"></div>
          <div className="crt-light-roll"></div>
          <div className="crt-vignette"></div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 1.05, 1], opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center px-6 max-w-2xl"
          >
            {gameState === 'MORNING_REVEAL' ? (
              <>
                <h2 className="text-sm md:text-md text-gray-500 uppercase tracking-[0.3em] mb-6">
                  MORNING REPORT
                </h2>
                {roomState?.morningRevealMessage && !roomState.morningRevealMessage.startsWith('No one') ? (
                  <h1 className="text-xl md:text-4xl font-black uppercase tracking-wider pixel-font text-red-600 animate-pulse leading-normal">
                    {roomState.morningRevealMessage} in the night
                  </h1>
                ) : (
                  <h1 className="text-xl md:text-4xl font-black uppercase tracking-wider pixel-font text-blue-400 leading-normal">
                    No one was eliminated in the night
                  </h1>
                )}
              </>
            ) : (
              <>
                <h2 className="text-sm md:text-md text-gray-500 uppercase tracking-[0.3em] mb-6">
                  VOTING RESULT
                </h2>
                <h1 className={`text-xl md:text-4xl font-black uppercase tracking-wider pixel-font leading-normal ${
                  roomState?.lynchRevealMessage?.includes('MAFIA') ? 'text-red-600 animate-pulse' :
                  roomState?.lynchRevealMessage?.includes('DOCTOR') ? 'text-white' :
                  roomState?.lynchRevealMessage?.includes('CIVILIAN') ? 'text-blue-400' : 'text-yellow-500'
                }`}>
                  {roomState?.lynchRevealMessage || 'No one was eliminated'}
                </h1>
              </>
            )}
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {isRevealing && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center select-none"
          >
            {/* CRT overlay elements */}
            <div className="crt-scanlines crt-flicker"></div>
            <div className="crt-light-roll"></div>
            <div className="crt-vignette"></div>

            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1, 1.05, 1], opacity: 1 }}
              transition={{ times: [0, 0.4, 0.8, 1], duration: 3.5, ease: 'easeOut' }}
              className="text-center px-6"
            >
              <h2 className="text-sm md:text-md text-gray-500 uppercase tracking-[0.3em] mb-4">
                YOUR IDENTITY
              </h2>
              
              <h1 className={`text-4xl md:text-7xl font-black uppercase tracking-wider mb-6 pixel-font ${roleColorClass}`}>
                {role}
              </h1>
              
              <p className="text-xs md:text-sm text-gray-400 tracking-[0.2em] uppercase font-mono mt-4">
                {subtext}
              </p>

              {role === 'MAFIA' && otherMafias.length > 0 && (
                <div className="mt-8 border-t-2 border-red-950/60 pt-4 flex flex-col items-center">
                  <p className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-widest mb-3 font-mono">
                    TEAM MEMBERS:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2.5">
                    {otherMafias.map(m => (
                      <span key={m.id} className="text-[10px] text-red-500 font-mono uppercase font-bold bg-red-950/40 border border-red-800/40 px-3 py-1.5 shadow-[0_0_8px_rgba(220,38,38,0.2)] animate-pulse">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Interface (renders behind the overlay and appears once overlay fades) */}
      <div className={`w-full max-w-5xl bg-black/70 backdrop-blur-md border border-gray-600 shadow-[8px_8px_0_rgba(0,0,0,0.8),_inset_1px_1px_0_rgba(255,255,255,0.2)] rounded-sm text-white p-5 flex flex-col gap-5 overflow-y-auto max-h-[85vh] relative ${
        (gameState === 'MORNING_REVEAL' || gameState === 'LYNCH_REVEAL') ? 'pointer-events-none select-none opacity-10 filter blur-md' : ''
      }`}>
        
        {/* Night Sub-Phase Blocker Overlay */}
        {showBlockerOverlay && (
          <div className="absolute inset-0 bg-black z-30 flex flex-col items-center justify-center select-none rounded">
            <div className="crt-scanlines crt-flicker"></div>
            <div className="crt-light-roll"></div>
            <div className="crt-vignette"></div>
            <span className="text-4xl animate-pulse mb-4">🌙</span>
            <p className="text-xs md:text-sm text-red-500 uppercase font-bold tracking-[0.25em] text-center px-4 pixel-font animate-pulse">
              {blockerText}
            </p>
          </div>
        )}

        {/* Header Panel */}
        <div className="border-b-4 border-gray-700 pb-4 flex flex-col sm:flex-row justify-between items-center gap-4 relative">
          <div className="text-center sm:text-left">
            <h1 className="text-lg md:text-xl font-bold uppercase tracking-widest arcade-marquee">
              MAFIA
            </h1>
            <span className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-widest">
              Game in progress
            </span>
          </div>

          {/* 3D Glass Role Card placed in the absolute center of the header panel */}
          <div className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex items-center justify-center">
            <div className={`backdrop-blur-md border-4 px-5 py-2.5 text-xs md:text-sm font-black uppercase tracking-widest select-none shadow-[0_4px_15px_rgba(0,0,0,0.5)] ${
              role === 'MAFIA' ? 'bg-red-500/20 border-red-600 text-red-500' :
              role === 'DOCTOR' ? 'bg-white/20 border-white text-white' :
              'bg-blue-400/20 border-blue-400 text-blue-300'
            }`}>
              ROLE: {role}
            </div>
          </div>

          {/* Right side spacer to keep layout balanced */}
          <div className="hidden sm:block w-32"></div>
        </div>

        {/* Modular Grid Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[300px]">
          
          {/* Player Cards (takes 2 columns on medium screens) */}
          <div className="md:col-span-2 p-4 bg-black/70 backdrop-blur-md border border-gray-600 shadow-[8px_8px_0_rgba(0,0,0,0.8),_inset_1px_1px_0_rgba(255,255,255,0.2)] rounded-sm flex flex-col gap-3">
            <h3 className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2">
              LOBBY ROSTER
            </h3>
            
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:gap-4 overflow-y-auto max-h-[45vh] pr-1">
              {players.map((player) => {
                const playerIsLocal = player.id === localPlayerId;
                const playerIsAlive = player.isAlive !== false;

                // Live vote tracking calculations
                const dayVotesReceived = Object.values(roomState?.dayVotes || {}).filter(targetId => targetId === player.id).length;
                const totalAlivePlayers = players.filter(pl => pl.isAlive !== false).length;
                const dayVotePct = totalAlivePlayers > 0 ? (dayVotesReceived / totalAlivePlayers) * 100 : 0;

                const mafiaVotesReceived = Object.values(roomState?.mafiaVotes || {}).filter(targetId => targetId === player.id).length;
                const totalAliveMafia = players.filter(pl => pl.role === 'MAFIA' && pl.isAlive !== false).length;
                const mafiaVotePct = totalAliveMafia > 0 ? (mafiaVotesReceived / totalAliveMafia) * 100 : 0;

                const isCardClickable = isAlive && playerIsAlive && (
                  (gameState === 'VOTING') ||
                  (gameState === 'NIGHT_MAFIA' && role === 'MAFIA' && player.role !== 'MAFIA')
                );

                const playerAvatar = availableAvatars.find(a => a.id === player.avatarId);
                const avatarSrc = playerAvatar ? playerAvatar.src : null;
                const avatarName = playerAvatar ? playerAvatar.name : 'Unknown Agent';

                return (
                  <div
                    key={player.id}
                    onClick={() => isCardClickable && socket.emit('updateVote', { targetId: player.id })}
                    className={`relative border-2 p-3 flex flex-col items-center text-center gap-2 transition-colors ${
                      playerIsLocal ? 'border-red-600 bg-red-950/20' : 'border-gray-800 bg-black/60'
                    } ${!playerIsAlive ? 'opacity-40 bg-black/80' : ''} ${
                      isCardClickable ? 'cursor-pointer hover:border-yellow-500' : ''
                    }`}
                  >
                    {/* Avatar Container with Dead X Overlay */}
                    <div className="relative flex-shrink-0">
                      <div className="relative w-16 h-16 border-2 border-gray-600 bg-black/60 flex items-center justify-center">
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={avatarName}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          getAvatarSvg(player.name)
                        )}
                        {!playerIsAlive && (
                          <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center text-red-600 text-3xl font-black select-none border-2 border-red-600">
                            X
                          </div>
                        )}
                      </div>
                      
                      {playerIsLocal && (
                        <span className="absolute -top-2 -right-2 text-[6px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded select-none">
                          YOU
                        </span>
                      )}
                    </div>

                    {/* Player Details */}
                    <div className="flex-1 w-full min-w-0 flex flex-col items-center">
                      <p className={`text-xs md:text-sm lg:text-base uppercase tracking-wider truncate font-mono ${
                        !playerIsAlive ? 'line-through text-gray-600' : 'text-white'
                      }`}>
                        {player.name}
                      </p>
                      <p className="text-gray-400 text-[10px] uppercase font-mono tracking-wide truncate w-full mt-0.5">
                        {avatarName}
                      </p>
                      <span className={`text-[8px] uppercase tracking-widest font-bold mt-1 ${
                        playerIsAlive ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {playerIsAlive ? 'ALIVE' : 'DEAD'}
                      </span>
                    </div>

                    {/* Action Area */}
                    <div className="flex gap-2 justify-center items-center mt-1">
                      {gameState === 'VOTING' && isAlive && playerIsAlive && roomState?.dayVotes?.[localPlayerId] !== player.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // prevent double emission from card click
                            socket.emit('updateVote', { targetId: player.id });
                          }}
                          className="retro-btn retro-btn-red px-2 py-1 text-xs md:text-sm lg:text-base font-bold uppercase tracking-wider cursor-pointer animate-pulse"
                        >
                          VOTE
                        </button>
                      )}

                      {gameState === 'VOTING' && roomState?.dayVotes?.[localPlayerId] === player.id && (
                        <span className="text-xs md:text-sm lg:text-base text-green-500 font-bold uppercase tracking-widest animate-pulse">
                          VOTED
                        </span>
                      )}

                      {gameState === 'NIGHT_MAFIA' && role === 'MAFIA' && roomState?.mafiaVotes?.[localPlayerId] === player.id && (
                        <span className="text-xs md:text-sm lg:text-base text-red-500 font-bold uppercase tracking-widest animate-pulse">
                          TARGETED
                        </span>
                      )}
                    </div>

                    {/* Live Vote Progress Bar during Day Voting */}
                    {gameState === 'VOTING' && playerIsAlive && (
                      <div className="w-full mt-1 text-left">
                        <div className="flex justify-between text-[7px] text-yellow-400 font-mono mb-0.5">
                          <span>VOTES RECEIVING</span>
                          <span>{dayVotesReceived}/{totalAlivePlayers} Votes</span>
                        </div>
                        <div className="w-full bg-gray-950 border border-gray-800 h-2 rounded-sm overflow-hidden">
                          <div
                            className="bg-yellow-500 h-full transition-all duration-300 shadow-[0_0_8px_rgba(234,179,8,0.6)]"
                            style={{ width: `${dayVotePct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Live Target Progress Bar during Mafia Night Voting */}
                    {gameState === 'NIGHT_MAFIA' && role === 'MAFIA' && isAlive && playerIsAlive && player.role !== 'MAFIA' && (
                      <div className="w-full mt-1 text-left">
                        <div className="flex justify-between text-[7px] text-red-500 font-mono mb-0.5">
                          <span>TARGETED</span>
                          <span>{mafiaVotesReceived}/{totalAliveMafia} Votes</span>
                        </div>
                        <div className="w-full bg-gray-950 border border-gray-800 h-2 rounded-sm overflow-hidden">
                          <div
                            className="bg-red-600 h-full transition-all duration-300 shadow-[0_0_8px_rgba(220,38,38,0.6)]"
                            style={{ width: `${mafiaVotePct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Action Panel (takes 1 column) */}
          <div className="p-4 bg-black/70 backdrop-blur-md border border-gray-600 shadow-[8px_8px_0_rgba(0,0,0,0.8),_inset_1px_1px_0_rgba(255,255,255,0.2)] rounded-sm flex flex-col gap-3 h-full justify-between">
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              <h3 className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2">
                ACTION PANEL
              </h3>

              {!isAlive && (gameState === 'NIGHT_MAFIA' || gameState === 'NIGHT_DOCTOR') ? (
                // Night Phase overlay for dead players (Ghosts)
                <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-gray-800 bg-black text-gray-400 gap-2 my-auto select-none">
                  <span className="text-3xl animate-pulse">🌙</span>
                  <span className="text-[10px] font-bold tracking-widest uppercase">
                    THE TOWN IS ASLEEP...
                  </span>
                  <p className="text-[9px] text-yellow-500 font-bold uppercase tracking-wider mt-1">
                    TIME REMAINING: {roomState ? roomState.timer : 0}S
                  </p>
                </div>
              ) : gameState === 'DAY' ? (
                // Day Phase chat debate (shared by alive players and ghosts)
                <div className="flex flex-col gap-2 flex-1 min-h-0 justify-between">
                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <span className="text-[9px] text-yellow-400 uppercase tracking-wider font-bold">
                      DAY DISCUSSION CHAT:
                    </span>
                    <div className="flex-1 bg-black border-2 border-gray-800 p-2 font-mono text-[8px] md:text-[9px] text-green-400 overflow-y-auto max-h-[30vh] md:max-h-[50vh]">
                      {(roomState?.dayChatLogs || []).map((log) => (
                        <p key={log.id} className="mb-1 leading-normal">
                          {log.text}
                        </p>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  </div>

                  {isAlive ? (
                    <form onSubmit={handleSendDayMsg} className="flex gap-2">
                      <input
                        type="text"
                        value={dayChatMsg}
                        onChange={(e) => setDayChatMsg(e.target.value)}
                        placeholder="DISCUSS_"
                        className="flex-1 bg-black border border-gray-700 text-white text-[9px] font-mono px-2 py-1 outline-none"
                      />
                      <button type="submit" className="retro-btn retro-btn-red text-[8px] font-bold px-3 uppercase">
                        SEND
                      </button>
                    </form>
                  ) : (
                    <div className="bg-gray-950 border border-gray-800 text-gray-500 text-[9px] font-mono py-2 text-center select-none uppercase tracking-widest">
                      GHOSTS CANNOT SPEAK
                    </div>
                  )}

                  <p className="text-[7px] text-gray-500 uppercase tracking-widest text-center mt-2 leading-normal">
                    Debate with other players and find the Mafia.
                  </p>
                </div>
              ) : gameState === 'VOTING' ? (
                // Voting Phase action logs (shared by alive and ghosts)
                <div className="flex flex-col gap-2 flex-1 min-h-0 justify-between">
                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <span className="text-[9px] text-red-500 uppercase tracking-wider font-bold">
                      SYSTEM ACTION LOG:
                    </span>
                    <div className="flex-1 bg-black border-2 border-gray-800 p-2 font-mono text-[8px] md:text-[9px] text-green-500 overflow-y-auto max-h-[30vh] md:max-h-[50vh]">
                      {systemLogs.map((log) => (
                        <p key={log.id} className="mb-1 leading-normal">
                          {log.text}
                        </p>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  </div>

                  {/* Voting skip button for alive players only */}
                  {isAlive && roomState?.dayVotes?.[localPlayerId] !== 'SKIP' && (
                    <button
                      onClick={() => socket.emit('updateVote', { targetId: 'SKIP' })}
                      className="retro-btn retro-btn-white py-2 text-[9px] font-bold uppercase tracking-wider mt-2 cursor-pointer w-full"
                    >
                      SKIP VOTE
                    </button>
                  )}

                  {/* Voted Skip label */}
                  {isAlive && roomState?.dayVotes?.[localPlayerId] === 'SKIP' && (
                    <div className="flex flex-col items-center mt-2">
                      <span className="text-[9px] text-green-500 font-bold uppercase tracking-widest text-center animate-pulse">
                        YOU VOTED TO SKIP
                      </span>
                    </div>
                  )}

                  <p className="text-[7px] text-gray-500 uppercase tracking-widest text-center mt-2 leading-normal">
                    Select a player on the roster grid or click Skip to cast your vote.
                  </p>
                </div>
              ) : gameState === 'NIGHT_MAFIA' && role === 'MAFIA' && isAlive ? (
                // Night Phase - Mafia (only visible to living Mafia)
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                  <span className="text-[9px] text-red-500 uppercase tracking-wider font-bold">
                    MAFIA BOARD (NIGHT CHAT) {roomState?.mafiaVoteStatus ? `[${roomState.mafiaVoteStatus}]` : ''}:
                  </span>
                  
                  {/* Mafia Private Chat */}
                  <div className="flex-1 bg-black border-2 border-gray-800 p-2 font-mono text-[8px] md:text-[9px] text-red-500 overflow-y-auto max-h-[30vh] md:max-h-[50vh]">
                    {mafiaChatLogs.map((log) => (
                      <p key={log.id} className="mb-1 leading-normal">
                        {log.text}
                      </p>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Send Message Form */}
                  <form onSubmit={handleSendMafiaMsg} className="flex gap-2">
                    <input
                      type="text"
                      value={mafiaChatMsg}
                      onChange={(e) => setMafiaChatMsg(e.target.value)}
                      placeholder="MESSAGE_"
                      className="flex-1 bg-black border border-gray-700 text-white text-[9px] font-mono px-2 py-1 outline-none"
                    />
                    <button type="submit" className="retro-btn retro-btn-red text-[8px] font-bold px-3 uppercase">
                      SEND
                    </button>
                  </form>

                  {/* Target Dropdown */}
                  <form onSubmit={handleActionSubmit} className="flex flex-col gap-2 border-t border-gray-800 pt-2 mt-1">
                    <label className="text-[8px] text-gray-400 uppercase tracking-widest text-left">
                      SELECT KILL TARGET:
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={targetPlayer}
                        onChange={(e) => setTargetPlayer(e.target.value)}
                        className="flex-1 bg-black border border-gray-700 text-white text-[9px] px-2 py-1 outline-none font-mono"
                      >
                        <option value="">CHOOSE_TARGET_</option>
                        {players
                          .filter((p) => p.id !== localPlayerId && p.isAlive !== false && p.role !== 'MAFIA')
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                      <button type="submit" disabled={!targetPlayer} className="retro-btn retro-btn-red text-[8px] font-bold px-3 uppercase disabled:opacity-50">
                        EXECUTE
                      </button>
                    </div>
                  </form>
                </div>
              ) : gameState === 'NIGHT_DOCTOR' && role === 'DOCTOR' && isAlive ? (
                // Night Phase - Doctor (only visible to living Doctor)
                <form onSubmit={handleActionSubmit} className="flex flex-col gap-3 flex-1 justify-center">
                  <span className="text-[9px] text-blue-300 uppercase tracking-wider font-bold">
                    DOCTOR WARD (NIGHT ACTION):
                  </span>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[8px] text-gray-400 uppercase tracking-widest text-left">
                      SELECT INNOCENT TO SAVE:
                    </label>
                    <select
                      value={targetPlayer}
                      onChange={(e) => setTargetPlayer(e.target.value)}
                      className="w-full bg-black border-2 border-gray-700 text-white text-[10px] px-2 py-2 outline-none font-mono"
                    >
                      <option value="">CHOOSE_PATIENT_</option>
                      {players
                        .filter((p) => p.isAlive !== false)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.id === localPlayerId ? '(YOU)' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!targetPlayer}
                    className="w-full retro-btn retro-btn-white py-3 text-[9px] font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    PROTECT PLAYER
                  </button>
                  <p className="text-[7px] text-gray-500 uppercase tracking-widest text-center mt-2 leading-normal">
                    Your target will be immune to Mafia attacks tonight.
                  </p>
                </form>
              ) : (
                // Sleeping overlay placeholder inside the Action Panel box for other inactive roles / spectator night states
                <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-gray-800 bg-gray-950/30 text-gray-400 gap-2 my-auto select-none">
                  <span className="text-3xl animate-pulse">💤</span>
                  <span className="text-[10px] font-bold tracking-widest uppercase">
                    INACTIVE PHASE
                  </span>
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider">
                    Wait for active players to make their choices.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Game Over Screen Overlay */}
        {(gameState === 'GAME_OVER_CIVILIANS' || gameState === 'GAME_OVER_MAFIA') && (() => {
          const mafiaPlayers = players.filter(p => p.role === 'MAFIA');
          const mafiaNames = mafiaPlayers.map(p => p.name);
          let mafiaNamesString = '';
          if (mafiaNames.length === 1) {
            mafiaNamesString = mafiaNames[0];
          } else if (mafiaNames.length === 2) {
            mafiaNamesString = mafiaNames.join(' and ');
          } else if (mafiaNames.length > 2) {
            mafiaNamesString = mafiaNames.slice(0, -1).join(', ') + ', and ' + mafiaNames[mafiaNames.length - 1];
          }

          return (
            <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6 text-center select-none">
              {/* CRT overlay elements */}
              <div className="crt-scanlines crt-flicker"></div>
              <div className="crt-light-roll"></div>
              <div className="crt-vignette"></div>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="max-w-md w-full border-4 border-gray-700 pixel-container bg-black p-8 flex flex-col gap-6"
              >
                <h2 className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-mono">
                  GAME OVER
                </h2>

                {gameState === 'GAME_OVER_CIVILIANS' ? (
                  <div className="flex flex-col gap-2">
                    <h1 className="text-blue-300 text-xl md:text-3xl font-black uppercase tracking-wider pixel-font animate-bounce leading-normal">
                      YAY, CIVILIANS WON!
                    </h1>
                    <p className="text-[10px] md:text-xs text-blue-200/80 uppercase tracking-widest leading-normal">
                      Good job, you found out that {mafiaNamesString} were the Mafias.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <h1 className="text-red-600 text-xl md:text-3xl font-black uppercase tracking-wider pixel-font animate-pulse leading-normal">
                      THE MAFIA HAS TAKEN OVER!
                    </h1>
                    <p className="text-[10px] md:text-xs text-red-500/80 uppercase tracking-widest leading-normal">
                      {mafiaNamesString} were the Mafias.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-4 mt-4">
                  <button
                    onClick={() => {
                      if (onTransitionToWaitingRoom) {
                        onTransitionToWaitingRoom();
                      }
                      socket.emit('playAgain');
                    }}
                    className="retro-btn retro-btn-red py-4 text-xs font-bold tracking-wider uppercase cursor-pointer"
                  >
                    PLAY AGAIN WITH SAME CODE
                  </button>

                  <button
                    onClick={() => {
                      socket.disconnect();
                      window.location.reload();
                    }}
                    className="retro-btn retro-btn-white py-4 text-xs font-bold tracking-wider uppercase cursor-pointer"
                  >
                    RETURN TO HOMEPAGE
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
