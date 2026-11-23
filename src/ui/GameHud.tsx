import React from 'react';
import {
  Pause,
  Volume2,
  VolumeX,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sun,
  CloudRain,
  CloudLightning,
} from 'lucide-react';
import { WEATHER_META, type GraphicsQuality, type PlayerProfile } from '../core/catalog';
import type { RunnerAction } from '../core/simulation';
import type { ActivePowerUpState, HudState } from '../engine/MetroRunnerEngine';
import {
  AutoBoardIcon,
  DosaMagnetIcon,
  DroneIcon,
  KaapiIcon,
  MetroTokenIcon,
} from './Icons';

interface GameHudProps {
  hud: HudState;
  profile: PlayerProfile;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleAnnouncer: () => void;
  onToggleQuality: (q: GraphicsQuality) => void;
  onActivateHoverboard: () => void;
  onTouchAction: (action: RunnerAction) => void;
}

const LINE_COLORS: Record<string, { bar: string; label: string }> = {
  purple: { bar: '#7B2CBF', label: 'PURPLE LINE' },
  green: { bar: '#2DC653', label: 'GREEN LINE' },
  yellow: { bar: '#EAB308', label: 'YELLOW LINE' },
  interchange: { bar: '#A855F7', label: 'INTERCHANGE' },
};

function PowerUpRing({ item }: { item: ActivePowerUpState }) {
  const ratio = Math.max(0, Math.min(1, item.remaining / Math.max(0.1, item.duration)));
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - ratio);

  const meta =
    item.type === 'kaapi'
      ? { color: '#F59E0B', icon: <KaapiIcon className="w-5 h-5" />, label: 'KAAPI' }
      : item.type === 'magnet'
        ? { color: '#EF4444', icon: <DosaMagnetIcon className="w-5 h-5" />, label: 'MAGNET' }
        : item.type === 'drone'
          ? { color: '#38BDF8', icon: <DroneIcon className="w-5 h-5" />, label: 'DRONE' }
          : { color: '#00F5D4', icon: <AutoBoardIcon className="w-5 h-5" />, label: 'AUTO' };

  return (
    <div className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#1A1423]/92 border-2 border-[#1A1423] shadow-[0_3px_0_#1A1423] flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} stroke="rgba(255,255,255,0.18)" strokeWidth="4" fill="none" />
        <circle
          cx="24"
          cy="24"
          r={r}
          stroke={meta.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          fill="none"
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center">
        {meta.icon}
      </div>
      <span className="sr-only">{meta.label}</span>
    </div>
  );
}

