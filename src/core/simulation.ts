import {
  CHARACTERS,
  HOVERBOARDS,
  UPGRADES,
  createMissionsForTier,
  type CharacterId,
  type HoverboardId,
  type PlayerProfile,
  type UpgradeKey,
  type WeatherMode,
  type ZoneMode,
} from './catalog';

export const LANE_POSITIONS = [-3.1, 0, 3.1] as const;
export const TRAIN_ROOF_Y = 3.05;
export const DRONE_FLIGHT_Y = 6.2;
export const GRAVITY = -48;
export const JUMP_VELOCITY = 17.2;
export const FAST_FALL_VELOCITY = -36;
export const ROLL_DURATION = 0.65;
export const COYOTE_TIME = 0.11;
export const INPUT_BUFFER_TIME = 0.14;
export const STUMBLE_CHASE_WINDOW = 7.5;
export const HOVERBOARD_COOLDOWN = 14.0;
export const ZONE_DISTANCE_INTERVAL = 720;
export const WEATHER_CYCLE_DISTANCE = 200;

export type RunnerAction = 'none' | 'left' | 'right' | 'jump' | 'roll';

export interface CameraFraming {
  fov: number;
  chaseZ: number;
  chaseY: number;
  lobbyRadius: number;
  lobbyY: number;
  lobbyLookY: number;
}

/**
 * Dynamically adapts camera FOV & distance so all 3 Namma Metro lanes,
 * oncoming trains, and the hero character stay 100% framed in both
 * narrow mobile portrait (375x812, 390x844) and wide desktop (1440x900).
 */
export function computeCameraFraming(width: number, height: number): CameraFraming {
  const aspect = width / Math.max(1, height);
  if (aspect < 0.72) {
    // Tall mobile portrait (e.g. 9:19.5 iPhone / Android)
    return {
      fov: 76,
      chaseZ: 11.4,
      chaseY: 5.55,
      lobbyRadius: 6.8,
      lobbyY: 2.35,
      lobbyLookY: 1.25,
    };
  }
  if (aspect < 1.05) {
    // Square / tablet portrait
    return {
      fov: 68,
      chaseZ: 9.8,
      chaseY: 5.05,
      lobbyRadius: 5.9,
      lobbyY: 2.3,
      lobbyLookY: 1.32,
    };
  }
  // Landscape desktop / tablet
  return {
    fov: 60,
    chaseZ: 8.5,
    chaseY: 4.55,
    lobbyRadius: 5.2,
    lobbyY: 2.25,
    lobbyLookY: 1.38,
  };
}

/**
 * Classifies a touch or pointer swipe vector into a deliberate runner action.
 * Uses a 40px threshold + axis dominance ratio so small jitters never misfire.
 */
export function classifySwipeGesture(dx: number, dy: number, thresholdPx = 40): RunnerAction {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < thresholdPx) return 'none';
  if (absX >= absY * 1.15) {
    return dx > 0 ? 'right' : 'left';
  }
  if (absY >= absX * 1.15) {
    return dy < 0 ? 'jump' : 'roll';
  }
  if (Math.max(absX, absY) < thresholdPx * 1.35) return 'none';
  return absX >= absY ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'jump' : 'roll';
}

export interface SupportBox {
  lane: number;
  zStart: number;
  zEnd: number;
  topY: number;
  isRamp?: boolean;
  rampStartZ?: number;
  rampEndZ?: number;
}

export interface PlayerKinematics {
  lane: number;
  lastSafeLane: number;
  x: number;
  vx: number;
  y: number;
  vy: number;
  grounded: boolean;
  coyoteTimer: number;
  rolling: boolean;
  rollTimer: number;
  bufferedAction: RunnerAction;
  bufferTimer: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  laneChangeCooldown: number;
  droneActive: boolean;
}

export function createInitialPlayerKinematics(): PlayerKinematics {
  return {
    lane: 1,
    lastSafeLane: 1,
    x: 0,
    vx: 0,
    y: 0,
    vy: 0,
    grounded: true,
    coyoteTimer: COYOTE_TIME,
    rolling: false,
    rollTimer: 0,
    bufferedAction: 'none',
    bufferTimer: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    laneChangeCooldown: 0,
    droneActive: false,
  };
}

export function queuePlayerAction(state: PlayerKinematics, action: RunnerAction): void {
  if (action === 'none') return;
  state.bufferedAction = action;
  state.bufferTimer = INPUT_BUFFER_TIME;
}

