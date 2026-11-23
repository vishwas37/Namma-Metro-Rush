import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ELEVATED_STATIONS,
  loadProfile,
  saveProfile,
  type CharacterId,
  type GraphicsQuality,
  type HoverboardId,
  type PlayerProfile,
  type UpgradeKey,
} from './core/catalog';
import {
  applyRunToProfile,
  classifySwipeGesture,
  getEffectiveMultiplier,
  purchaseOrSelectCharacter,
  purchaseOrSelectHoverboard,
  purchaseUpgrade,
  type RunSummary,
  type RunnerAction,
} from './core/simulation';
import { createRunnerEngine } from './engine/createRunnerEngine';
import type { HudState, RunnerEngine } from './engine/MetroRunnerEngine';
import { SoundEngine } from './engine/sound';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { GameHud } from './ui/GameHud';
import { GameOverModal, PauseModal } from './ui/Modals';
import { ShopSheet, type ShopTab } from './ui/ShopSheet';
import { TitleScreen } from './ui/TitleScreen';

function createInitialHud(profile: PlayerProfile): HudState {
  return {
    mode: 'title',
    score: 0,
    distance: 0,
    tokens: 0,
    multiplier: getEffectiveMultiplier(profile),
    zone: 'elevated',
    weather: 'sunny',
    currentStation: ELEVATED_STATIONS[0],
    stationBannerVisible: false,
    activePowerUps: [],
    hoverboardReady: true,
    hoverboardCooldownRatio: 1,
    hoverboardActive: false,
    kaapiActive: false,
    chaserClose: false,
    callout: null,
    voiceOver: null,
    lastStationName: 'Indiranagar',
    gameOverQuip: '',
    runSummary: null,
  };
}

