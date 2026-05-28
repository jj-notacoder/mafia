import React from 'react';
import { motion } from 'framer-motion';
import { AVATARS } from './avatars';

const availableAvatars = AVATARS;

export default function WaitingRoom({
  socket,
  roomCode,
  roomState,
  setAudioPlaying,
  playerId,
}) {

  if (!roomState) return null;

  // Determine if the current client is the host of this lobby
  const localPlayer = roomState.players.find(p => p.id === playerId);
  const isHost = localPlayer?.isHost;

  // Handle rule adjustments and emit changes back to the backend
  const handleSettingChange = (settingName, value) => {
    const updatedSettings = {
      ...roomState.settings,
      [settingName]: value === 'auto' ? 'auto' : Number(value),
    };
    socket.emit('updateSettings', { settings: updatedSettings });
  };

  // Start the game and pause the background loop
  const handleStartGame = () => {
    console.log('Action: EMIT startGame');
    socket.emit('startGame', roomCode);
    setAudioPlaying(false); // Stop music when the game begins
  };

  return (
    <div className="w-full min-h-screen overflow-hidden flex flex-col items-center justify-between px-4 py-6 relative">
      
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

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col md:flex-row gap-6 w-full max-w-6xl mt-6 mb-6"
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
              const isCurrentPlayer = player.id === playerId;
              const playerIsHost = player.isHost;
              const isDisconnected = player.connected === false;
              
              return (
                <li
                  key={player.id}
                  className={`flex items-center justify-between p-3 border-2 ${
                    isCurrentPlayer ? 'border-red-600 bg-red-950/30' : 'border-gray-800 bg-black/60'
                  } ${isDisconnected ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 text-xs md:text-sm tracking-wider uppercase truncate">
                    {isCurrentPlayer && <span className="text-red-500 animate-pulse">&gt;</span>}
                    {(() => {
                      const playerAvatar = availableAvatars.find(a => a.id === player.avatarId);
                      if (playerAvatar) {
                        return (
                          <img 
                            src={playerAvatar.src} 
                            alt={playerAvatar.name} 
                            className="w-8 h-8 object-contain border border-gray-700 bg-black/40 flex-shrink-0"
                          />
                        );
                      }
                      return (
                        <div className="w-8 h-8 border border-gray-850 bg-black/40 flex items-center justify-center text-[7px] text-gray-500 flex-shrink-0">
                          NO PIC
                        </div>
                      );
                    })()}
                    <span className={isCurrentPlayer ? 'text-red-500 font-bold' : 'text-white'}>
                      {player.name} {isDisconnected ? '(AWAY)' : ''}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {playerIsHost ? (
                      <span className="text-[8px] md:text-[9px] bg-amber-500 text-black font-black px-2 py-0.5 flex items-center gap-1 select-none">
                        👑 HOST
                      </span>
                    ) : (
                      <>
                        {isHost && (
                          <div className="flex gap-2">
                            {!isDisconnected && (
                              <button
                                onClick={() => socket.emit('transferHost', { targetId: player.id })}
                                className="retro-btn retro-btn-white px-2 py-1 text-[7px] font-black uppercase tracking-wider cursor-pointer"
                              >
                                MAKE HOST
                              </button>
                            )}
                            <button
                              onClick={() => socket.emit('kickPlayer', { targetPlayerId: player.id })}
                              className="retro-btn retro-btn-red px-2 py-1 text-[7px] font-black uppercase tracking-wider cursor-pointer"
                            >
                              KICK
                            </button>
                          </div>
                        )}
                        <span className="text-[7px] md:text-[8px] text-gray-500 uppercase tracking-widest">
                          {isDisconnected ? 'AWAY' : 'READY'}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Middle Column: Avatar Selection */}
        <div className="flex-[1.5] p-5 bg-black/85 backdrop-blur-[2px] pixel-container flex flex-col gap-4 min-h-[300px]">
          <div className="border-b border-white pb-3">
            <span className="text-[10px] md:text-xs text-gray-400 tracking-widest uppercase">
              SELECT YOUR AVATAR:
            </span>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 overflow-y-auto max-h-[350px] pr-1">
            {availableAvatars.map((avatar) => {
              const claimedByPlayer = roomState.players.find(p => p.avatarId === avatar.id);
              const isClaimedBySelf = claimedByPlayer?.id === playerId;
              const isClaimedByOther = claimedByPlayer && claimedByPlayer.id !== playerId;

              return (
                <div
                  key={avatar.id}
                  onClick={() => {
                    if (!isClaimedByOther) {
                      socket.emit('selectAvatar', { 
                        roomCode, 
                        roomId: roomCode, 
                        playerId, 
                        newAvatarId: avatar.id,
                        avatarId: avatar.id 
                      });
                    }
                  }}
                  className={`relative border-2 p-1.5 flex flex-col items-center justify-center gap-1 transition-all ${
                    isClaimedBySelf ? 'ring-4 ring-green-500 border-green-500 bg-green-950/20' : 
                    isClaimedByOther ? 'grayscale opacity-50 cursor-not-allowed bg-black/80 border-red-950' : 
                    'border-gray-800 bg-black/60 cursor-pointer hover:border-yellow-500'
                  }`}
                >
                  <img
                    src={avatar.src}
                    alt={avatar.name}
                    className={`w-12 h-12 object-contain ${isClaimedByOther ? 'grayscale' : ''}`}
                  />
                  <span className="text-[7px] text-gray-400 text-center font-mono truncate w-full" title={avatar.name}>
                    {avatar.name}
                  </span>
                  {isClaimedBySelf && (
                    <div className="absolute top-0 right-0 bg-green-600 text-white text-[5px] px-1 font-bold">
                      YOU
                    </div>
                  )}
                  {isClaimedByOther && (
                    <div className="absolute top-0 right-0 bg-red-800 text-white text-[5px] px-1 font-bold truncate max-w-full">
                      {claimedByPlayer.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

                {/* Setting: Mafia Count */}
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex justify-between items-center text-[10px] md:text-xs">
                    <span className="text-white tracking-wider uppercase">MAFIA COUNT:</span>
                    <span className="text-red-500 font-mono font-bold">
                      {roomState.settings.mafiaCount === 'auto' || !roomState.settings.mafiaCount
                        ? 'AUTO'
                        : roomState.settings.mafiaCount}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {['auto', 1, 2, 3].map((val) => {
                      const isActive = (roomState.settings.mafiaCount || 'auto') === val;
                      const numPlayers = roomState.players.length;
                      let isDisabled = false;
                      if (val === 2 && numPlayers < 6) isDisabled = true;
                      if (val === 3 && numPlayers < 9) isDisabled = true;

                      return (
                        <button
                          key={val}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && handleSettingChange('mafiaCount', val)}
                          className={`flex-1 py-1.5 text-[8px] md:text-[9px] font-bold uppercase border transition-colors ${
                            isDisabled
                              ? 'bg-gray-950 border-gray-900 text-gray-700 cursor-not-allowed opacity-40'
                              : isActive
                              ? 'bg-red-600 border-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.6)] animate-pulse cursor-pointer'
                              : 'bg-black border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 cursor-pointer'
                          }`}
                        >
                          {val === 'auto' ? 'AUTO' : val}
                        </button>
                      );
                    })}
                  </div>
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
                <div className="border-2 border-gray-800 p-3 bg-black/60 flex justify-between items-center">
                  <span className="text-gray-400">Mafia Count:</span>
                  <span className="text-red-500 font-mono font-bold">
                    {roomState.settings.mafiaCount === 'auto' || !roomState.settings.mafiaCount
                      ? 'AUTO'
                      : roomState.settings.mafiaCount}
                  </span>
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
            disabled={roomState.players.length < 3}
            animate={roomState.players.length >= 3 ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className={`w-full retro-btn py-4 text-xs font-bold tracking-widest uppercase ${
              roomState.players.length >= 3 
                ? 'retro-btn-red cursor-pointer' 
                : 'bg-gray-800 text-gray-500 border-gray-900 cursor-not-allowed shadow-none'
            }`}
          >
            {roomState.players.length >= 3 ? 'START GAME' : 'NEED MORE PLAYERS'}
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
    </div>
  );
}
