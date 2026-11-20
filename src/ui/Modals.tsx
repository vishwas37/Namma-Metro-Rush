import React from 'react';
import {
  Play,
  RotateCcw,
  Home,
  ShoppingBag,
  Volume2,
  VolumeX,
  Megaphone,
  Gamepad2,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { GraphicsQuality, PlayerProfile } from '../core/catalog';
import type { HudState } from '../engine/MetroRunnerEngine';
import { MetroTokenIcon } from './Icons';

interface PauseModalProps {
  profile: PlayerProfile;
  onResume: () => void;
  onRestart: () => void;
  onLobby: () => void;
  onToggleMute: () => void;
  onToggleAnnouncer: () => void;
  onToggleQuality: (q: GraphicsQuality) => void;
  onToggleTouchButtons: () => void;
}

export function PauseModal({
  profile,
  onResume,
  onRestart,
  onLobby,
  onToggleMute,
  onToggleAnnouncer,
  onToggleQuality,
  onToggleTouchButtons,
}: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#1A1423]/78 p-4 safe-area-pad">
      <div className="w-full max-w-sm rounded-2xl bg-[#211830] border-4 border-[#1A1423] shadow-[0_8px_0_#0E0A16] p-5 text-white">
        <div className="text-center mb-4">
          <div className="text-xs font-bold tracking-widest text-[#FFD60A] uppercase">
            NAMMA METRO HALT
          </div>
          <h2 className="font-display text-3xl text-white tracking-wide">PAUSED</h2>
        </div>

        {/* Settings Toggles Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={onToggleMute}
            className={`min-h-[46px] px-3 rounded-xl border-2 border-[#1A1423] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
              profile.soundMuted ? 'bg-[#EF4444] text-white' : 'bg-[#FFD60A] text-[#1A1423]'
            }`}
          >
            {profile.soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{profile.soundMuted ? 'SOUND OFF' : 'SOUND ON'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleAnnouncer}
            className={`min-h-[46px] px-3 rounded-xl border-2 border-[#1A1423] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
              profile.announcerEnabled ? 'bg-[#2DC653] text-[#1A1423]' : 'bg-[#191224] text-white/70'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>{profile.announcerEnabled ? 'VOICE ON' : 'VOICE OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleQuality(profile.quality === 'high' ? 'eco' : 'high')}
            className="min-h-[46px] px-3 rounded-xl bg-[#191224] border-2 border-white/15 font-bold text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#FFD60A]" />
            <span>GFX: {profile.quality === 'high' ? 'HIGH' : 'ECO'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTouchButtons}
            className={`min-h-[46px] px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
              profile.touchButtonsEnabled
                ? 'bg-[#7B2CBF] text-white border-[#FFD60A]'
                : 'bg-[#191224] text-white/75 border-white/15'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>D-PAD: {profile.touchButtonsEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[52px] rounded-2xl bg-[#2DC653] hover:bg-[#35D75F] text-[#1A1423] font-display text-xl tracking-wide border-[3px] border-[#1A1423] shadow-[0_4px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-[#1A1423]" />
            <span>RESUME</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onRestart}
              className="min-h-[48px] rounded-xl bg-[#7B2CBF] text-white font-display text-sm tracking-wide border-[3px] border-[#1A1423] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RESTART</span>
            </button>

            <button
              type="button"
              onClick={onLobby}
              className="min-h-[48px] rounded-xl bg-[#191224] text-white font-display text-sm tracking-wide border-[3px] border-white/20 shadow-[0_3px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>LOBBY</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  hud: HudState;
  profile: PlayerProfile;
  newlyCompletedMissions: string[];
  bonusTokens: number;
  onRestart: () => void;
  onOpenShop: () => void;
  onLobby: () => void;
}

export function GameOverModal({
  hud,
  profile,
  newlyCompletedMissions,
  bonusTokens,
  onRestart,
  onOpenShop,
  onLobby,
}: GameOverModalProps) {
  const isNewRecord = hud.score > 0 && hud.score >= profile.highScore;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#1A1423]/82 p-4 safe-area-pad">
      <div className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl bg-[#211830] border-4 border-[#1A1423] shadow-[0_10px_0_#0E0A16] p-5 text-white">
        {/* Quip Header */}
        <div className="text-center mb-4">
          {isNewRecord && (
            <div className="inline-flex items-center gap-1 px-3 py-0.5 mb-1.5 rounded-lg bg-[#FFD60A] text-[#1A1423] font-display text-xs border-2 border-[#1A1423]">
              <Trophy className="w-3.5 h-3.5" />
              <span>NEW HIGH SCORE!</span>
            </div>
          )}
          <h2 className="font-display text-2xl sm:text-3xl text-[#FFD60A] leading-tight">
            {hud.gameOverQuip}
          </h2>
          <p className="text-xs text-white/70 mt-1">
            Last Station: <span className="text-white font-semibold">{hud.lastStationName}</span>
          </p>
        </div>

        {/* Score & Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-3.5">
          <div className="p-3 rounded-xl bg-[#191224] border-2 border-[#7B2CBF] text-center">
            <div className="text-[11px] font-bold text-white/65 uppercase">Score</div>
            <div className="font-display text-2xl text-white tabular-nums">
              {hud.score.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#191224] border-2 border-white/15 text-center">
            <div className="text-[11px] font-bold text-white/65 uppercase">Best</div>
            <div className="font-display text-2xl text-[#FFD60A] tabular-nums">
              {profile.highScore.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#191224] border border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/70">Tokens</span>
            <span className="flex items-center gap-1 font-display text-sm text-[#FFD60A] tabular-nums">
              <MetroTokenIcon className="w-4 h-4" />
              +{hud.tokens + bonusTokens}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#191224] border border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/70">Distance</span>
            <span className="font-display text-sm text-white tabular-nums">
              {hud.distance}m
            </span>
          </div>
        </div>

        {/* Newly Completed Missions Bonus */}
        {newlyCompletedMissions.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-[#163124] border-2 border-[#2DC653]">
            <div className="font-display text-xs text-[#2DC653] mb-1">
              MISSION COMPLETE (+{bonusTokens} TOKENS!)
            </div>
            {newlyCompletedMissions.map((label) => (
              <div key={label} className="text-xs text-white/90">
                • {label}
              </div>
            ))}
          </div>
        )}

        {/* Primary & Secondary CTAs */}
        <div className="space-y-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onRestart}
            className="w-full min-h-[54px] rounded-2xl bg-[#2DC653] hover:bg-[#35D75F] text-[#1A1423] font-display text-xl tracking-wide border-[3px] border-[#1A1423] shadow-[0_5px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>RUN AGAIN</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenShop}
              className="min-h-[48px] rounded-xl bg-[#7B2CBF] text-white font-display text-sm tracking-wide border-[3px] border-[#1A1423] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-[#FFD60A]" />
              <span>SHOP</span>
            </button>

            <button
              type="button"
              onClick={onLobby}
              className="min-h-[48px] rounded-xl bg-[#191224] text-white font-display text-sm tracking-wide border-[3px] border-white/20 shadow-[0_3px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>LOBBY</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