export function GameHud({
  hud,
  profile,
  onPause,
  onToggleMute,
  onToggleAnnouncer,
  onToggleQuality,
  onActivateHoverboard,
  onTouchAction,
}: GameHudProps) {
  const station = hud.currentStation;
  const lineTheme = station ? (LINE_COLORS[station.line] ?? LINE_COLORS.purple) : LINE_COLORS.purple;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden">
      {/* Subtle Filter Kaapi Speed-Line Edge Effect */}
      {hud.kaapiActive && (
        <div
          className="fixed inset-0 pointer-events-none border-[6px] border-[#FFD60A]/65"
          style={{
            boxShadow: 'inset 0 0 42px rgba(255, 214, 10, 0.38)',
          }}
        />
      )}

      {/* Subtle Heavy Monsoon Rain-Mist Vignette */}
      {hud.weather === 'heavy_monsoon' && hud.zone === 'elevated' && !hud.kaapiActive && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 46px rgba(56, 189, 248, 0.32)',
          }}
        />
      )}

      {/* Subtle Chaser Danger Edge Vignette */}
      {hud.chaserClose && !hud.kaapiActive && (
        <div
          className="fixed inset-x-0 bottom-0 h-28 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(239, 68, 68, 0.34), transparent)',
          }}
        />
      )}

      <div className="h-full w-full flex flex-col justify-between safe-area-pad">
        {/* TOP HUD ROW */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-start justify-between gap-2 w-full">
            {/* Top-Left Utility Buttons (44x44px minimum touch targets) */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={onPause}
                aria-label="Pause Game"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#1A1423]/92 text-white border-2 border-[#FFD60A] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center cursor-pointer"
              >
                <Pause className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                aria-label={profile.soundMuted ? 'Unmute Audio' : 'Mute Audio'}
                className={`min-w-[44px] min-h-[44px] rounded-xl border-2 border-[#1A1423] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center cursor-pointer ${
                  profile.soundMuted ? 'bg-[#EF4444] text-white' : 'bg-[#FFD60A] text-[#1A1423]'
                }`}
              >
                {profile.soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* Desktop extra quick toggles (mobile accesses these inside Pause to keep top bar ultra-clean) */}
              <button
                type="button"
                onClick={onToggleAnnouncer}
                aria-label={profile.announcerEnabled ? 'Mute Kannada Voice-Over' : 'Enable Kannada Voice-Over'}
                title={profile.announcerEnabled ? 'Kannada Voice-Over: ON' : 'Kannada Voice-Over: OFF'}
                className={`hidden sm:flex min-w-[44px] min-h-[44px] rounded-xl border-2 border-[#1A1423] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 items-center justify-center cursor-pointer ${
                  profile.announcerEnabled ? 'bg-[#2DC653] text-[#1A1423]' : 'bg-[#1A1423]/88 text-white/60'
                }`}
              >
                <Megaphone className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onToggleQuality(profile.quality === 'high' ? 'eco' : 'high')}
                aria-label="Toggle Graphics Quality"
                className="hidden md:flex min-h-[44px] px-3 rounded-xl bg-[#1A1423]/90 text-white border-2 border-white/25 shadow-[0_3px_0_#1A1423] active:translate-y-0.5 items-center justify-center font-display text-xs tracking-wider cursor-pointer"
              >
                {profile.quality === 'high' ? 'HIGH' : 'ECO'}
              </button>
            </div>

            {/* Top-Right Skewed Score & Token Counters */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-lg bg-[#7B2CBF] border-2 border-[#1A1423] text-white font-display text-xs sm:text-sm shadow-[0_2px_0_#1A1423] -skew-x-6">
                  x{hud.multiplier}
                </span>
                <div className="px-3 sm:px-4 py-1 rounded-xl bg-[#1A1423]/92 border-2 border-[#FFD60A] shadow-[0_3px_0_#1A1423] -skew-x-6">
                  <span className="block skew-x-6 font-display text-lg sm:text-2xl text-white tabular-nums leading-none">
                    {hud.score.toString().padStart(6, '0')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#1A1423]/90 border-2 border-[#1A1423] shadow-[0_2px_0_#1A1423]">
                <span className="text-[11px] sm:text-xs font-bold text-white/75 tabular-nums">
                  {hud.distance}m
                </span>
                <span className="w-1 h-1 rounded-full bg-white/35" />
                <div className="flex items-center gap-1">
                  <MetroTokenIcon className="w-4 h-4 shrink-0" />
                  <span className="font-display text-sm text-[#FFD60A] tabular-nums">
                    {hud.tokens}
                  </span>
                </div>
              </div>

              {hud.zone === 'elevated' && (
                <div
                  data-testid="weather-badge"
                  data-weather={hud.weather}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border-2 shadow-[0_2px_0_#1A1423] text-[10px] sm:text-[11px] font-bold tracking-wide ${
                    hud.weather === 'heavy_monsoon'
                      ? 'bg-[#0C4A6E]/94 border-[#38BDF8] text-[#E0F2FE]'
                      : hud.weather === 'light_rain'
                        ? 'bg-[#1E293B]/92 border-[#93C5FD] text-[#DBEAFE]'
                        : 'bg-[#1A1423]/90 border-[#FFD60A]/75 text-[#FFD60A]'
                  }`}
                >
                  {hud.weather === 'heavy_monsoon' ? (
                    <CloudLightning className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                  ) : hud.weather === 'light_rain' ? (
                    <CloudRain className="w-3.5 h-3.5 text-[#93C5FD] shrink-0" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-[#FFD60A] shrink-0" />
                  )}
                  <span>{WEATHER_META[hud.weather].label}</span>
                  {hud.weather === 'heavy_monsoon' && (
                    <span className="px-1 rounded bg-[#FFD60A] text-[#1A1423] font-display text-[9px] leading-tight">
                      SLIPPERY
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* BILINGUAL NAMMA METRO STATION ARRIVAL BANNER — placed below top bar on portrait/desktop, ultra-compact on short mobile landscape */}
          {hud.stationBannerVisible && station && (
            <div className="w-full flex justify-center px-2 [@media(max-height:500px)]:-mt-11">
              <div className="max-w-[340px] sm:max-w-[420px] [@media(max-height:500px)]:max-w-[290px] w-full rounded-xl bg-[#1A1423]/94 border-2 border-[#FFD60A]/75 shadow-[0_4px_0_#1A1423] overflow-hidden">
                <div className="h-1 w-full flex">
                  <div className="w-1/2 bg-[#FFD60A]" />
                  <div className="w-1/2 bg-[#DC2626]" />
                </div>
                <div
                  className="px-3 py-0.5 flex items-center justify-between text-[10px] font-bold tracking-wider text-white"
                  style={{ backgroundColor: lineTheme.bar }}
                >
                  <span>NEXT STATION · ಮುಂದಿನ ನಿಲ್ದಾಣ</span>
                  <span className="[@media(max-height:500px)]:hidden">{lineTheme.label}</span>
                </div>
                <div className="px-3 py-1.5 [@media(max-height:500px)]:py-1 text-center">
                  <div className="flex flex-col [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-center [@media(max-height:500px)]:justify-center [@media(max-height:500px)]:gap-2">
                    <div className="font-display text-sm sm:text-base [@media(max-height:500px)]:text-xs text-[#FFD60A] leading-tight truncate">
                      {station.nameEn}
                    </div>
                    <div className="font-kannada text-xs sm:text-sm [@media(max-height:500px)]:text-xs font-bold text-white leading-snug truncate">
                      {station.nameKn}
                    </div>
                  </div>
                  <div className="text-[10px] text-white/75 truncate [@media(max-height:500px)]:hidden">
                    {station.subEn}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER-UPPER FLOATING COMIC CALLOUT */}
        <div className="flex-1 flex items-start justify-center pt-6">
          {hud.callout && (
            <div
              key={hud.callout.id}
              className="px-4 py-1.5 rounded-xl bg-[#1A1423]/92 border-[3px] border-[#1A1423] shadow-[0_4px_0_#1A1423] -rotate-2"
              style={{ borderColor: hud.callout.color }}
            >
              <span
                className="font-display text-base sm:text-xl tracking-wide whitespace-nowrap"
                style={{ color: hud.callout.color }}
              >
                {hud.callout.text}
              </span>
            </div>
          )}
        </div>

        {/* BOTTOM THUMB ZONE: Kannada Voice-Over Caption + Active Power-Ups + Auto Hoverboard + Optional On-Screen D-Pad */}
        <div className="flex flex-col gap-2 w-full">
          {hud.voiceOver && (
            <div className="w-full flex justify-center px-2">
              <div
                key={hud.voiceOver.id}
                data-testid="voiceover-toast"
                className="max-w-[348px] sm:max-w-[430px] w-full rounded-xl bg-[#1A1423]/94 border-2 border-[#FFD60A] shadow-[0_4px_0_#1A1423] overflow-hidden flex items-stretch"
              >
                <div className="w-2 shrink-0 flex flex-col">
                  <div className="h-1/2 bg-[#FFD60A]" />
                  <div className="h-1/2 bg-[#DC2626]" />
                </div>
                <div className="flex items-center gap-2.5 px-3 py-1.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-[#DC2626] border-2 border-[#FFD60A] text-[#FFD60A] flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="font-display text-sm sm:text-base text-[#FFD60A] leading-tight truncate">
                      “{hud.voiceOver.phrase.romanized}”
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs leading-snug truncate">
                      <span className="font-kannada font-bold text-white truncate">
                        {hud.voiceOver.phrase.kannada}
                      </span>
                      <span className="text-white/45 shrink-0">·</span>
                      <span className="text-white/80 truncate">
                        {hud.voiceOver.phrase.meaning}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-end justify-between gap-2 w-full">
            {/* Active Power-Up Radial Timers */}
            <div className="flex items-center gap-2 min-h-[48px]">
              {hud.activePowerUps.map((p) => (
                <PowerUpRing key={p.type} item={p} />
              ))}
            </div>

            {/* Chunky Auto-Rickshaw Hoverboard Trigger */}
            <button
              type="button"
              onClick={onActivateHoverboard}
              disabled={!hud.hoverboardReady}
              aria-label="Activate Auto Hoverboard Shield"
              className={`pointer-events-auto relative overflow-hidden min-h-[52px] px-3.5 sm:px-4 py-2 rounded-2xl border-[3px] border-[#1A1423] shadow-[0_4px_0_#1A1423] flex items-center gap-2 transition-transform cursor-pointer ${
                hud.hoverboardActive
                  ? 'bg-[#00F5D4] text-[#1A1423]'
                  : hud.hoverboardReady
                    ? 'bg-[#FFD60A] text-[#1A1423] active:translate-y-0.5'
                    : 'bg-[#1A1423]/88 text-white/65 cursor-not-allowed'
              }`}
            >
              {/* Cooldown fill bar */}
              {!hud.hoverboardReady && !hud.hoverboardActive && (
                <div
                  className="absolute inset-y-0 left-0 bg-[#7B2CBF]/55"
                  style={{ width: `${Math.round(hud.hoverboardCooldownRatio * 100)}%` }}
                />
              )}
              <AutoBoardIcon className="w-6 h-6 relative z-10 shrink-0" />
              <div className="relative z-10 text-left leading-tight">
                <div className="font-display text-xs sm:text-sm">
                  {hud.hoverboardActive ? 'ACTIVE!' : hud.hoverboardReady ? 'AUTO BOARD' : 'CHARGING'}
                </div>
                <div className="text-[10px] font-bold opacity-80">
                  {hud.hoverboardReady ? 'TAP / 2x' : `${Math.round(hud.hoverboardCooldownRatio * 100)}%`}
                </div>
              </div>
            </button>
          </div>

          {/* Optional Mobile On-Screen Thumb Pad (toggled in Pause menu) */}
          {profile.touchButtonsEnabled && (
            <div className="flex items-center justify-between gap-2 pt-1 pointer-events-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onTouchAction('left');
                  }}
                  aria-label="Move Left"
                  className="w-14 h-12 rounded-xl bg-[#1A1423]/85 text-white border-2 border-white/30 active:bg-[#7B2CBF] flex items-center justify-center"
                >
                  <ChevronLeft className="w-7 h-7" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onTouchAction('right');
                  }}
                  aria-label="Move Right"
                  className="w-14 h-12 rounded-xl bg-[#1A1423]/85 text-white border-2 border-white/30 active:bg-[#7B2CBF] flex items-center justify-center"
                >
                  <ChevronRight className="w-7 h-7" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onTouchAction('roll');
                  }}
                  aria-label="Roll or Fast-Fall"
                  className="w-14 h-12 rounded-xl bg-[#1A1423]/85 text-[#FFD60A] border-2 border-[#FFD60A]/60 active:bg-[#7B2CBF] flex items-center justify-center"
                >
                  <ChevronDown className="w-7 h-7" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onTouchAction('jump');
                  }}
                  aria-label="Jump"
                  className="w-14 h-12 rounded-xl bg-[#2DC653]/90 text-[#1A1423] border-2 border-[#1A1423] active:scale-95 flex items-center justify-center"
                >
                  <ChevronUp className="w-7 h-7" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
