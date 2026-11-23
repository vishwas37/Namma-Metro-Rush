import React from 'react';
import {
  Play,
  ShoppingBag,
  Trophy,
  Volume2,
  VolumeX,
  Megaphone,
  Lock,
} from 'lucide-react';
import {
  CHARACTERS,
  type CharacterId,
  type PlayerProfile,
} from '../core/catalog';
import { getEffectiveMultiplier } from '../core/simulation';
import { MetroTokenIcon, NammaRunnerLogo } from './Icons';

interface TitleScreenProps {
  profile: PlayerProfile;
  onStart: () => void;
  onOpenShop: (tab: 'characters' | 'hoverboards' | 'upgrades' | 'missions') => void;
  onSelectCharacter: (id: CharacterId) => void;
  onToggleMute: () => void;
  onToggleAnnouncer: () => void;
  onLobbyTap: () => void;
}

export function TitleScreen({
  profile,
  onStart,
  onOpenShop,
  onSelectCharacter,
  onToggleMute,
  onToggleAnnouncer,
  onLobbyTap,
}: TitleScreenProps) {
  const multiplier = getEffectiveMultiplier(profile);
  const completedMissions = profile.missions.filter((m) => m.completed).length;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none safe-area-pad">
      {/* TOP BAR: Compact logo left, bank + audio right */}
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="pointer-events-auto max-w-[205px] sm:max-w-[330px] md:max-w-[380px] [@media(max-height:500px)]:max-w-[215px] shrink min-w-0">
          <NammaRunnerLogo className="w-full h-auto drop-shadow-[0_6px_0_rgba(26,20,35,0.45)]" />
        </div>

        <div className="flex flex-col items-end gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          {/* Token & High Score ribbon */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-[#1A1423]/92 border-2 border-[#FFD60A] text-white shadow-[0_3px_0_#1A1423]">
              <MetroTokenIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="font-display text-sm sm:text-base tabular-nums text-[#FFD60A]">
                {profile.tokens.toLocaleString()}
              </span>
            </div>

            {profile.highScore > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1423]/92 border-2 border-[#7B2CBF] text-white shadow-[0_3px_0_#1A1423]">
                <Trophy className="w-4 h-4 text-[#FFD60A]" />
                <span className="font-display text-sm tabular-nums">
                  {profile.highScore.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* 44x44px touch-friendly audio controls + Karnataka multiplier badge */}
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-lg bg-[#DC2626] text-[#FFD60A] font-display text-xs border-2 border-[#FFD60A] shadow-[0_2px_0_#1A1423]">
              x{multiplier}
            </span>

            <button
              type="button"
              onClick={onToggleAnnouncer}
              aria-label={profile.announcerEnabled ? 'Disable Station Announcer' : 'Enable Station Announcer'}
              title={profile.announcerEnabled ? 'Station Announcer: ON' : 'Station Announcer: OFF'}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border-2 border-[#1A1423] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 cursor-pointer transition-colors ${
                profile.announcerEnabled
                  ? 'bg-[#2DC653] text-[#1A1423]'
                  : 'bg-[#1A1423]/90 text-white/60'
              }`}
            >
              <Megaphone className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={profile.soundMuted ? 'Unmute Audio' : 'Mute Audio'}
              title={profile.soundMuted ? 'Sound: OFF' : 'Sound: ON'}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border-2 border-[#1A1423] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 cursor-pointer transition-colors ${
                profile.soundMuted
                  ? 'bg-[#EF4444] text-white'
                  : 'bg-[#FFD60A] text-[#1A1423]'
              }`}
            >
              {profile.soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* CENTER: Unobstructed 3D Viaduct & Runner Showcase (tap to make runner hop!) */}
      <button
        type="button"
        onClick={onLobbyTap}
        aria-label="Tap hero to jump"
        className="flex-1 w-full bg-transparent border-0 pointer-events-auto cursor-pointer focus:outline-none"
      />

      {/* BOTTOM THUMB ZONE: Runner picker + mobile-safe CTA dock */}
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-2.5 [@media(max-height:500px)]:gap-1.5 pointer-events-auto">
        {/* Quick Character Switcher — horizontally scrollable on small screens */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-0.5">
          {CHARACTERS.map((char) => {
            const unlocked = profile.unlockedCharacters.includes(char.id);
            const selected = profile.selectedCharacter === char.id;
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => (unlocked ? onSelectCharacter(char.id) : onOpenShop('characters'))}
                className={`shrink-0 min-h-[44px] px-3 py-2 rounded-xl border-2 border-[#1A1423] flex items-center gap-2 font-bold text-xs sm:text-sm cursor-pointer transition-transform active:scale-95 shadow-[0_3px_0_#1A1423] ${
                  selected
                    ? 'bg-[#FFD60A] text-[#1A1423] -translate-y-0.5'
                    : unlocked
                      ? 'bg-[#1A1423]/88 text-white hover:bg-[#291E3D]'
                      : 'bg-[#1A1423]/76 text-white/75'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-[#1A1423] shrink-0"
                  style={{ backgroundColor: char.accentHex }}
                />
                <span className="whitespace-nowrap">{char.shortName}</span>
                {!unlocked && <Lock className="w-3.5 h-3.5 text-[#FFD60A] shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Action Dock: Mobile stacks full-width PLAY over 2-col SHOP+MISSIONS; Desktop aligns cleanly */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          {/* Primary PLAY CTA — always full-width thumb button on mobile */}
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="order-1 sm:order-2 w-full sm:w-auto sm:min-w-[230px] min-h-[54px] px-7 py-3 rounded-2xl bg-[#2DC653] hover:bg-[#34D85E] text-[#1A1423] font-display text-xl sm:text-2xl tracking-wider border-[3px] border-[#1A1423] shadow-[0_5px_0_#1A1423] active:translate-y-1 active:shadow-[0_2px_0_#1A1423] flex items-center justify-center gap-2.5 cursor-pointer transition-transform"
          >
            <Play className="w-6 h-6 fill-[#1A1423]" />
            <span>PLAY</span>
            <span className="font-kannada text-base sm:text-lg font-extrabold px-2 py-0.5 rounded-lg bg-[#FFD60A] text-[#DC2626] border-2 border-[#1A1423]">
              ಓಡು!
            </span>
          </button>

          {/* Secondary SHOP & MISSIONS row */}
          <div className="order-2 sm:order-1 grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onOpenShop('characters')}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#7B2CBF] hover:bg-[#8E3AD8] text-white font-display text-sm sm:text-base tracking-wide border-[3px] border-[#1A1423] shadow-[0_4px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD60A]" />
              <span>SHOP</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenShop('missions')}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#1A1423]/92 hover:bg-[#2B1F3F] text-white font-display text-sm sm:text-base tracking-wide border-[3px] border-[#FFD60A] shadow-[0_4px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD60A]" />
              <span>MISSIONS ({completedMissions}/3)</span>
            </button>
          </div>
        </div>

        {/* Single-line crisp control hint */}
        <p className="text-center sm:text-left text-[11px] sm:text-xs font-semibold text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] tracking-wide">
          <span className="sm:hidden">Swipe to Move, Jump &amp; Roll · Double-Tap for Auto Board</span>
          <span className="hidden sm:inline">Arrows / WASD or Swipe to Dodge · Space / Double-Tap for Auto Hoverboard · P to Pause</span>
        </p>
      </div>
    </div>
  );
}