export function resolveSupportHeight(
  playerX: number,
  playerY: number,
  supports: SupportBox[],
  playerZ = 0,
): number {
  let highest = 0;
  for (let i = 0; i < supports.length; i++) {
    const s = supports[i];
    const laneCenter = LANE_POSITIONS[s.lane];
    if (Math.abs(playerX - laneCenter) > 1.38) continue;

    if (
      s.isRamp &&
      s.rampStartZ !== undefined &&
      s.rampEndZ !== undefined &&
      playerZ <= s.rampStartZ + 0.65 &&
      playerZ >= s.rampEndZ - 0.85
    ) {
      const span = Math.max(0.1, s.rampStartZ - s.rampEndZ);
      const t = Math.max(0, Math.min(1, (s.rampStartZ - playerZ) / span));
      const rampY = t * s.topY;
      if (playerY >= rampY - 1.05) {
        highest = Math.max(highest, rampY);
      }
    }

    if (playerZ <= s.zStart + 0.65 && playerZ >= s.zEnd - 0.5) {
      if (playerY >= s.topY - 0.78) {
        highest = Math.max(highest, s.topY);
      }
    }
  }
  return highest;
}

export interface PhysicsStepEvents {
  jumped: boolean;
  landed: boolean;
  slammed: boolean;
  rolled: boolean;
  switchedLane: number;
}

export interface WeatherPhysicsProfile {
  slippery: boolean;
  lateralStiffness: number;
  springStiffness: number;
  springDamping: number;
  slideImpulse: number;
}

export function getWeatherPhysicsProfile(weather: WeatherMode): WeatherPhysicsProfile {
  if (weather === 'heavy_monsoon') {
    return {
      slippery: true,
      lateralStiffness: 12.5,
      springStiffness: 78,
      springDamping: 10.6,
      slideImpulse: 2.2,
    };
  }
  if (weather === 'light_rain') {
    return {
      slippery: false,
      lateralStiffness: 17.5,
      springStiffness: 0,
      springDamping: 0,
      slideImpulse: 0,
    };
  }
  return {
    slippery: false,
    lateralStiffness: 20,
    springStiffness: 0,
    springDamping: 0,
    slideImpulse: 0,
  };
}

