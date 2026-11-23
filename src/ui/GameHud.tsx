import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
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
import type { ActivePowerUpState, HudLiveCounters, HudState } from '../engine/MetroRunnerEngine';
import {
  AutoBoardIcon,
  DosaMagnetIcon,
  DroneIcon,
  HeadstartIcon,
  KaapiIcon,
  MetroTokenIcon,
  Multiplier2xIcon,
  SuperSneakersIcon,
} from './Icons';

export interface GameHudHandle {
  updateLive: (live: HudLiveCounters) => void;
}

interface GameHudProps {
  hud: HudState;
  profile: PlayerProfile;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleAnnouncer: () => void;
  onToggleQuality: (q: GraphicsQuality) => void;
  onActivateHoverboard: () => void;
  onActivateHeadstart: () => void;
  onTouchAction: (action: RunnerAction) => void;
}

const LINE_COLORS: Record<string, { bar: string; label: string }> = {
  purple: { bar: '#7B2CBF', label: 'PURPLE LINE' },
  green: { bar: '#2DC653', label: 'GREEN LINE' },
  yellow: { bar: '#EAB308', label: 'YELLOW LINE' },
  interchange: { bar: '#A855F7', label: 'INTERCHANGE' },
};

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type PowerUpSlotKey = ActivePowerUpState['type'];

const POWER_UP_META: Record<
  PowerUpSlotKey,
  { color: string; label: string; icon: React.ReactNode }
> = {
  hoverboard: { color: '#00F5D4', label: 'BOARD', icon: <AutoBoardIcon className="w-5 h-5" /> },
  kaapi: { color: '#F59E0B', label: 'KAAPI', icon: <KaapiIcon className="w-5 h-5" /> },
  magnet: { color: '#EF4444', label: 'MAGNET', icon: <DosaMagnetIcon className="w-5 h-5" /> },
  drone: { color: '#38BDF8', label: 'DRONE', icon: <DroneIcon className="w-5 h-5" /> },
  sneakers: { color: '#2DC653', label: 'BOOTS', icon: <SuperSneakersIcon className="w-5 h-5" /> },
  multiplier: { color: '#FFD60A', label: '2X', icon: <Multiplier2xIcon className="w-5 h-5" /> },
  mystery_box: { color: '#C084FC', label: 'BOX', icon: <Multiplier2xIcon className="w-5 h-5" /> },
};

const DISPLAYED_POWER_UP_SLOTS: PowerUpSlotKey[] = [
  'hoverboard',
  'kaapi',
  'magnet',
  'drone',
  'sneakers',
  'multiplier',
];

