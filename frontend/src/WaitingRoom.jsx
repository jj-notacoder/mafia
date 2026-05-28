import React from 'react';
import { motion } from 'framer-motion';

export default function WaitingRoom({
  socket,
  roomCode,
  roomState,
  setAudioPlaying,
}) {
  if (!roomState) return null;

  // Determine if the current client is the host of this lobby
  const isHost = socket.id === roomState.hostId;

  // Handle rule adjustments and emit changes back to the backend
  const handleSettingChange = (settingName, value) => {
    const updatedSettings = {
      ...roomState.settings,
      [settingName]: Number(value),
    };
    socket.emit('updateSettings', { settings: updatedSettings });
  };

  // Start the game and pause the background loop
  const handleStartGame = () => {
    console.log('Action: EMIT startGame');
    socket.emit('startGame');
    setAudioPlaying(false); // Stop music when the game begins
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between max-h-[90vh] px-4 py-6 overflow-y-auto">
      
      {/* Top Header section */}
      <div className="flex flex-col items-center justify-center text-center mt-2">
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter select-none arcade-marquee">
          MAFIA
        </h1>
        <h2 className="text-sm md:text-lg text-red-500 uppercase tracking-widest mt-3 flex items-center justify-center gap-2">
          <span>ROOM CODE:</span>
          <span className="bg-red-950/60 border border-red-700 px-3 py-1 text-white font-mono rounded tracking-wider select-text">
            {roomCode}
          </span>
        </h2>
      </div>

      {/* Main Content Columns */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col md:flex-row gap-6 w-full max-w-4xl mt-6 mb-6"
      >
        
        {/* Left Column: Player List */}
        <div className="flex-1 p-5 bg-black/85 backdrop-blur-[2px] pixel-container flex flex-col gap-4">
          <div className="border-b border-white pb-3 flex justify-between items-center">
            <span className="text-[10px] md:text-xs text-gray-400 tracking-widest uppercase">
              CONNECTED ROSTER:
            </span>
            <span className="text-[9px] bg-red-600 px-2 py-0.5 font-bold uppercase rounded text-white">
              {roomState.players.length} PLYRS
            </span>
          </div>

          <ul className="flex-1 flex flex-col gap-3 min-h-[150px] overflow-y-auto pr-1">
            {roomState.players.map((player) => {
              const isCurrentPlayer = player.id === socket.id;
              const playerIsHost = player.id === roomState.hostId;
              
              return (
                <li
                  key={player.id}
                  className={`flex items-center justify-between p-3 border-2 ${
                    isCurrentPlayer ? 'border-red-600 bg-red-950/30' : 'border-gray-800 bg-black/60'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs md:text-sm tracking-wider uppercase truncate">
                    {isCurrentPlayer && <span className="text-red-500 animate-pulse">&gt;</span>}
                    <span className={isCurrentPlayer ? 'text-red-500 font-bold' : 'text-white'}>
                      {player.name}
                    </span>
                  </div>
                  
                  {playerIsHost ? (
                    <span className="text-[8px] md:text-[9px] bg-amber-500 text-black font-black px-2 py-0.5 flex items-center gap-1 select-none">
                      👑 HOST
                    </span>
                  ) : (
                    <span className="text-[7px] md:text-[8px] text-gray-500 uppercase tracking-widest">
                      READY
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right Column: Game Settings */}
        <div className="flex-1 p-5 bg-black/85 backdrop-blur-[2px] pixel-container flex flex-col gap-5">
          <div className="border-b border-white pb-3">
            <span className="text-[10px] md:text-xs text-gray-400 tracking-widest uppercase">
              LOBBY SETTINGS:
            </span>
          </div>

          <div className="flex flex-col gap-5 flex-1 justify-center">
            {isHost ? (
              <>
                {/* Setting: Night Phase */}
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex justify-between items-center text-[10px] md:text-xs">
                    <span className="text-white tracking-wider uppercase">NIGHT TIMER:</span>
                    <span className="text-red-500 font-mono font-bold">{roomState.settings.night}s</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={roomState.settings.night}
                    onChange={(e) => handleSettingChange('night', e.target.value)}
                    className="w-full cursor-pointer h-2 bg-gray-900 border border-gray-700 outline-none accent-red-600"
                  />
                </div>

                {/* Setting: Day Phase */}
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex justify-between items-center text-[10px] md:text-xs">
                    <span className="text-white tracking-wider uppercase">DAY TIMER:</span>
                    <span className="text-red-500 font-mono font-bold">{roomState.settings.day}s</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="600"
                    step="10"
                    value={roomState.settings.day}
                    onChange={(e) => handleSettingChange('day', e.target.value)}
                    className="w-full cursor-pointer h-2 bg-gray-900 border border-gray-700 outline-none accent-red-600"
                  />
                </div>

                {/* Setting: Voting Phase */}
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex justify-between items-center text-[10px] md:text-xs">
                    <span className="text-white tracking-wider uppercase">VOTING TIMER:</span>
                    <span className="text-red-500 font-mono font-bold">{roomState.settings.voting}s</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={roomState.settings.voting}
                    onChange={(e) => handleSettingChange('voting', e.target.value)}
                    className="w-full cursor-pointer h-2 bg-gray-900 border border-gray-700 outline-none accent-red-600"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4 text-[10px] md:text-xs tracking-widest uppercase text-left">
                <div className="border-2 border-gray-800 p-3 bg-black/60 flex justify-between items-center">
                  <span className="text-gray-400">Night Phase:</span>
                  <span className="text-red-500 font-mono font-bold">{roomState.settings.night}s</span>
                </div>
                <div className="border-2 border-gray-800 p-3 bg-black/60 flex justify-between items-center">
                  <span className="text-gray-400">Day Phase:</span>
                  <span className="text-red-500 font-mono font-bold">{roomState.settings.day}s</span>
                </div>
                <div className="border-2 border-gray-800 p-3 bg-black/60 flex justify-between items-center">
                  <span className="text-gray-400">Voting Phase:</span>
                  <span className="text-red-500 font-mono font-bold">{roomState.settings.voting}s</span>
                </div>
                
                <p className="text-[7px] md:text-[8px] text-gray-500 tracking-wider text-center uppercase border border-gray-800/60 p-2 mt-4">
                  Only the host can modify game settings.
                </p>
              </div>
            )}
          </div>
        </div>

      </motion.div>

      {/* Action Area & Pulsing Button */}
      <div className="w-full max-w-sm flex flex-col items-center justify-center mb-6">
        {isHost ? (
          <motion.button
            onClick={handleStartGame}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="w-full retro-btn retro-btn-red py-4 text-xs font-bold tracking-widest uppercase cursor-pointer"
          >
            START GAME
          </motion.button>
        ) : (
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.0, ease: 'easeInOut' }}
            className="w-full border-2 border-red-950 bg-red-950/20 text-red-500 py-4 text-[9px] md:text-[10px] font-bold tracking-widest uppercase text-center"
          >
            WAITING FOR HOST TO START...
          </motion.div>
        )}
      </div>

      {/* Footer controls & Version labels */}
      <div className="flex justify-end items-center w-full px-2 mt-auto">
        <span className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-widest">
          v1.0.0 - Trust No One
        </span>
      </div>
      
    </div>
  );
}