export function stepPlayerPhysics(
  state: PlayerKinematics,
  dt: number,
  supports: SupportBox[],
  weather: WeatherMode = 'sunny',
): PhysicsStepEvents {
  const events: PhysicsStepEvents = {
    jumped: false,
    landed: false,
    slammed: false,
    rolled: false,
    switchedLane: 0,
  };

  const clampedDt = Math.min(dt, 0.05);
  const weatherPhys = getWeatherPhysicsProfile(weather);

  if (state.bufferTimer > 0) {
    state.bufferTimer -= clampedDt;
    if (state.bufferTimer <= 0) state.bufferedAction = 'none';
  }
  if (state.laneChangeCooldown > 0) {
    state.laneChangeCooldown = Math.max(0, state.laneChangeCooldown - clampedDt);
  }

  if (Math.abs(state.x - LANE_POSITIONS[state.lane]) < 0.35) {
    state.lastSafeLane = state.lane;
  }

  if (state.bufferedAction === 'left' && state.laneChangeCooldown <= 0) {
    if (state.lane > 0) {
      state.lastSafeLane = state.lane;
      state.lane -= 1;
      state.laneChangeCooldown = weatherPhys.slippery ? 0.11 : 0.09;
      if (weatherPhys.slippery && state.grounded && !state.droneActive) {
        state.vx -= weatherPhys.slideImpulse;
      }
      events.switchedLane = -1;
    }
    state.bufferedAction = 'none';
    state.bufferTimer = 0;
  } else if (state.bufferedAction === 'right' && state.laneChangeCooldown <= 0) {
    if (state.lane < 2) {
      state.lastSafeLane = state.lane;
      state.lane += 1;
      state.laneChangeCooldown = weatherPhys.slippery ? 0.11 : 0.09;
      if (weatherPhys.slippery && state.grounded && !state.droneActive) {
        state.vx += weatherPhys.slideImpulse;
      }
      events.switchedLane = 1;
    }
    state.bufferedAction = 'none';
    state.bufferTimer = 0;
  }

  const targetX = LANE_POSITIONS[state.lane];
  if (weatherPhys.slippery && state.grounded && !state.droneActive) {
    // Slightly slippery Heavy Monsoon track: wet lateral momentum & subtle hydroplane drift
    const acc = (targetX - state.x) * weatherPhys.springStiffness - state.vx * weatherPhys.springDamping;
    state.vx += acc * clampedDt;
    state.x = Math.max(-3.55, Math.min(3.55, state.x + state.vx * clampedDt));
    if (Math.abs(targetX - state.x) < 0.015 && Math.abs(state.vx) < 0.08) {
      state.x = targetX;
      state.vx = 0;
    }
  } else {
    const lateralAlpha = 1 - Math.exp(-weatherPhys.lateralStiffness * clampedDt);
    const prevX = state.x;
    state.x += (targetX - state.x) * lateralAlpha;
    state.vx = clampedDt > 0 ? (state.x - prevX) / clampedDt : 0;
  }

  if (state.droneActive) {
    const flyAlpha = 1 - Math.exp(-8 * clampedDt);
    state.y += (DRONE_FLIGHT_Y - state.y) * flyAlpha;
    state.vy = 0;
    state.grounded = false;
    state.rolling = false;
    state.rollTimer = 0;
    const damp = 1 - Math.exp(-12 * clampedDt);
    state.scaleX += (1 - state.scaleX) * damp;
    state.scaleY += (1 - state.scaleY) * damp;
    state.scaleZ += (1 - state.scaleZ) * damp;
    return events;
  }

  if (state.grounded) {
    state.coyoteTimer = COYOTE_TIME;
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - clampedDt);
  }

  if (state.bufferedAction === 'jump' && (state.grounded || state.coyoteTimer > 0)) {
    state.vy = JUMP_VELOCITY;
    state.grounded = false;
    state.coyoteTimer = 0;
    state.rolling = false;
    state.rollTimer = 0;
    state.scaleX = 0.82;
    state.scaleY = 1.24;
    state.scaleZ = 0.82;
    state.bufferedAction = 'none';
    state.bufferTimer = 0;
    events.jumped = true;
  }

  if (state.bufferedAction === 'roll') {
    if (!state.grounded && state.y > 0.25) {
      state.vy = FAST_FALL_VELOCITY;
      state.scaleX = 0.86;
      state.scaleY = 1.18;
      state.scaleZ = 0.86;
      events.slammed = true;
      state.bufferedAction = 'roll';
      state.bufferTimer = 0.24;
    } else {
      state.rolling = true;
      state.rollTimer = ROLL_DURATION;
      state.scaleX = 1.24;
      state.scaleY = 0.62;
      state.scaleZ = 1.18;
      state.bufferedAction = 'none';
      state.bufferTimer = 0;
      events.rolled = true;
    }
  }

  if (state.rolling) {
    state.rollTimer -= clampedDt;
    if (state.rollTimer <= 0) {
      state.rolling = false;
      state.rollTimer = 0;
    }
  }

  const prevGrounded = state.grounded;
  const prevVy = state.vy;
  state.vy += GRAVITY * clampedDt;
  state.y += state.vy * clampedDt;

  const supportY = resolveSupportHeight(state.x, state.y, supports, 0);
  if (state.y <= supportY && state.vy <= 0) {
    state.y = supportY;
    state.vy = 0;
    state.grounded = true;
    if (!prevGrounded) {
      events.landed = true;
      const hardLand = prevVy < -24;
      state.scaleX = hardLand ? 1.3 : 1.2;
      state.scaleY = hardLand ? 0.72 : 0.8;
      state.scaleZ = hardLand ? 1.26 : 1.18;
      if (state.bufferedAction === 'roll') {
        state.rolling = true;
        state.rollTimer = ROLL_DURATION;
        state.bufferedAction = 'none';
        state.bufferTimer = 0;
        events.rolled = true;
      }
    }
  } else {
    state.grounded = false;
  }

  const targetSx = state.rolling ? 1.12 : 1;
  const targetSy = state.rolling ? 0.56 : 1;
  const targetSz = state.rolling ? 1.12 : 1;
  const squashAlpha = 1 - Math.exp(-14 * clampedDt);
  state.scaleX += (targetSx - state.scaleX) * squashAlpha;
  state.scaleY += (targetSy - state.scaleY) * squashAlpha;
  state.scaleZ += (targetSz - state.scaleZ) * squashAlpha;

  return events;
}

export type HazardKind =
  | 'train_static'
  | 'train_ramp'
  | 'train_moving'
  | 'barrier_jump'
  | 'barricade_bbmp'
  | 'gantry_low';

export interface HazardCollider {
  id: number;
  kind: HazardKind;
  lane: number;
  zStart: number;
  zEnd: number;
  prevZStart?: number;
  prevZEnd?: number;
  height: number;
  clearanceBottomY?: number;
  rampLength?: number;
  closeCallTriggered?: boolean;
}

export type HazardOutcome = 'none' | 'close_call' | 'stumble' | 'shield_break' | 'crash';

export interface HazardEvalContext {
  playerX: number;
  playerY: number;
  playerRolling: boolean;
  invincible: boolean;
  hoverboardActive: boolean;
  chaserClose: boolean;
}

