import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameArena({
  gameState,
  players = [],
  localPlayerId,
  socket,
}) {
  const [isRevealing, setIsRevealing] = useState(true);
  const [targetPlayer, setTargetPlayer] = useState('');
  const [mafiaChatMsg, setMafiaChatMsg] = useState('');
  const [mafiaLogs, setMafiaLogs] = useState([
    { id: '1', text: '[SYSTEM] Night fell; Mafia chat active.' }
  ]);
  const [systemLogs, setSystemLogs] = useState([
    { id: '1', text: '[SYSTEM] Day phase initiated.' },
    { id: '2', text: '[SYSTEM] Cast your votes in the discussion.' }
  ]);
  
  const chatEndRef = useRef(null);

  // Auto-scroll chat / logs to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mafiaLogs, systemLogs]);

  // Role reveal timer - exactly 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRevealing(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Retrieve local player details
  const localPlayer = players.find((p) => p.id === localPlayerId) || {
    name: 'UNKNOWN',
    role: 'CIVILIAN',
    isAlive: true,
  };

  const role = localPlayer.role || 'CIVILIAN';
  const isAlive = localPlayer.isAlive;

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

  // Determine game phase (default to DAY if server gameState is just 'PLAYING')
  const isNight = gameState === 'PLAYING_NIGHT' || gameState === 'NIGHT';

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
    setMafiaLogs((prev) => [
      ...prev,
      { id: Date.now().toString(), text: `[MAFIA] ${localPlayer.name}: ${mafiaChatMsg}` }
    ]);
    setMafiaChatMsg('');
  };

  const handleActionSubmit = (e) => {
    e.preventDefault();
    if (!targetPlayer) return;
    const eventName = role === 'MAFIA' ? 'mafiaTarget' : 'doctorTarget';
    socket.emit(eventName, { targetId: targetPlayer });
    alert(`ACTION SUBMITTED: TARGET - ${players.find((p) => p.id === targetPlayer)?.name}`);
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Interface (renders behind the overlay and appears once overlay fades) */}
      <div className="w-full max-w-5xl bg-black/85 backdrop-blur-[2px] border-4 border-gray-700 pixel-container text-white p-5 flex flex-col gap-5 overflow-y-auto max-h-[85vh]">
        
        {/* Header Panel */}
        <div className="border-b-4 border-gray-700 pb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-lg md:text-xl font-bold uppercase tracking-widest arcade-marquee">
              MAFIA
            </h1>
            <span className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-widest">
              Game in progress
            </span>
          </div>

          {/* Current Phase Indicator & Simulated Clock */}
          <div className="flex items-center gap-4 bg-red-950/20 border-2 border-red-900 px-5 py-2">
            <span className="text-xs md:text-sm font-bold tracking-wider uppercase animate-pulse">
              PHASE: {isNight ? 'NIGHT' : 'DAY'}
            </span>
            <span className="text-sm md:text-md font-mono font-bold text-red-500">
              {isNight ? 'NIGHT PHASE' : 'DISCUSSION'}
            </span>
          </div>

          {/* User Role Badge */}
          <div className={`border-2 px-3 py-1.5 text-[9px] md:text-xs font-bold uppercase tracking-wider ${roleBorderColor} ${roleBgClass} ${roleColorClass}`}>
            ROLE: {role}
          </div>
        </div>

        {/* Modular Grid Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[300px]">
          
          {/* Player Cards (takes 2 columns on medium screens) */}
          <div className="md:col-span-2 border-4 border-gray-700 p-4 bg-black/40 flex flex-col gap-3">
            <h3 className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2">
              LOBBY ROSTER
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[45vh] pr-1">
              {players.map((player) => {
                const playerIsLocal = player.id === localPlayerId;
                const playerIsAlive = player.isAlive !== false;

                return (
                  <div
                    key={player.id}
                    className={`relative border-2 p-3 flex items-center gap-3 transition-colors ${
                      playerIsLocal ? 'border-red-600 bg-red-950/20' : 'border-gray-800 bg-black/60'
                    } ${!playerIsAlive ? 'opacity-40 bg-black/80' : ''}`}
                  >
                    {/* Avatar Container with Dead X Overlay */}
                    <div className="relative flex-shrink-0">
                      {getAvatarSvg(player.name)}
                      {!playerIsAlive && (
                        <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center text-red-600 text-3xl font-black select-none border-2 border-red-600">
                          X
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-xs md:text-sm uppercase tracking-wider truncate font-mono ${
                        !playerIsAlive ? 'line-through text-gray-600' : 'text-white'
                      }`}>
                        {player.name}
                      </p>
                      <span className={`text-[8px] uppercase tracking-widest font-bold ${
                        playerIsAlive ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {playerIsAlive ? 'ALIVE' : 'DEAD'}
                      </span>
                    </div>

                    {playerIsLocal && (
                      <span className="text-[8px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded select-none self-start">
                        YOU
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Action Panel (takes 1 column) */}
          <div className="border-4 border-gray-700 p-4 bg-black/40 flex flex-col gap-3 h-full justify-between">
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              <h3 className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2">
                ACTION PANEL
              </h3>

              {!isAlive ? (
                // Dead Player Screen
                <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-red-950 bg-red-950/10 text-red-500 gap-2 my-auto">
                  <span className="text-3xl">☠</span>
                  <span className="text-[10px] font-bold tracking-widest uppercase">
                    YOU ARE ELIMINATED
                  </span>
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider">
                    You can spectate but cannot interact; dead players tell no tales.
                  </p>
                </div>
              ) : !isNight ? (
                // Day Phase (All roles show discussion log)
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                  <span className="text-[9px] text-red-500 uppercase tracking-wider font-bold">
                    SYSTEM ACTION LOG:
                  </span>
                  <div className="flex-1 bg-black border-2 border-gray-800 p-2 font-mono text-[8px] md:text-[9px] text-green-500 overflow-y-auto max-h-[30vh]">
                    {systemLogs.map((log) => (
                      <p key={log.id} className="mb-1 leading-normal">
                        {log.text}
                      </p>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <p className="text-[7px] text-gray-500 uppercase tracking-widest text-center mt-1 leading-normal">
                    Discuss with other players and coordinate your votes.
                  </p>
                </div>
              ) : role === 'MAFIA' ? (
                // Night Phase - Mafia
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                  <span className="text-[9px] text-red-500 uppercase tracking-wider font-bold">
                    MAFIA BOARD (NIGHT CHAT):
                  </span>
                  
                  {/* Mafia Private Chat */}
                  <div className="flex-1 bg-black border-2 border-gray-800 p-2 font-mono text-[8px] md:text-[9px] text-red-500 overflow-y-auto max-h-[22vh]">
                    {mafiaLogs.map((log) => (
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
                          .filter((p) => p.id !== localPlayerId && p.isAlive !== false)
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
              ) : role === 'DOCTOR' ? (
                // Night Phase - Doctor
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
                      {/* Doctor can save anyone including themselves */}
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
                // Night Phase - Civilian
                <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-gray-800 bg-gray-950/30 text-gray-400 gap-2 my-auto select-none">
                  <span className="text-3xl animate-pulse">💤</span>
                  <span className="text-[10px] font-bold tracking-widest uppercase">
                    YOU ARE ASLEEP
                  </span>
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider">
                    Wait for the night phase to pass.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
