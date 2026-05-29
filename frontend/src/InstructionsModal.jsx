import React from 'react';
import { motion } from 'framer-motion';

export default function InstructionsModal({ closeModal }) {
  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-2xl bg-gray-900/90 border-2 border-red-900 rounded-sm shadow-[0_0_30px_rgba(220,38,38,0.2)] overflow-hidden flex flex-col z-[120]"
      >
        {/* Header */}
        <div className="flex justify-between items-center bg-black/80 border-b border-red-950 px-4 py-3">
          <span className="text-[10px] md:text-xs text-red-500 font-bold uppercase tracking-widest arcade-marquee pixel-font">
            HOW TO PLAY
          </span>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-white font-bold text-xs cursor-pointer focus:outline-none"
          >
            [X]
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto max-h-[80vh] p-6 flex flex-col gap-6 font-mono text-[9px] md:text-xs leading-relaxed text-gray-300">
          
          {/* Objective */}
          <div className="border-l-4 border-red-600 bg-red-950/20 p-3">
            <span className="text-red-500 font-bold tracking-wider uppercase block mb-1">OBJECTIVE:</span>
            <p className="text-white">Survive and eliminate the opposition. Trust no one.</p>
          </div>

          {/* Roles */}
          <div className="flex flex-col gap-3">
            <span className="text-gray-400 font-bold tracking-wider uppercase border-b border-gray-800 pb-1">THE ROLES:</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Mafia */}
              <div className="flex flex-col items-center text-center p-4 rounded-sm border-2 border-red-600 bg-red-950/10 transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                <span className="text-3xl mb-2" role="img" aria-label="mafia">👺</span>
                <span className="text-red-500 font-bold uppercase tracking-widest text-[10px] mb-2">MAFIA</span>
                <p className="text-[8px] md:text-[9px] text-gray-300">Wake up at night. Coordinate in secret to eliminate one target per night. Blend in during the day.</p>
              </div>

              {/* Doctor */}
              <div className="flex flex-col items-center text-center p-4 rounded-sm border-2 border-white bg-white/5 transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                <span className="text-3xl mb-2" role="img" aria-label="doctor">💉</span>
                <span className="text-white font-bold uppercase tracking-widest text-[10px] mb-2">DOCTOR</span>
                <p className="text-[8px] md:text-[9px] text-gray-300">Wake up at night. Choose one person to save from a potential attack. You can save yourself.</p>
              </div>

              {/* Civilian */}
              <div className="flex flex-col items-center text-center p-4 rounded-sm border-2 border-blue-500 bg-blue-950/10 transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                <span className="text-3xl mb-2" role="img" aria-label="civilian">🔎</span>
                <span className="text-blue-400 font-bold uppercase tracking-widest text-[10px] mb-2">CIVILIAN</span>
                <p className="text-[8px] md:text-[9px] text-gray-300">Use logic and deduction during the day to figure out who the Mafia is. Your vote is your only weapon.</p>
              </div>

            </div>
          </div>

          {/* Phases */}
          <div className="flex flex-col gap-3">
            <span className="text-gray-400 font-bold tracking-wider uppercase border-b border-gray-800 pb-1">THE PHASES:</span>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-yellow-500 font-bold">NIGHT:</span>
                <p>Secret actions take place. The Mafia attacks; the Doctor protects.</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-yellow-500 font-bold">DAY:</span>
                <p>The results of the night are revealed. Everyone discusses the events in the global chat.</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-yellow-500 font-bold">VOTING:</span>
                <p>Vote to eliminate the most suspicious player. A majority vote locks in an execution. If there is a tie; no one dies.</p>
              </div>
            </div>
          </div>

          {/* Win Conditions */}
          <div className="flex flex-col gap-3">
            <span className="text-gray-400 font-bold tracking-wider uppercase border-b border-gray-800 pb-1">WIN CONDITIONS:</span>
            <div className="flex flex-col gap-1.5">
              <p className="flex items-start gap-2">
                <span className="text-green-500 font-bold">&gt;</span>
                <span>Civilians win if all Mafia members are eliminated.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-500 font-bold">&gt;</span>
                <span>Mafia wins if their numbers equal or exceed the remaining townspeople.</span>
              </p>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