export function evaluateHazardInteraction(
  ctx: HazardEvalContext,
  hazard: HazardCollider,
): HazardOutcome {
  if (ctx.invincible) return 'none';

  const laneX = LANE_POSITIONS[hazard.lane];
  const dx = Math.abs(ctx.playerX - laneX);
  const isTrain = hazard.kind.startsWith('train');
  const playerHalfWidth = 0.48;
  const hazardHalfWidth = isTrain ? 1.24 : 1.08;
  const playerHeight = ctx.playerRolling ? 0.92 : 1.85;
  const playerTop = ctx.playerY + playerHeight;

  // Solid front of train (for train_ramp, solid body begins after the climbable ramp)
  const effectiveFrontZ =
    hazard.kind === 'train_ramp' && hazard.rampLength
      ? hazard.zStart - hazard.rampLength
      : hazard.zStart;
  const prevEffectiveFrontZ =
    hazard.prevZStart !== undefined
      ? hazard.kind === 'train_ramp' && hazard.rampLength
        ? hazard.prevZStart - hazard.rampLength
        : hazard.prevZStart
      : effectiveFrontZ;
  const prevBackZ = hazard.prevZEnd ?? hazard.zEnd;

  // Swept Z-overlap check prevents high-speed moving trains or barriers from tunneling past player Z=0
  const playerHalfZ = 0.48;
  const zNowOverlap = effectiveFrontZ >= -playerHalfZ && hazard.zEnd <= playerHalfZ;
  const zSweptThrough = prevEffectiveFrontZ < -playerHalfZ && hazard.zEnd > playerHalfZ;
  const zSweptFront = prevEffectiveFrontZ <= playerHalfZ && effectiveFrontZ >= -playerHalfZ && prevBackZ <= playerHalfZ;
  const zOverlap = zNowOverlap || zSweptThrough || zSweptFront;

  if (!zOverlap) {
    if (
      !hazard.closeCallTriggered &&
      hazard.zStart >= -0.3 &&
      hazard.zEnd <= 1.2 &&
      dx >= hazardHalfWidth + playerHalfWidth &&
      dx <= hazardHalfWidth + playerHalfWidth + 1.35 &&
      ctx.playerY < hazard.height
    ) {
      return 'close_call';
    }
    return 'none';
  }

  if (dx >= hazardHalfWidth + playerHalfWidth) {
    if (
      !hazard.closeCallTriggered &&
      dx <= hazardHalfWidth + playerHalfWidth + 1.25 &&
      ctx.playerY < hazard.height
    ) {
      return 'close_call';
    }
    return 'none';
  }

  if (hazard.kind === 'gantry_low') {
    const bottomClear = hazard.clearanceBottomY ?? 1.25;
    if (playerTop <= bottomClear) {
      return hazard.closeCallTriggered ? 'none' : 'close_call';
    }
    if (ctx.playerY >= hazard.height - 0.15) return 'none';
  } else if (isTrain) {
    // Standing/landing cleanly on top of the train roof
    if (ctx.playerY >= hazard.height - 0.45) return 'none';
  } else {
    if (ctx.playerY >= hazard.height - 0.35) return 'none';
  }

  // Only count as a glancing side-stumble if the train nose has clearly passed Z=0 AND player is on the outer side edge
  const isSideHit = isTrain && dx > hazardHalfWidth - 0.14 && effectiveFrontZ > 1.35 && prevEffectiveFrontZ > 0.7;

  if (ctx.hoverboardActive) return 'shield_break';
  if (isSideHit && !ctx.chaserClose) return 'stumble';
  return 'crash';
}

export function getZoneForDistance(distanceMeters: number): ZoneMode {
  return Math.floor(Math.max(0, distanceMeters) / ZONE_DISTANCE_INTERVAL) % 2 === 0
    ? 'elevated'
    : 'underground';
}

export function getWeatherForDistance(distanceMeters: number, zone: ZoneMode): WeatherMode {
  if (zone === 'underground') return 'sunny';
  const cycle = Math.floor(Math.max(0, distanceMeters) / WEATHER_CYCLE_DISTANCE) % 3;
  return cycle === 0 ? 'sunny' : cycle === 1 ? 'light_rain' : 'heavy_monsoon';
}

export function getRunSpeed(distanceMeters: number, kaapiBoostActive: boolean): number {
  const base = Math.min(44, 21 + distanceMeters * 0.014);
  return kaapiBoostActive ? base * 1.65 : base;
}