function NammaRunnerApp() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [hud, setHud] = useState<HudState>(() => createInitialHud(loadProfile()));
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<ShopTab>('characters');
  const [webglError, setWebglError] = useState<string | null>(null);
  const [runBonuses, setRunBonuses] = useState<{ missions: string[]; tokens: number }>({
    missions: [],
    tokens: 0,
  });

  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RunnerEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const profileRef = useRef<PlayerProfile>(profile);
  const modeRef = useRef(hud.mode);
  const shopOpenRef = useRef(shopOpen);

  // Single-action-per-swipe tracking so 1 swipe left/right ALWAYS moves exactly 1 lane
  const touchAnchorRef = useRef<{
    x: number;
    y: number;
    active: boolean;
    acted: boolean;
    lastAction: RunnerAction;
    movedDist: number;
  }>({
    x: 0,
    y: 0,
    active: false,
    acted: false,
    lastAction: 'none',
    movedDist: 0,
  });
  const lastTapTsRef = useRef<number>(0);

  profileRef.current = profile;
  modeRef.current = hud.mode;
  shopOpenRef.current = shopOpen;

  // Mirror current game state to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = hud.mode;
  }, [hud.mode]);

  // Persist profile and push updates to engine
  const updateProfileState = useCallback((updater: (prev: PlayerProfile) => PlayerProfile) => {
    setProfile((prev) => {
      const next = updater(prev);
      saveProfile(next);
      engineRef.current?.updateProfile(next);
      return next;
    });
  }, []);

  // Mount Three.js engine once inside isolated container ref
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const sound = new SoundEngine();
    sound.setMuted(profileRef.current.soundMuted);
    sound.setAnnouncerEnabled(profileRef.current.announcerEnabled);
    soundRef.current = sound;

    let engine: RunnerEngine | null = null;
    try {
      engine = createRunnerEngine(
        container,
        profileRef.current,
        sound,
        (nextHud) => setHud(nextHud),
        (summary: RunSummary) => {
          setProfile((prev) => {
            const { profile: updated, newlyCompletedMissions, bonusTokens } =
              applyRunToProfile(prev, summary);
            saveProfile(updated);
            engineRef.current?.updateProfile(updated);
            setRunBonuses({ missions: newlyCompletedMissions, tokens: bonusTokens });
            return updated;
          });
        },
      );
      engineRef.current = engine;

      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        engine.startRun();
      }
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'Unable to initialize 3D WebGL track on this device.',
      );
    }

    const onVisibility = () => {
      if (document.hidden && modeRef.current === 'playing') {
        engineRef.current?.pause();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      engine?.dispose();
      engineRef.current = null;
      sound.dispose();
      soundRef.current = null;
    };
  }, []);

  // Strictly gesture-gated audio unlock
  const unlockAudio = useCallback(() => {
    soundRef.current?.unlockFromGesture();
  }, []);

  const handleStart = useCallback(() => {
    unlockAudio();
    setShopOpen(false);
    setRunBonuses({ missions: [], tokens: 0 });
    engineRef.current?.startRun();
  }, [unlockAudio]);

  const handlePause = useCallback(() => {
    unlockAudio();
    engineRef.current?.pause();
  }, [unlockAudio]);

  const handleResume = useCallback(() => {
    unlockAudio();
    engineRef.current?.resume();
  }, [unlockAudio]);

  const handleLobby = useCallback(() => {
    unlockAudio();
    setShopOpen(false);
    engineRef.current?.returnToTitle();
  }, [unlockAudio]);

  const handleActivateHoverboard = useCallback(() => {
    unlockAudio();
    engineRef.current?.activateHoverboard();
  }, [unlockAudio]);

  const handleTouchAction = useCallback(
    (action: RunnerAction) => {
      unlockAudio();
      engineRef.current?.queueAction(action);
    },
    [unlockAudio],
  );

  const handleLobbyTap = useCallback(() => {
    unlockAudio();
    engineRef.current?.triggerLobbyWave();
  }, [unlockAudio]);

  const handleToggleMute = useCallback(() => {
    unlockAudio();
    updateProfileState((p) => ({ ...p, soundMuted: !p.soundMuted }));
  }, [unlockAudio, updateProfileState]);

  const handleToggleAnnouncer = useCallback(() => {
    unlockAudio();
    updateProfileState((p) => ({ ...p, announcerEnabled: !p.announcerEnabled }));
  }, [unlockAudio, updateProfileState]);

  const handleToggleQuality = useCallback(
    (quality: GraphicsQuality) => {
      unlockAudio();
      updateProfileState((p) => ({ ...p, quality }));
    },
    [unlockAudio, updateProfileState],
  );

  const handleToggleTouchButtons = useCallback(() => {
    unlockAudio();
    updateProfileState((p) => ({ ...p, touchButtonsEnabled: !p.touchButtonsEnabled }));
  }, [unlockAudio, updateProfileState]);

  const handleSelectOrBuyCharacter = useCallback(
    (id: CharacterId) => {
      unlockAudio();
      updateProfileState((p) => {
        const res = purchaseOrSelectCharacter(p, id);
        if (res.changed) soundRef.current?.playToken();
        return res.profile;
      });
    },
    [unlockAudio, updateProfileState],
  );

  const handleSelectOrBuyHoverboard = useCallback(
    (id: HoverboardId) => {
      unlockAudio();
      updateProfileState((p) => {
        const res = purchaseOrSelectHoverboard(p, id);
        if (res.changed) soundRef.current?.playAutoHorn();
        return res.profile;
      });
    },
    [unlockAudio, updateProfileState],
  );

  const handleBuyUpgrade = useCallback(
    (key: UpgradeKey) => {
      unlockAudio();
      updateProfileState((p) => {
        const res = purchaseUpgrade(p, key);
        if (res.changed) soundRef.current?.playPowerUp();
        return res.profile;
      });
    },
    [unlockAudio, updateProfileState],
  );

  // Full desktop keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      soundRef.current?.unlockFromGesture();
      const key = e.key;
      const lower = key.toLowerCase();

      if (lower === 'm') {
        updateProfileState((p) => ({ ...p, soundMuted: !p.soundMuted }));
        return;
      }

      if (shopOpenRef.current) {
        if (key === 'Escape') setShopOpen(false);
        return;
      }

      const mode = modeRef.current;

      if (mode === 'title') {
        if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          handleStart();
        }
        return;
      }

      if (mode === 'gameover') {
        if (key === 'Enter' || key === ' ' || lower === 'r') {
          e.preventDefault();
          handleStart();
        } else if (key === 'Escape') {
          handleLobby();
        }
        return;
      }

      if (mode === 'paused') {
        if (key === 'Escape' || lower === 'p') {
          e.preventDefault();
          handleResume();
        } else if (lower === 'r') {
          e.preventDefault();
          handleStart();
        }
        return;
      }

      // Active gameplay controls
      if (key === 'ArrowLeft' || lower === 'a') {
        e.preventDefault();
        engineRef.current?.queueAction('left');
      } else if (key === 'ArrowRight' || lower === 'd') {
        e.preventDefault();
        engineRef.current?.queueAction('right');
      } else if (key === 'ArrowUp' || lower === 'w') {
        e.preventDefault();
        engineRef.current?.queueAction('jump');
      } else if (key === 'ArrowDown' || lower === 's') {
        e.preventDefault();
        engineRef.current?.queueAction('roll');
      } else if (key === ' ' || lower === 'e' || key === 'Shift') {
        e.preventDefault();
        engineRef.current?.activateHoverboard();
      } else if (key === 'Escape' || lower === 'p') {
        e.preventDefault();
        engineRef.current?.pause();
      } else if (lower === 'r') {
        e.preventDefault();
        handleStart();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleLobby, handleResume, handleStart, updateProfileState]);

  // Crisp 1-swipe = 1-lane-step touch gesture detection (never shoots to the extreme edge on 1 swipe!)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      unlockAudio();
      if (modeRef.current !== 'playing' || shopOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) return;
      const t = e.touches[0];
      if (!t) return;
      touchAnchorRef.current = {
        x: t.clientX,
        y: t.clientY,
        active: true,
        acted: false,
        lastAction: 'none',
        movedDist: 0,
      };
    },
    [unlockAudio],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const anchor = touchAnchorRef.current;
    if (!anchor.active || modeRef.current !== 'playing' || shopOpenRef.current) return;
    const t = e.touches[0];
    if (!t) return;

    const dx = t.clientX - anchor.x;
    const dy = t.clientY - anchor.y;
    anchor.movedDist = Math.max(anchor.movedDist, Math.hypot(dx, dy));

    if (!anchor.acted) {
      const action = classifySwipeGesture(dx, dy, 40);
      if (action !== 'none') {
        engineRef.current?.queueAction(action);
        anchor.acted = true;
        anchor.lastAction = action;
        anchor.x = t.clientX;
        anchor.y = t.clientY;
      }
      return;
    }

    // Only allow one intentional mid-air follow-up: swipe down to fast-fall after swiping up to jump.
    // Horizontal swipes NEVER fire twice from a single finger drag!
    if (anchor.lastAction === 'jump' && dy >= 52 && Math.abs(dy) > Math.abs(dx) * 1.25) {
      engineRef.current?.queueAction('roll');
      anchor.lastAction = 'roll';
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const anchor = touchAnchorRef.current;
    if (!anchor.active) return;
    anchor.active = false;

    if (!anchor.acted && anchor.movedDist < 18 && modeRef.current === 'playing' && !shopOpenRef.current) {
      const now = performance.now();
      if (now - lastTapTsRef.current < 280) {
        engineRef.current?.activateHoverboard();
        lastTapTsRef.current = 0;
      } else {
        lastTapTsRef.current = now;
      }
    }
  }, []);

  // Mouse drag fallback for desktop / trackpad testing (1 drag = 1 lane step)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      unlockAudio();
      if (modeRef.current !== 'playing' || shopOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) return;
      touchAnchorRef.current = {
        x: e.clientX,
        y: e.clientY,
        active: true,
        acted: false,
        lastAction: 'none',
        movedDist: 0,
      };
    },
    [unlockAudio],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = touchAnchorRef.current;
    if (!anchor.active || anchor.acted || modeRef.current !== 'playing' || shopOpenRef.current) return;
    const dx = e.clientX - anchor.x;
    const dy = e.clientY - anchor.y;
    const action = classifySwipeGesture(dx, dy, 40);
    if (action !== 'none') {
      engineRef.current?.queueAction(action);
      anchor.acted = true;
      anchor.lastAction = action;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    touchAnchorRef.current.active = false;
  }, []);

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#1A1423] select-none"
      style={{ touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Isolated 3D WebGL Canvas Mount — zero React children inside! */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full z-0" />

      {/* Graceful WebGL Hardware Fallback */}
      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1423] p-6 text-white">
          <div className="w-full max-w-md rounded-2xl bg-[#241B35] border-4 border-[#1A1423] p-6 text-center">
            <h1 className="font-display text-2xl text-[#FFD60A] mb-2">
              WEBGL UNAVAILABLE
            </h1>
            <p className="text-sm text-white/80 mb-5">
              Your browser could not start 3D graphics ({webglError}). Enable hardware acceleration or try a modern mobile browser.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[48px] rounded-xl bg-[#2DC653] text-[#1A1423] font-display text-lg border-[3px] border-[#1A1423] cursor-pointer"
            >
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* Title Screen */}
      {!webglError && hud.mode === 'title' && (
        <TitleScreen
          profile={profile}
          onStart={handleStart}
          onOpenShop={(t) => {
            unlockAudio();
            setShopTab(t);
            setShopOpen(true);
          }}
          onSelectCharacter={handleSelectOrBuyCharacter}
          onToggleMute={handleToggleMute}
          onToggleAnnouncer={handleToggleAnnouncer}
          onLobbyTap={handleLobbyTap}
        />
      )}

      {/* Active Gameplay HUD */}
      {!webglError && hud.mode === 'playing' && (
        <GameHud
          hud={hud}
          profile={profile}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
          onToggleAnnouncer={handleToggleAnnouncer}
          onToggleQuality={handleToggleQuality}
          onActivateHoverboard={handleActivateHoverboard}
          onTouchAction={handleTouchAction}
        />
      )}

      {/* Pause Modal */}
      {!webglError && hud.mode === 'paused' && (
        <PauseModal
          profile={profile}
          onResume={handleResume}
          onRestart={handleStart}
          onLobby={handleLobby}
          onToggleMute={handleToggleMute}
          onToggleAnnouncer={handleToggleAnnouncer}
          onToggleQuality={handleToggleQuality}
          onToggleTouchButtons={handleToggleTouchButtons}
        />
      )}

      {/* Game Over Modal */}
      {!webglError && hud.mode === 'gameover' && (
        <GameOverModal
          hud={hud}
          profile={profile}
          newlyCompletedMissions={runBonuses.missions}
          bonusTokens={runBonuses.tokens}
          onRestart={handleStart}
          onOpenShop={() => {
            unlockAudio();
            setShopTab('characters');
            setShopOpen(true);
          }}
          onLobby={handleLobby}
        />
      )}

      {/* Mobile Bottom-Sheet Shop & Missions */}
      {shopOpen && (
        <ShopSheet
          profile={profile}
          tab={shopTab}
          onChangeTab={setShopTab}
          onClose={() => setShopOpen(false)}
          onSelectOrBuyCharacter={handleSelectOrBuyCharacter}
          onSelectOrBuyHoverboard={handleSelectOrBuyHoverboard}
          onBuyUpgrade={handleBuyUpgrade}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <NammaRunnerApp />
    </ErrorBoundary>
  );
}