export const GameHud = forwardRef<GameHudHandle, GameHudProps>(function GameHud(
  {
    hud,
    profile,
    onPause,
    onToggleMute,
    onToggleAnnouncer,
    onToggleQuality,
    onActivateHoverboard,
    onActivateHeadstart,
    onTouchAction,
  },
  ref,
) {
  const showDebug = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  // Direct DOM refs updated at 60–120 FPS with ZERO React reconciliation overhead!
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const distanceRef = useRef<HTMLSpanElement | null>(null);
  const tokensRef = useRef<HTMLSpanElement | null>(null);
  const multRef = useRef<HTMLSpanElement | null>(null);
  const hoverBarRef = useRef<HTMLDivElement | null>(null);
  const hoverSubRef = useRef<HTMLDivElement | null>(null);
  const headstartWrapRef = useRef<HTMLButtonElement | null>(null);
  const headstartSecRef = useRef<HTMLSpanElement | null>(null);
  const debugPerfRef = useRef<HTMLDivElement | null>(null);
  const speedLinesRef = useRef<HTMLDivElement | null>(null);
  const ringWrapRefs = useRef<Partial<Record<PowerUpSlotKey, HTMLDivElement | null>>>({});
  const ringStrokeRefs = useRef<Partial<Record<PowerUpSlotKey, SVGCircleElement | null>>>({});

  useImperativeHandle(
    ref,
    () => ({
      updateLive(live: HudLiveCounters) {
        if (scoreRef.current) {
          scoreRef.current.textContent = live.score.toString().padStart(6, '0');
        }
        if (distanceRef.current) {
          distanceRef.current.textContent = `${live.distance}m`;
        }
        if (tokensRef.current) {
          tokensRef.current.textContent = String(live.tokens);
        }
        if (multRef.current) {
          multRef.current.textContent = `x${live.multiplier}`;
        }
        if (hoverBarRef.current) {
          hoverBarRef.current.style.width = `${Math.round(live.hoverboardCooldownRatio * 100)}%`;
        }
        if (hoverSubRef.current) {
          hoverSubRef.current.textContent = live.hoverboardActive
            ? 'SHIELD ON'
            : live.hoverboardReady
              ? 'TAP / SPACE'
              : `${Math.round(live.hoverboardCooldownRatio * 100)}%`;
        }
        if (headstartWrapRef.current) {
          headstartWrapRef.current.style.display = live.headstartRemaining > 0.05 ? 'flex' : 'none';
        }
        if (headstartSecRef.current && live.headstartRemaining > 0) {
          headstartSecRef.current.textContent = `${live.headstartRemaining.toFixed(1)}s`;
        }
        if (speedLinesRef.current) {
          speedLinesRef.current.style.opacity = live.kaapiActive || live.headstartActive ? '1' : '0';
        }
        if (debugPerfRef.current) {
          debugPerfRef.current.textContent = `${live.fps} FPS · ${live.drawCalls} DC`;
        }

        // Update circular SVG power-up timers directly in DOM
        for (let i = 0; i < DISPLAYED_POWER_UP_SLOTS.length; i++) {
          const slotKey = DISPLAYED_POWER_UP_SLOTS[i];
          const wrap = ringWrapRefs.current[slotKey];
          const circle = ringStrokeRefs.current[slotKey];
          if (!wrap || !circle) continue;
          const active = live.activePowerUps.find((p) => p.type === slotKey);
          if (active && active.remaining > 0.02) {
            wrap.style.display = 'flex';
            const ratio = Math.max(0, Math.min(1, active.remaining / Math.max(0.1, active.duration)));
            circle.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - ratio)}`;
          } else {
            wrap.style.display = 'none';
          }
        }
      },
    }),
    [],
  );

  const station = hud.currentStation;
  const lineTheme = station ? (LINE_COLORS[station.line] ?? LINE_COLORS.purple) : LINE_COLORS.purple;
  const speedActive = hud.kaapiActive || hud.headstartActive;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden">
      {/* Anime / Fortnite Radial Speed-Lines Overlay during Filter Kaapi or Headstart */}
      <div
        ref={speedLinesRef}
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{ opacity: speedActive ? 1 : 0 }}
      >
        <div
          className="fixed inset-0 border-[6px] border-[#FFD60A]/70"
          style={{ boxShadow: 'inset 0 0 46px rgba(255, 214, 10, 0.42)' }}
        />
        <svg className="w-full h-full opacity-45" viewBox="0 0 100 100" preserveAspectRatio="none">
          <g stroke="#FFD60A" strokeWidth="0.45" strokeLinecap="round">
            <line x1="0" y1="8" x2="22" y2="28" />
            <line x1="0" y1="30" x2="18" y2="38" />
            <line x1="0" y1="68" x2="18" y2="62" />
            <line x1="0" y1="92" x2="22" y2="74" />
            <line x1="100" y1="8" x2="78" y2="28" />
            <line x1="100" y1="30" x2="82" y2="38" />
            <line x1="100" y1="68" x2="82" y2="62" />
            <line x1="100" y1="92" x2="78" y2="74" />
            <line x1="25" y1="0" x2="36" y2="18" />
            <line x1="75" y1="0" x2="64" y2="18" />
          </g>
        </svg>
      </div>

      {/* Subtle Heavy Monsoon Rain-Mist Vignette */}
      {hud.weather === 'heavy_monsoon' && hud.zone === 'elevated' && !speedActive && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 46px rgba(56, 189, 248, 0.34)' }}
        />
      )}

      {/* Subtle Chaser Danger Edge Vignette */}
      {hud.chaserClose && !speedActive && (
        <div
          className="fixed inset-x-0 bottom-0 h-28 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(239, 68, 68, 0.36), transparent)' }}
        />
      )}

      <div className="h-full w-full flex flex-col justify-between safe-area-pad">
        {/* TOP HUD ROW */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-start justify-between gap-2 w-full">
            {/* Top-Left Utility Buttons (44x44px minimum touch targets) + optional ?debug=1 badge */}
            <div className="flex flex-col items-start gap-1.5">
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={onPause}
                  aria-label="Pause Game"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-[#1A1423]/94 text-white border-[3px] border-[#FFD60A] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center cursor-pointer"
                >
                  <Pause className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={profile.soundMuted ? 'Unmute Audio' : 'Mute Audio'}
                  className={`min-w-[44px] min-h-[44px] rounded-xl border-[3px] border-[#1A1423] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 flex items-center justify-center cursor-pointer ${
                    profile.soundMuted ? 'bg-[#EF4444] text-white' : 'bg-[#FFD60A] text-[#1A1423]'
                  }`}
                >
                  {profile.soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={onToggleAnnouncer}
                  aria-label={profile.announcerEnabled ? 'Mute Station Announcer' : 'Enable Station Announcer'}
                  title={profile.announcerEnabled ? 'Station Announcer: ON' : 'Station Announcer: OFF'}
                  className={`hidden sm:flex min-w-[44px] min-h-[44px] rounded-xl border-[3px] border-[#1A1423] shadow-[0_3px_0_#1A1423] active:translate-y-0.5 items-center justify-center cursor-pointer ${
                    profile.announcerEnabled ? 'bg-[#2DC653] text-[#1A1423]' : 'bg-[#1A1423]/88 text-white/60'
                  }`}
                >
                  <Megaphone className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onToggleQuality(profile.quality === 'high' ? 'eco' : 'high')}
                  aria-label="Toggle Graphics Quality"
                  className="hidden md:flex min-h-[44px] px-3 rounded-xl bg-[#1A1423]/92 text-white border-[3px] border-white/25 shadow-[0_3px_0_#1A1423] active:translate-y-0.5 items-center justify-center font-display text-xs tracking-wider cursor-pointer"
                >
                  {profile.quality === 'high' ? 'HIGH' : 'ECO'}
                </button>
              </div>

              {showDebug && (
                <div
                  ref={debugPerfRef}
                  data-testid="debug-perf"
                  className="px-2.5 py-0.5 rounded-lg bg-[#1A1423]/94 border-2 border-[#00F5D4] text-[#00F5D4] font-mono text-[11px] font-bold tabular-nums shadow-[0_2px_0_#1A1423]"
                >
                  60 FPS · 0 DC
                </div>
              )}
            </div>

            {/* Top-Right Fortnite / Subway Surfers Skewed Arcade Score & Token Badges */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2.5 py-0.5 rounded-lg border-[2.5px] border-[#1A1423] font-display text-xs sm:text-sm shadow-[0_3px_0_#1A1423] -skew-x-10 ${
                    hud.multiplierBoosted
                      ? 'bg-[#FFD60A] text-[#1A1423]'
                      : 'bg-[#7B2CBF] text-white'
                  }`}
                >
                  <span ref={multRef} className="inline-block skew-x-10 tabular-nums">
                    x{hud.multiplier}
                  </span>
                </span>
                <div className="px-3 sm:px-4 py-1 rounded-xl bg-[#1A1423]/94 border-[3px] border-[#FFD60A] shadow-[0_4px_0_#1A1423] -skew-x-10">
                  <span
                    ref={scoreRef}
                    className="block skew-x-10 font-display text-lg sm:text-2xl text-white tabular-nums leading-none"
                  >
                    {hud.score.toString().padStart(6, '0')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#1A1423]/92 border-2 border-[#1A1423] shadow-[0_3px_0_#1A1423] -skew-x-6">
                <span
                  ref={distanceRef}
                  className="skew-x-6 text-[11px] sm:text-xs font-bold text-white/80 tabular-nums"
                >
                  {hud.distance}m
                </span>
                <span className="w-1 h-1 rounded-full bg-white/35" />
                <div className="skew-x-6 flex items-center gap-1">
                  <MetroTokenIcon className="w-4 h-4 shrink-0" />
                  <span
                    ref={tokensRef}
                    className="font-display text-sm text-[#FFD60A] tabular-nums"
                  >
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

          {/* BILINGUAL NAMMA METRO STATION ARRIVAL BANNER */}
          {hud.stationBannerVisible && station && (
            <div className="w-full flex justify-center px-2 [@media(max-height:500px)]:-mt-11">
              <div className="max-w-[340px] sm:max-w-[420px] [@media(max-height:500px)]:max-w-[290px] w-full rounded-xl bg-[#1A1423]/94 border-[3px] border-[#FFD60A] shadow-[0_4px_0_#1A1423] overflow-hidden">
                <div className="h-1 w-full flex">
                  <div className="w-1/2 bg-[#FFD60A]" />
                  <div className="w-1/2 bg-[#DC2626]" />
                </div>
                <div
                  className="px-3 py-0.5 flex items-center justify-between text-[10px] font-bold tracking-wider text-white"
                  style={{ backgroundColor: lineTheme.bar }}
                >
                  <span>
                    {hud.stationBannerKind === 'arriving'
                      ? 'ARRIVING AT · ನಿಲ್ದಾಣ'
                      : 'NEXT STATION · ಮುಂದಿನ ನಿಲ್ದಾಣ'}
                  </span>
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
        <div className="flex-1 flex items-start justify-center pt-5">
          {hud.callout && (
            <div
              key={hud.callout.id}
              className="px-4 py-1.5 rounded-xl bg-[#1A1423]/94 border-[3px] shadow-[0_4px_0_#1A1423] -skew-x-6 -rotate-1"
              style={{ borderColor: hud.callout.color }}
            >
              <span
                className="inline-block skew-x-6 font-display text-base sm:text-xl tracking-wide whitespace-nowrap"
                style={{ color: hud.callout.color }}
              >
                {hud.callout.text}
              </span>
            </div>
          )}
        </div>

        {/* BOTTOM THUMB ZONE: Headstart + Ref-Driven Power-Up Rings + Hoverboard */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-end justify-between gap-2 w-full">
            {/* Bottom-Left: 3-Second Headstart Button + Circular Power-Up Rings (ref-driven!) */}
            <div className="flex items-center gap-2 min-h-[52px]">
              <button
                ref={headstartWrapRef}
                type="button"
                data-testid="headstart-btn"
                onClick={onActivateHeadstart}
                style={{ display: hud.headstartAvailable ? 'flex' : 'none' }}
                aria-label="Activate 250m Express Headstart"
                className="pointer-events-auto min-h-[50px] px-3.5 py-2 rounded-2xl bg-[#7B2CBF] hover:bg-[#9333EA] text-white border-[3px] border-[#FFD60A] shadow-[0_4px_0_#1A1423] active:translate-y-0.5 items-center gap-2 cursor-pointer"
              >
                <HeadstartIcon className="w-5 h-5 shrink-0" />
                <div className="text-left leading-tight">
                  <div className="font-display text-xs sm:text-sm text-[#FFD60A]">HEADSTART</div>
                  <span ref={headstartSecRef} className="text-[10px] font-bold text-white/90 tabular-nums">
                    3.0s
                  </span>
                </div>
              </button>

              {DISPLAYED_POWER_UP_SLOTS.map((slotKey) => {
                const meta = POWER_UP_META[slotKey];
                const initialActive = hud.activePowerUps.find((p) => p.type === slotKey);
                const initRatio = initialActive
                  ? Math.max(0, Math.min(1, initialActive.remaining / Math.max(0.1, initialActive.duration)))
                  : 0;
                return (
                  <div
                    key={slotKey}
                    ref={(el) => {
                      ringWrapRefs.current[slotKey] = el;
                    }}
                    style={{ display: initialActive ? 'flex' : 'none' }}
                    className="relative w-12 h-12 rounded-full bg-[#1A1423]/94 border-[2.5px] border-[#1A1423] shadow-[0_3px_0_#1A1423] items-center justify-center shrink-0"
                  >
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r={RING_RADIUS} stroke="rgba(255,255,255,0.18)" strokeWidth="4" fill="none" />
                      <circle
                        ref={(el) => {
                          ringStrokeRefs.current[slotKey] = el;
                        }}
                        cx="24"
                        cy="24"
                        r={RING_RADIUS}
                        stroke={meta.color}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={RING_CIRCUMFERENCE * (1 - initRatio)}
                        fill="none"
                      />
                    </svg>
                    <div className="relative z-10 flex items-center justify-center">{meta.icon}</div>
                    <span className="sr-only">{meta.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Bottom-Right: Chunky Skewed Auto-Rickshaw Hoverboard Trigger */}
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
                    : 'bg-[#1A1423]/90 text-white/65 cursor-not-allowed'
              }`}
            >
              {!hud.hoverboardReady && !hud.hoverboardActive && (
                <div
                  ref={hoverBarRef}
                  className="absolute inset-y-0 left-0 bg-[#7B2CBF]/60"
                  style={{ width: `${Math.round(hud.hoverboardCooldownRatio * 100)}%` }}
                />
              )}
              <AutoBoardIcon className="w-6 h-6 relative z-10 shrink-0" />
              <div className="relative z-10 text-left leading-tight">
                <div className="font-display text-xs sm:text-sm">
                  {hud.hoverboardActive ? 'SHIELD ON!' : hud.hoverboardReady ? 'AUTO BOARD' : 'CHARGING'}
                </div>
                <div ref={hoverSubRef} className="text-[10px] font-bold opacity-85 tabular-nums">
                  {hud.hoverboardReady ? 'TAP / SPACE' : `${Math.round(hud.hoverboardCooldownRatio * 100)}%`}
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
                  className="w-14 h-12 rounded-xl bg-[#1A1423]/88 text-white border-2 border-white/30 active:bg-[#7B2CBF] flex items-center justify-center"
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
                  className="w-14 h-12 rounded-xl bg-[#1A1423]/88 text-white border-2 border-white/30 active:bg-[#7B2CBF] flex items-center justify-center"
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
                  className="w-14 h-12 rounded-xl bg-[#1A1423]/88 text-[#FFD60A] border-2 border-[#FFD60A]/60 active:bg-[#7B2CBF] flex items-center justify-center"
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
                  className="w-14 h-12 rounded-xl bg-[#2DC653]/92 text-[#1A1423] border-2 border-[#1A1423] active:scale-95 flex items-center justify-center"
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
});