export function getPowerUpDuration(profile: PlayerProfile, key: UpgradeKey): number {
  const def = UPGRADES.find((u) => u.key === key);
  if (!def) return 6;
  const level = Math.max(1, Math.min(def.maxLevel, profile.upgrades[key] ?? 1));
  return def.baseDuration + (level - 1) * def.perLevelBonus;
}

export function getUpgradeCost(profile: PlayerProfile, key: UpgradeKey): number | null {
  const def = UPGRADES.find((u) => u.key === key);
  if (!def) return null;
  const level = profile.upgrades[key] ?? 1;
  if (level >= def.maxLevel) return null;
  return Math.round(def.baseCost * Math.pow(1.65, level - 1));
}

export function getEffectiveMultiplier(profile: PlayerProfile): number {
  const completedCount = profile.missions.filter((m) => m.completed).length;
  return Math.max(1, profile.missionTier + Math.floor(completedCount / 3));
}

export function purchaseOrSelectCharacter(
  profile: PlayerProfile,
  id: CharacterId,
): { profile: PlayerProfile; changed: boolean } {
  const def = CHARACTERS.find((c) => c.id === id);
  if (!def) return { profile, changed: false };
  if (profile.unlockedCharacters.includes(id)) {
    return {
      profile: { ...profile, selectedCharacter: id },
      changed: profile.selectedCharacter !== id,
    };
  }
  if (profile.tokens < def.cost) return { profile, changed: false };
  return {
    profile: {
      ...profile,
      tokens: profile.tokens - def.cost,
      unlockedCharacters: [...profile.unlockedCharacters, id],
      selectedCharacter: id,
    },
    changed: true,
  };
}

export function purchaseOrSelectHoverboard(
  profile: PlayerProfile,
  id: HoverboardId,
): { profile: PlayerProfile; changed: boolean } {
  const def = HOVERBOARDS.find((h) => h.id === id);
  if (!def) return { profile, changed: false };
  if (profile.unlockedHoverboards.includes(id)) {
    return {
      profile: { ...profile, selectedHoverboard: id },
      changed: profile.selectedHoverboard !== id,
    };
  }
  if (profile.tokens < def.cost) return { profile, changed: false };
  return {
    profile: {
      ...profile,
      tokens: profile.tokens - def.cost,
      unlockedHoverboards: [...profile.unlockedHoverboards, id],
      selectedHoverboard: id,
    },
    changed: true,
  };
}

export function purchaseUpgrade(
  profile: PlayerProfile,
  key: UpgradeKey,
): { profile: PlayerProfile; changed: boolean } {
  const cost = getUpgradeCost(profile, key);
  if (cost === null || profile.tokens < cost) return { profile, changed: false };
  return {
    profile: {
      ...profile,
      tokens: profile.tokens - cost,
      upgrades: {
        ...profile.upgrades,
        [key]: (profile.upgrades[key] ?? 1) + 1,
      },
    },
    changed: true,
  };
}

export interface RunSummary {
  score: number;
  distance: number;
  tokensCollected: number;
  stationsPassed: number;
  kaapiUsed: number;
  closeCalls: number;
}

export function applyRunToProfile(
  profile: PlayerProfile,
  run: RunSummary,
): { profile: PlayerProfile; newlyCompletedMissions: string[]; bonusTokens: number } {
  let bonusTokens = 0;
  const newlyCompletedMissions: string[] = [];

  const updatedMissions = profile.missions.map((m) => {
    if (m.completed) return m;
    let delta = 0;
    if (m.metric === 'tokens') delta = run.tokensCollected;
    else if (m.metric === 'stations') delta = run.stationsPassed;
    else if (m.metric === 'kaapi') delta = run.kaapiUsed;
    else if (m.metric === 'closeCalls') delta = run.closeCalls;

    const nextProgress = Math.min(m.target, m.progress + delta);
    const nowDone = nextProgress >= m.target;
    if (nowDone && !m.completed) {
      bonusTokens += m.rewardTokens;
      newlyCompletedMissions.push(m.label);
    }
    return { ...m, progress: nextProgress, completed: nowDone };
  });

  const allCompleted = updatedMissions.every((m) => m.completed);
  const nextTier = allCompleted ? profile.missionTier + 1 : profile.missionTier;
  const finalMissions = allCompleted ? createMissionsForTier(nextTier) : updatedMissions;

  return {
    profile: {
      ...profile,
      tokens: profile.tokens + run.tokensCollected + bonusTokens,
      highScore: Math.max(profile.highScore, Math.round(run.score)),
      bestDistance: Math.max(profile.bestDistance, Math.round(run.distance)),
      missionTier: nextTier,
      missions: finalMissions,
    },
    newlyCompletedMissions,
    bonusTokens,
  };
}
