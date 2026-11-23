import {
  BILLBOARDS,
  CHARACTERS,
  CLOSE_CALL_QUIPS,
  ELEVATED_STATIONS,
  GAME_OVER_QUIPS,
  HOVERBOARDS,
  SPEED_BOOST_QUIPS,
  UNDERGROUND_STATIONS,
  type CharacterSpec,
  type HoverboardSpec,
  type MetroStation,
  type PlayerProfile,
  type PowerUpType,
  type WeatherMode,
  type ZoneMode,
} from '../core/catalog';
import {
  DRONE_FLIGHT_Y,
  HEADSTART_DISTANCE,
  HEADSTART_WINDOW,
  HOVERBOARD_COOLDOWN,
  LANE_POSITIONS,
  STUMBLE_CHASE_WINDOW,
  TRAIN_ROOF_Y,
  createInitialPlayerKinematics,
  evaluateHazardInteraction,
  getEffectiveMultiplier,
  getPowerUpDuration,
  getRunSpeed,
  getWeatherForDistance,
  queuePlayerAction,
  stepPlayerPhysics,
  type HazardCollider,
  type HazardKind,
  type PlayerKinematics,
  type RunSummary,
  type RunnerAction,
  type SupportBox,
} from '../core/simulation';
import {
  pickVoiceOverPhrase,
  type VoiceOverEvent,
} from '../core/voiceOver';
import type {
  ActivePowerUpState,
  ActiveVoiceOver,
  CalloutToast,
  GameMode,
  HudLiveCounters,
  HudState,
  RunnerEngine,
} from './MetroRunnerEngine';
import { SoundEngine } from './sound';

interface Hazard2D extends HazardCollider {
  speedOffset: number;
  active: boolean;
  line: 'purple' | 'green';
}

interface Token2D {
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

interface PowerUp2D {
  type: PowerUpType;
  lane: number;
  y: number;
  z: number;
  collected: boolean;
}

interface Station2D {
  station: MetroStation;
  z: number;
  announced: boolean;
}

interface Portal2D {
  z: number;
  targetZone: ZoneMode;
  passed: boolean;
}

interface Particle2D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ProjectedPoint {
  sx: number;
  sy: number;
  scale: number;
}

function hexNum(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function readWeatherOverride(): WeatherMode | null {
  if (typeof window === 'undefined') return null;
  const w = new URLSearchParams(window.location.search).get('weather');
  if (w === 'sunny' || w === 'light_rain' || w === 'heavy_monsoon') return w;
  return null;
}

/**
 * High-FPS 2.5D perspective HTML5 Canvas 2D Bengaluru Metro runner engine.
 * Automatically activates when WebGL2 cannot be created (e.g. Mesa/llvmpipe
 * BindToCurrentSequence failures) so the game always runs with zero errors.
 */
export class Canvas2DRunnerEngine implements RunnerEngine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private dpr = 1;

  private profile: PlayerProfile;
  private sound: SoundEngine;
  private onHud: (hud: HudState) => void;
  private onLiveTick?: (live: HudLiveCounters) => void;
  private onRunEnd: (summary: RunSummary) => void;

  private player: PlayerKinematics = createInitialPlayerKinematics();
  private mode: GameMode = 'title';
  private score = 0;
  private distance = 0;
  private runTokens = 0;
  private stationsPassed = 0;
  private kaapiUsed = 0;
  private closeCalls = 0;
  private mysteryBoxes = 0;
  private mysteryBonusTokens = 0;
  private mysteryRewardLabel = '';
  private runTime = 0;
  private headstartActive = false;
  private headstartTargetDist = 0;
  private lastStationName = 'Indiranagar';
  private gameOverQuip = GAME_OVER_QUIPS[0];
  private runSummary: RunSummary | null = null;

  private zone: ZoneMode = 'elevated';
  private spawnedZone: ZoneMode = 'elevated';
  private weather: WeatherMode = 'sunny';
  private weatherOverride: WeatherMode | null = readWeatherOverride();
  private elevatedIdx = 0;
  private undergroundIdx = 0;
  private nextWaveZ = -84;
  private nextStationDist = 210;
  private nextZoneDist = 720;

  private hazards: Hazard2D[] = [];
  private tokens: Token2D[] = [];
  private powerUps: PowerUp2D[] = [];
  private stations: Station2D[] = [];
  private portals: Portal2D[] = [];
  private particles: Particle2D[] = [];
  private nextEntityId = 1;

  private elapsed = 0;
  private lastTs = 0;
  private frameHandle = 0;
  private disposed = false;
  private hitstopTimer = 0;
  private crashPending = false;
  private crashDelayTimer = 0;
  private cameraTrauma = 0;
  private chaserTimer = 4.2;
  private stumbleGraceTimer = 0;
  private lobbyHopTimer = 0;
  private trackScroll = 0;

  private stationBannerTimer = 0;
  private activeStationBanner: MetroStation | null = null;
  private callout: CalloutToast | null = null;
  private calloutTimer = 0;
  private calloutSeq = 1;
  private activeVoiceOver: ActiveVoiceOver | null = null;
  private voiceOverTimer = 0;
  private voiceOverSeq = 1;
  private lastVoiceOverByEvent: Partial<Record<VoiceOverEvent, string>> = {};

  private kaapiTimer = 0;
  private kaapiDuration = 5.5;
  private magnetTimer = 0;
  private magnetDuration = 8.0;
  private droneTimer = 0;
  private droneDuration = 7.0;
  private sneakersTimer = 0;
  private sneakersDuration = 11.0;
  private multiplierTimer = 0;
  private multiplierDuration = 12.0;
  private hoverboardTimer = 0;
  private hoverboardDuration = 30.0;
  private hoverboardCooldown = 0;
  private lastHudPush = 0;

  private resizeObserver: ResizeObserver | null = null;
  private onWindowResizeBound: () => void;

  constructor(
    container: HTMLElement,
    profile: PlayerProfile,
    sound: SoundEngine,
    onHud: (hud: HudState) => void,
    onRunEnd: (summary: RunSummary) => void,
    onLiveTick?: (live: HudLiveCounters) => void,
  ) {
    this.container = container;
    this.profile = profile;
    this.sound = sound;
    this.onHud = onHud;
    this.onRunEnd = onRunEnd;
    this.onLiveTick = onLiveTick;

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.dataset.renderer = 'canvas2d';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to initialize 2D canvas context.');
    }
    this.ctx = ctx;

    this.onWindowResizeBound = () => this.handleResize();
    window.addEventListener('resize', this.onWindowResizeBound);
    window.addEventListener('orientationchange', this.onWindowResizeBound);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(container);
    }

    this.handleResize();
    this.pushHud(true);
    this.lastTs = performance.now();
    this.startLoop();
  }

  public updateProfile(profile: PlayerProfile): void {
    this.profile = profile;
    this.sound.setMuted(profile.soundMuted);
    this.sound.setAnnouncerEnabled(profile.announcerEnabled);
    this.handleResize();
    this.pushHud(true);
  }

  public triggerLobbyWave(): void {
    if (this.mode !== 'title') return;
    this.lobbyHopTimer = 0.55;
    this.sound.playJump();
  }

  public startRun(): void {
    this.hazards = [];
    this.tokens = [];
    this.powerUps = [];
    this.stations = [];
    this.portals = [];
    this.particles = [];

    this.mode = 'playing';
    this.player = createInitialPlayerKinematics();
    this.score = 0;
    this.distance = 0;
    this.runTokens = 0;
    this.stationsPassed = 0;
    this.kaapiUsed = 0;
    this.closeCalls = 0;
    this.lastStationName = 'Indiranagar';
    this.runSummary = null;
    this.crashPending = false;
    this.crashDelayTimer = 0;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;

    this.zone = 'elevated';
    this.spawnedZone = 'elevated';
    this.weather = this.weatherOverride ?? 'sunny';
    this.sound.setUnderground(false);
    this.elevatedIdx = 0;
    this.undergroundIdx = 0;
    this.nextStationDist = 210;
    this.nextZoneDist = 720;

    this.kaapiTimer = 0;
    this.magnetTimer = 0;
    this.droneTimer = 0;
    this.sneakersTimer = 0;
    this.multiplierTimer = 0;
    this.hoverboardTimer = 0;
    this.hoverboardCooldown = 0;
    this.mysteryBoxes = 0;
    this.mysteryBonusTokens = 0;
    this.mysteryRewardLabel = '';
    this.runTime = 0;
    this.headstartActive = false;
    this.headstartTargetDist = 0;
    this.chaserTimer = 4.2;
    this.stumbleGraceTimer = 0;
    this.stationBannerTimer = 0;
    this.activeStationBanner = null;
    this.callout = null;
    this.calloutTimer = 0;
    this.activeVoiceOver = null;
    this.voiceOverTimer = 0;

    this.spawnTokenLine(1, -18, 8, 1.05, 3.2);
    this.nextWaveZ = -88;

    this.sound.startMusic();
    this.triggerStationBanner(ELEVATED_STATIONS[0], false);
    this.triggerVoiceOver('run_start');
    this.pushHud(true);
  }

  public returnToTitle(): void {
    this.hazards = [];
    this.tokens = [];
    this.powerUps = [];
    this.stations = [];
    this.portals = [];
    this.particles = [];
    this.mode = 'title';
    this.sound.stopMusic();
    this.sound.cancelSpeech();
    this.activeVoiceOver = null;
    this.voiceOverTimer = 0;
    this.player = createInitialPlayerKinematics();
    this.zone = 'elevated';
    this.weather = 'sunny';
    this.pushHud(true);
  }

  public pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.sound.stopMusic();
    this.pushHud(true);
  }

  public resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.lastTs = performance.now();
    this.sound.startMusic();
    this.pushHud(true);
  }

  public queueAction(action: RunnerAction): void {
    if (this.mode !== 'playing' || this.crashPending) return;
    queuePlayerAction(this.player, action);
  }

  public activateHoverboard(): void {
    if (this.mode !== 'playing' || this.crashPending) return;
    if (this.hoverboardTimer > 0 || this.hoverboardCooldown > 0) return;

    this.hoverboardDuration = getPowerUpDuration(this.profile, 'hoverboard');
    this.hoverboardTimer = this.hoverboardDuration;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.25);
    this.sound.playAutoHorn();
    this.spawnBurst(this.player.x, this.player.y + 0.4, 0, '#FFD60A', 16);
    this.showCallout('AUTO BOARD ON! PEE-PEE!', '#FFD60A');
    this.triggerVoiceOver('hoverboard');
    this.pushHud(true);
  }

  public activateHeadstart(): void {
    if (this.mode !== 'playing' || this.crashPending) return;
    if (this.headstartActive || this.runTime > HEADSTART_WINDOW) return;

    this.headstartActive = true;
    this.headstartTargetDist = this.distance + HEADSTART_DISTANCE;
    this.stumbleGraceTimer = Math.max(this.stumbleGraceTimer, 5.2);
    this.sound.playHeadstart();
    this.spawnBurst(this.player.x, this.player.y + 1.0, 0, '#FFD60A', 18);
    this.showCallout('NAMMA EXPRESS HEADSTART!', '#FFD60A');
    this.triggerVoiceOver('kaapi');
    this.pushHud(true);
  }

  private showCallout(text: string, color: string): void {
    this.callout = { id: this.calloutSeq++, text, color };
    this.calloutTimer = 1.2;
    this.pushHud(true);
  }

  private triggerVoiceOver(event: VoiceOverEvent): void {
    const phrase = pickVoiceOverPhrase(event, this.lastVoiceOverByEvent[event]);
    this.lastVoiceOverByEvent[event] = phrase.id;
    this.activeVoiceOver = { id: this.voiceOverSeq++, phrase };
    this.voiceOverTimer = 3.2;
    this.sound.playVoiceOver(phrase);
    this.pushHud(true);
  }

  private triggerStationBanner(station: MetroStation, announce: boolean): void {
    this.activeStationBanner = station;
    this.stationBannerTimer = 4.0;
    this.lastStationName = station.nameEn;
    if (announce) this.sound.playStationChime(station.nameEn);
    this.pushHud(true);
  }

  private spawnBurst(x: number, y: number, z: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 90) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.2 + Math.random() * 5.2;
      const life = 0.32 + Math.random() * 0.28;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + (Math.random() - 0.5) * 0.4,
        z,
        vx: Math.cos(angle) * spd,
        vy: 2.4 + Math.random() * 5.2,
        vz: Math.sin(angle) * spd,
        life,
        maxLife: life,
        color,
        size: 4 + Math.random() * 5,
      });
    }
  }

  private spawnTokenLine(
    lane: number,
    startZ: number,
    count: number,
    baseY: number,
    spacing = 3.2,
    arcPeak = 0,
  ): void {
    const x = LANE_POSITIONS[lane];
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const y = baseY + Math.sin(t * Math.PI) * arcPeak;
      this.tokens.push({ x, y, z: startZ - i * spacing, collected: false });
    }
  }

  private canSpawnInLane(lane: number, zStart: number, zEnd: number, isMoving: boolean): boolean {
    const newFront = Math.max(zStart, zEnd);
    const newBack = Math.min(zStart, zEnd);
    for (const h of this.hazards) {
      if (!h.active || h.lane !== lane) continue;
      const existingFront = Math.max(h.zStart, h.zEnd);
      const existingBack = Math.min(h.zStart, h.zEnd);
      if (newFront >= existingBack - 11 && newBack <= existingFront + 11) return false;
      if (isMoving && h.speedOffset === 0 && existingFront > newBack) return false;
      if (!isMoving && h.speedOffset > 0 && existingBack < newFront) return false;
    }
    return true;
  }

  private spawnTrain(lane: number, frontZ: number, moving: boolean, withRamp: boolean): void {
    const length = 18;
    const rampLen = withRamp ? 6.4 : 0;
    const zStart = frontZ + rampLen;
    const zEnd = frontZ - length;
    if (!this.canSpawnInLane(lane, zStart, zEnd, moving)) return;

    const line = Math.random() < 0.55 ? 'purple' : 'green';
    const kind: HazardKind = withRamp ? 'train_ramp' : moving ? 'train_moving' : 'train_static';
    this.hazards.push({
      id: this.nextEntityId++,
      kind,
      lane,
      zStart,
      zEnd,
      prevZStart: zStart,
      prevZEnd: zEnd,
      height: TRAIN_ROOF_Y,
      rampLength: rampLen,
      speedOffset: moving ? 10 + Math.min(10, this.distance * 0.005) : 0,
      active: true,
      line,
    });
  }

  private spawnBarrier(kind: 'barrier_jump' | 'gantry_low' | 'barricade_bbmp', lane: number, z: number): void {
    const zStart = z + 0.8;
    const zEnd = z - 0.8;
    if (!this.canSpawnInLane(lane, zStart, zEnd, false)) return;
    this.hazards.push({
      id: this.nextEntityId++,
      kind,
      lane,
      zStart,
      zEnd,
      prevZStart: zStart,
      prevZEnd: zEnd,
      height: kind === 'barrier_jump' ? 1.32 : kind === 'gantry_low' ? 3.5 : 4.2,
      clearanceBottomY: kind === 'gantry_low' ? 1.15 : 0,
      speedOffset: 0,
      active: true,
      line: 'purple',
    });
  }

  private spawnWave(baseZ: number): void {
    const roll = Math.random();
    const laneA = Math.floor(Math.random() * 3);
    const laneB = (laneA + 1) % 3;
    const laneC = (laneA + 2) % 3;

    if (roll < 0.28) {
      this.spawnTrain(laneA, baseZ, false, true);
      this.spawnTokenLine(laneA, baseZ - 1, 6, TRAIN_ROOF_Y + 0.9, 2.8);
      this.spawnTrain(laneB, baseZ - 14, Math.random() < 0.55, false);
      if (Math.random() < 0.65) this.spawnBarrier('barrier_jump', laneC, baseZ - 10);
      this.spawnTokenLine(laneC, baseZ - 2, 5, 1.05, 3.1, 1.7);
    } else if (roll < 0.52) {
      this.spawnBarrier('barrier_jump', laneA, baseZ);
      this.spawnBarrier('gantry_low', laneB, baseZ - 2);
      this.spawnTokenLine(laneA, baseZ + 4, 5, 1.05, 2.6, 2.0);
      this.spawnTokenLine(laneB, baseZ + 3, 5, 0.72, 2.7);
      if (Math.random() < 0.6) this.spawnTrain(laneC, baseZ - 18, true, false);
    } else if (roll < 0.74) {
      this.spawnTrain(laneA, baseZ, true, false);
      this.spawnTrain(laneC, baseZ - 8, false, true);
      this.spawnTokenLine(laneB, baseZ + 2, 7, 1.05, 3.1);
    } else if (roll < 0.89) {
      this.spawnBarrier('barricade_bbmp', laneA, baseZ - 4);
      this.spawnBarrier('gantry_low', laneC, baseZ - 6);
      this.spawnTokenLine(laneB, baseZ + 2, 6, 1.05, 3.0);
    } else {
      this.spawnTrain(laneA, baseZ, false, true);
      this.spawnTrain(laneB, baseZ - 2, false, false);
      this.spawnTokenLine(laneA, baseZ - 2, 5, TRAIN_ROOF_Y + 0.95, 2.8);
      this.spawnTokenLine(laneC, baseZ + 1, 6, 1.05, 3.0);
    }

    if (Math.random() < 0.34) {
      const types: PowerUpType[] = ['kaapi', 'magnet', 'drone', 'sneakers', 'multiplier', 'mystery_box'];
      const pType = types[Math.floor(Math.random() * types.length)];
      const pLane = Math.random() < 0.5 ? laneC : laneB;
      this.powerUps.push({ type: pType, lane: pLane, y: 1.55, z: baseZ - 16, collected: false });
    }
  }

  private activatePowerUp(type: PowerUpType): void {
    this.sound.playPowerUp();
    if (type === 'kaapi') {
      this.kaapiDuration = getPowerUpDuration(this.profile, 'kaapi');
      this.kaapiTimer = this.kaapiDuration;
      this.kaapiUsed++;
      this.cameraTrauma = 0.3;
      this.spawnBurst(this.player.x, this.player.y + 1.2, 0, '#F59E0B', 18);
      this.showCallout(SPEED_BOOST_QUIPS[this.kaapiUsed % SPEED_BOOST_QUIPS.length], '#F59E0B');
    } else if (type === 'magnet') {
      this.magnetDuration = getPowerUpDuration(this.profile, 'magnet');
      this.magnetTimer = this.magnetDuration;
      this.spawnBurst(this.player.x, this.player.y + 1.2, 0, '#EAB308', 16);
      this.showCallout('UPI COIN MAGNET!', '#EAB308');
    } else if (type === 'drone') {
      this.droneDuration = getPowerUpDuration(this.profile, 'drone');
      this.droneTimer = this.droneDuration;
      this.player.droneActive = true;
      this.spawnBurst(this.player.x, this.player.y + 1.5, 0, '#00F5D4', 18);
      this.showCallout('BENGALURU TECH DRONE!', '#00F5D4');
      this.spawnTokenLine(1, -22, 10, DRONE_FLIGHT_Y + 0.8, 3.4, 1.0);
    } else if (type === 'sneakers') {
      this.sneakersDuration = getPowerUpDuration(this.profile, 'sneakers');
      this.sneakersTimer = this.sneakersDuration;
      this.player.sneakersActive = true;
      this.spawnBurst(this.player.x, this.player.y + 0.8, 0, '#2DC653', 16);
      this.showCallout('SUPER SNEAKERS!', '#2DC653');
    } else if (type === 'multiplier') {
      this.multiplierDuration = getPowerUpDuration(this.profile, 'multiplier');
      this.multiplierTimer = this.multiplierDuration;
      this.spawnBurst(this.player.x, this.player.y + 1.2, 0, '#FFD60A', 16);
      this.showCallout('2X SCORE MULTIPLIER!', '#FFD60A');
    } else {
      this.sound.playMysteryBox();
      this.mysteryBoxes++;
      this.mysteryBonusTokens += 65;
      this.mysteryRewardLabel = '+65 Bonus Metro Tokens!';
      this.spawnBurst(this.player.x, this.player.y + 1.2, 0, '#C084FC', 18);
      this.showCallout('MYSTERY BOX: +65 TOKENS!', '#C084FC');
    }
    this.triggerVoiceOver(type);
    this.pushHud(true);
  }

  private triggerCrash(): void {
    this.crashPending = true;
    this.crashDelayTimer = 0.55;
    this.hitstopTimer = 0.07;
    this.cameraTrauma = 0.95;
    this.sound.stopMusic();
    this.sound.playCrash();
    this.spawnBurst(this.player.x, this.player.y + 1.1, 0, '#FF4D8D', 20);
    this.spawnBurst(this.player.x, this.player.y + 1.1, 0, '#FFD60A', 12);
  }

  private finalizeGameOver(): void {
    this.crashPending = false;
    this.mode = 'gameover';
    this.gameOverQuip = GAME_OVER_QUIPS[Math.floor(Math.random() * GAME_OVER_QUIPS.length)];
    const summary: RunSummary = {
      score: Math.round(this.score),
      distance: Math.round(this.distance),
      tokensCollected: this.runTokens,
      stationsPassed: this.stationsPassed,
      kaapiUsed: this.kaapiUsed,
      closeCalls: this.closeCalls,
      mysteryBoxes: this.mysteryBoxes > 0 ? this.mysteryBoxes : undefined,
      mysteryBonusTokens: this.mysteryBonusTokens > 0 ? this.mysteryBonusTokens : undefined,
      mysteryRewardLabel: this.mysteryRewardLabel || undefined,
    };
    this.runSummary = summary;
    this.onRunEnd(summary);
    this.pushHud(true);
  }

  private stepSimulation(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    if (this.mode === 'title') {
      if (this.lobbyHopTimer > 0) this.lobbyHopTimer = Math.max(0, this.lobbyHopTimer - dt);
      return;
    }
    if (this.mode === 'paused' || this.mode === 'gameover') return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.stepParticles(dt);
      return;
    }

    if (this.crashPending) {
      this.crashDelayTimer -= dt;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.5);
      this.stepParticles(dt);
      if (this.crashDelayTimer <= 0) this.finalizeGameOver();
      return;
    }

    this.runTime += dt;
    if (this.kaapiTimer > 0) {
      this.kaapiTimer = Math.max(0, this.kaapiTimer - dt);
      if (Math.random() < 0.5) this.spawnBurst(this.player.x, this.player.y + 0.9, 0.4, '#F59E0B', 1);
    }
    if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    if (this.sneakersTimer > 0) {
      this.sneakersTimer = Math.max(0, this.sneakersTimer - dt);
      this.player.sneakersActive = this.sneakersTimer > 0;
    } else {
      this.player.sneakersActive = false;
    }
    if (this.multiplierTimer > 0) this.multiplierTimer = Math.max(0, this.multiplierTimer - dt);
    if (this.droneTimer > 0) {
      this.droneTimer = Math.max(0, this.droneTimer - dt);
      this.player.droneActive = this.droneTimer > 0;
    } else {
      this.player.droneActive = false;
    }
    if (this.headstartActive && this.distance >= this.headstartTargetDist) {
      this.headstartActive = false;
      this.stumbleGraceTimer = Math.max(this.stumbleGraceTimer, 1.2);
    }

    if (this.hoverboardTimer > 0) {
      this.hoverboardTimer = Math.max(0, this.hoverboardTimer - dt);
      if (this.hoverboardTimer <= 0) {
        this.hoverboardCooldown = Math.max(
          6,
          HOVERBOARD_COOLDOWN - ((this.profile.upgrades.hoverboard ?? 1) - 1) * 1.4,
        );
      }
    } else if (this.hoverboardCooldown > 0) {
      this.hoverboardCooldown = Math.max(0, this.hoverboardCooldown - dt);
    }

    if (this.chaserTimer > 0) this.chaserTimer = Math.max(0, this.chaserTimer - dt);
    if (this.stumbleGraceTimer > 0) this.stumbleGraceTimer = Math.max(0, this.stumbleGraceTimer - dt);
    if (this.stationBannerTimer > 0) this.stationBannerTimer = Math.max(0, this.stationBannerTimer - dt);
    if (this.calloutTimer > 0) {
      this.calloutTimer = Math.max(0, this.calloutTimer - dt);
      if (this.calloutTimer <= 0) this.callout = null;
    }
    if (this.voiceOverTimer > 0) {
      this.voiceOverTimer = Math.max(0, this.voiceOverTimer - dt);
      if (this.voiceOverTimer <= 0) this.activeVoiceOver = null;
    }
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.8);

    const speed = getRunSpeed(this.distance, this.kaapiTimer > 0, this.headstartActive);
    const dz = speed * dt;
    this.trackScroll += dz;
    this.distance += dz * 0.55;
    const baseMult = getEffectiveMultiplier(this.profile);
    const mult = this.multiplierTimer > 0 ? baseMult * 2 : baseMult;
    this.score += dz * mult * (this.kaapiTimer > 0 || this.headstartActive ? 1.8 : 1.0);

    if (this.distance >= this.nextStationDist) {
      const list = this.spawnedZone === 'elevated' ? ELEVATED_STATIONS : UNDERGROUND_STATIONS;
      const idx = this.spawnedZone === 'elevated' ? ++this.elevatedIdx : ++this.undergroundIdx;
      const station = list[idx % list.length];
      this.stations.push({ station, z: -125, announced: false });
      this.nextStationDist += 225;
    }

    if (this.distance >= this.nextZoneDist) {
      const targetZone: ZoneMode = this.spawnedZone === 'elevated' ? 'underground' : 'elevated';
      this.spawnedZone = targetZone;
      this.portals.push({ z: -135, targetZone, passed: false });
      this.nextZoneDist += 720;
    }

    this.nextWaveZ += dz;
    if (this.nextWaveZ >= -118) {
      this.spawnWave(-145);
      this.nextWaveZ = -145 - Math.max(26, 36 - this.distance * 0.004);
    }

    const supports: SupportBox[] = [];
    for (const h of this.hazards) {
      if (!h.active) continue;
      h.prevZStart = h.zStart;
      h.prevZEnd = h.zEnd;
      const moveZ = dz + h.speedOffset * dt;
      h.zStart += moveZ;
      h.zEnd += moveZ;
      if (h.kind.startsWith('train')) {
        const rampLen = h.rampLength ?? 0;
        const bodyFrontZ = h.kind === 'train_ramp' ? h.zStart - rampLen : h.zStart;
        supports.push({
          lane: h.lane,
          zStart: bodyFrontZ,
          zEnd: h.zEnd,
          topY: h.height,
          isRamp: h.kind === 'train_ramp',
          rampStartZ: h.zStart,
          rampEndZ: bodyFrontZ,
        });
      }
    }

    const events = stepPlayerPhysics(this.player, dt, supports, this.weather);
    if (events.switchedLane) {
      this.sound.playWhoosh(1.1);
      if (this.weather === 'heavy_monsoon' && this.player.grounded) {
        this.spawnBurst(this.player.x, this.player.y + 0.14, 0, '#93C5FD', 7);
      }
    }
    if (events.jumped) this.sound.playJump();
    if (events.rolled) this.sound.playRoll();

    for (let i = this.stations.length - 1; i >= 0; i--) {
      const s = this.stations[i];
      s.z += dz;
      if (!s.announced && s.z > -52) {
        s.announced = true;
        this.stationsPassed++;
        this.triggerStationBanner(s.station, true);
      }
      if (s.z > 28) this.stations.splice(i, 1);
    }

    for (let i = this.portals.length - 1; i >= 0; i--) {
      const pt = this.portals[i];
      pt.z += dz;
      if (!pt.passed && pt.z > 0) {
        pt.passed = true;
        this.zone = pt.targetZone;
        this.sound.setUnderground(this.zone === 'underground');
        this.showCallout(
          this.zone === 'underground' ? 'UNDERGROUND TUNNEL!' : 'ELEVATED VIADUCT!',
          this.zone === 'underground' ? '#A855F7' : '#2DC653',
        );
      }
      if (pt.z > 24) this.portals.splice(i, 1);
    }

    const invincible = this.kaapiTimer > 0 || this.droneTimer > 0;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (h.active) {
        const res = evaluateHazardInteraction(
          {
            playerX: this.player.x,
            playerY: this.player.y,
            playerRolling: this.player.rolling,
            invincible: invincible || this.stumbleGraceTimer > 0,
            hoverboardActive: this.hoverboardTimer > 0,
            chaserClose: this.chaserTimer > 0,
          },
          h,
        );
        if (res === 'crash') {
          this.triggerCrash();
          return;
        } else if (res === 'shield_break') {
          this.hoverboardTimer = 0;
          this.hoverboardCooldown = Math.max(
            6,
            HOVERBOARD_COOLDOWN - ((this.profile.upgrades.hoverboard ?? 1) - 1) * 1.4,
          );
          this.stumbleGraceTimer = 1.05;
          this.hitstopTimer = 0.055;
          this.cameraTrauma = 0.72;
          this.sound.playAutoHorn();
          this.spawnBurst(this.player.x, this.player.y + 1, 0, '#00F5D4', 18);
          this.showCallout('AUTO SHIELD SAVED YOU!', '#00F5D4');
          for (const oh of this.hazards) {
            if (oh.active && oh.zStart > -20 && oh.zEnd < 10) oh.active = false;
          }
        } else if (res === 'stumble') {
          if (this.chaserTimer > 0) {
            this.triggerCrash();
            return;
          }
          this.chaserTimer = STUMBLE_CHASE_WINDOW;
          this.stumbleGraceTimer = 0.28;
          const isTrain = h.kind.startsWith('train');
          if (isTrain) {
            const trainX = LANE_POSITIONS[h.lane];
            const pushDir =
              this.player.x < trainX
                ? -1
                : this.player.x > trainX
                  ? 1
                  : h.lane > 0
                    ? -1
                    : 1;
            const bounceLane = Math.max(0, Math.min(2, h.lane + pushDir));
            this.player.lane = bounceLane;
            this.player.lastSafeLane = bounceLane;
            this.player.x = pushDir < 0 ? Math.min(this.player.x, trainX - 1.85) : Math.max(this.player.x, trainX + 1.85);
          } else {
            h.active = false;
          }
          this.cameraTrauma = 0.55;
          this.sound.playStumble();
          this.showCallout('SWALPA WATCH OUT!', '#EF4444');
        } else if (res === 'close_call') {
          h.closeCallTriggered = true;
          this.closeCalls++;
          this.score += 120 * mult;
          this.sound.playCloseCall();
          this.showCallout(CLOSE_CALL_QUIPS[this.closeCalls % CLOSE_CALL_QUIPS.length], '#FFD60A');
        }
      }

      if (!h.active || h.zEnd > 22) {
        this.hazards.splice(i, 1);
      }
    }

    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const tk = this.tokens[i];
      tk.z += dz;
      if (this.magnetTimer > 0 && tk.z > -20 && tk.z < 6) {
        tk.x += (this.player.x - tk.x) * Math.min(1, dt * 15);
        tk.y += (this.player.y + 1.0 - tk.y) * Math.min(1, dt * 15);
        tk.z += (0 - tk.z) * Math.min(1, dt * 8);
      }
      if (
        !tk.collected &&
        Math.abs(tk.x - this.player.x) < 1.15 &&
        Math.abs(tk.y - (this.player.y + 0.95)) < 1.65 &&
        Math.abs(tk.z) < 1.35
      ) {
        tk.collected = true;
        this.runTokens++;
        this.score += 25 * mult;
        this.sound.playToken();
        this.spawnBurst(tk.x, tk.y, tk.z, '#FFD60A', 5);
        this.tokens.splice(i, 1);
        continue;
      }
      if (tk.z > 16) this.tokens.splice(i, 1);
    }

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.z += dz;
      if (
        !pu.collected &&
        Math.abs(LANE_POSITIONS[pu.lane] - this.player.x) < 1.25 &&
        Math.abs(pu.y - (this.player.y + 1.0)) < 1.75 &&
        Math.abs(pu.z) < 1.5
      ) {
        pu.collected = true;
        this.activatePowerUp(pu.type);
        this.powerUps.splice(i, 1);
        continue;
      }
      if (pu.z > 16) this.powerUps.splice(i, 1);
    }

    const nextWeather =
      this.zone === 'underground'
        ? 'sunny'
        : this.weatherOverride ?? getWeatherForDistance(this.distance, this.zone);
    if (nextWeather !== this.weather) {
      this.weather = nextWeather;
      if (nextWeather === 'heavy_monsoon') {
        this.showCallout('HEAVY MONSOON! SLIPPERY TRACK!', '#38BDF8');
      } else if (nextWeather === 'light_rain') {
        this.showCallout('LIGHT RAIN · ಸಣ್ಣ ಮಳೆ', '#93C5FD');
      } else {
        this.showCallout('SUNNY SKIES · ಬಿಸಿಲು', '#FFD60A');
      }
      this.pushHud(true);
    }
    if (this.weather === 'heavy_monsoon' && this.player.grounded && Math.random() < 0.35) {
      this.spawnBurst(this.player.x, this.player.y + 0.08, 0.2, '#BAE6FD', 1);
    }
    this.stepParticles(dt);

    if (this.elapsed - this.lastHudPush >= 0.1) this.pushHud(false);
  }

  private stepParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 18 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  }

  // --- Perspective 2.5D Projection ---
  private project(wx: number, wy: number, wz: number): ProjectedPoint | null {
    const portrait = this.height > this.width;
    const camX = this.mode === 'title' ? 0 : this.player.x * 0.42;
    const camY = (this.mode === 'title' ? 3.5 : 5.2 + this.player.y * 0.55) + (portrait ? 0.6 : 0);
    const camZ = this.mode === 'title' ? 8.2 : portrait ? 10.6 : 9.4;

    const shake = this.cameraTrauma * this.cameraTrauma;
    const shakeX = shake > 0.001 ? Math.sin(this.elapsed * 55) * shake * 0.35 : 0;
    const shakeY = shake > 0.001 ? Math.cos(this.elapsed * 49) * shake * 0.25 : 0;

    const depth = camZ - wz;
    if (depth < 0.7) return null;

    const focal = Math.min(this.width, this.height) * (portrait ? 1.02 : 0.92);
    const scale = focal / depth;
    const horizonY = this.height * (portrait ? 0.41 : 0.43);

    const sx = this.width * 0.5 + (wx - camX + shakeX) * scale;
    const sy = horizonY - (wy - camY + shakeY) * scale;
    return { sx, sy, scale };
  }

  private renderFrame(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const horizonY = h * (h > w ? 0.41 : 0.43);

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 1. Sky / Underground Backdrop
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (this.zone === 'underground') {
      skyGrad.addColorStop(0, '#0D081A');
      skyGrad.addColorStop(0.45, '#1D1135');
      skyGrad.addColorStop(1, '#120B21');
    } else if (this.weather === 'heavy_monsoon') {
      skyGrad.addColorStop(0, '#1E293B');
      skyGrad.addColorStop(0.42, '#475569');
      skyGrad.addColorStop(0.46, '#1B4332');
      skyGrad.addColorStop(1, '#0F291E');
    } else if (this.weather === 'light_rain') {
      skyGrad.addColorStop(0, '#5B7C9E');
      skyGrad.addColorStop(0.42, '#9CB8D4');
      skyGrad.addColorStop(0.46, '#266340');
      skyGrad.addColorStop(1, '#1A472D');
    } else {
      skyGrad.addColorStop(0, '#38BDF8');
      skyGrad.addColorStop(0.42, '#93E2FE');
      skyGrad.addColorStop(0.45, '#2E7D4E');
      skyGrad.addColorStop(1, '#1F5A38');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Distant Bengaluru Skyline & Clouds (Elevated Zone)
    if (this.zone === 'elevated') {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      const cloudShift = (this.elapsed * 14) % (w + 260);
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 340 + cloudShift) % (w + 260)) - 130;
        const cy = 62 + (i % 2) * 38;
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.arc(cx + 22, cy - 8, 28, 0, Math.PI * 2);
        ctx.arc(cx + 46, cy, 22, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stylized Skyline Silhouettes
      const bldgs = [
        { x: 0.06, bw: 0.08, bh: 115, c: '#1E3A5F' },
        { x: 0.16, bw: 0.07, bh: 85, c: '#294870' },
        { x: 0.77, bw: 0.08, bh: 105, c: '#1E3A5F' },
        { x: 0.87, bw: 0.09, bh: 130, c: '#162C4A' },
      ];
      for (const b of bldgs) {
        const bx = b.x * w;
        const bw = b.bw * w;
        const by = horizonY - b.bh + 14;
        ctx.fillStyle = b.c;
        ctx.fillRect(bx, by, bw, b.bh);
        ctx.fillStyle = '#BAE6FD';
        for (let wy = by + 10; wy < horizonY; wy += 16) {
          for (let wx = bx + 6; wx < bx + bw - 8; wx += 12) {
            ctx.fillRect(wx, wy, 6, 8);
          }
        }
      }
    }

    // 2. Viaduct Deck & Karnataka Yellow-Red-Purple Guardrails
    this.drawViaduct(ctx);

    // 3. Roadside Scenery: Tabebuia Trees, Karnataka Flags, Giant Billboards & Overhead Arches
    this.drawRoadsideAndArches(ctx);

    // 4. Depth-Sorted Dynamic World Objects (Hazards, Tokens, PowerUps, Runner, Chaser)
    const drawables: Array<{ z: number; draw: () => void }> = [];

    for (const hObj of this.hazards) {
      if (!hObj.active) continue;
      if (hObj.zEnd > 14 || hObj.zStart < -135) continue;
      const sortZ = (hObj.zStart + hObj.zEnd) * 0.5;
      drawables.push({
        z: sortZ,
        draw: () => this.drawHazard(ctx, hObj),
      });
    }

    for (const tk of this.tokens) {
      if (tk.collected || tk.z > 12 || tk.z < -125) continue;
      drawables.push({
        z: tk.z,
        draw: () => this.drawToken(ctx, tk),
      });
    }

    for (const pu of this.powerUps) {
      if (pu.collected || pu.z > 12 || pu.z < -125) continue;
      drawables.push({
        z: pu.z,
        draw: () => this.drawPowerUp(ctx, pu),
      });
    }

    // Lobby showcase Metro train in background on title screen
    if (this.mode === 'title') {
      drawables.push({
        z: -34,
        draw: () =>
          this.drawTrain(ctx, {
            id: 0,
            kind: 'train_static',
            lane: 0,
            zStart: -24,
            zEnd: -44,
            prevZStart: -24,
            prevZEnd: -44,
            height: TRAIN_ROOF_Y,
            rampLength: 0,
            speedOffset: 0,
            active: true,
            line: 'purple',
          }),
      });
    }

    // Runner & Chaser
    drawables.push({
      z: 0,
      draw: () => this.drawRunner(ctx),
    });

    if (this.mode !== 'title' && this.chaserTimer > 0) {
      const chaserZ = 2.6 + (1 - Math.min(1, this.chaserTimer / STUMBLE_CHASE_WINDOW)) * 2.2;
      drawables.push({
        z: chaserZ,
        draw: () => this.drawChaser(ctx, chaserZ),
      });
    }

    // Painter's algorithm: far (-135) to near (+10)
    drawables.sort((a, b) => a.z - b.z);
    for (const d of drawables) d.draw();

    // 5. Burst Particles & Weather
    this.drawParticles(ctx);
    if (this.zone === 'elevated' && (this.weather === 'light_rain' || this.weather === 'heavy_monsoon')) {
      this.drawWeatherOverlay(ctx);
    }

    ctx.restore();
  }

  private drawViaduct(ctx: CanvasRenderingContext2D): void {
    const camZ = this.mode === 'title' ? 8.2 : this.height > this.width ? 10.6 : 9.4;
    const nearZ = camZ - 1.4;
    const farZ = -130;

    const fl = this.project(-5.8, 0, farZ);
    const fr = this.project(5.8, 0, farZ);
    const nl = this.project(-5.8, 0, nearZ);
    const nr = this.project(5.8, 0, nearZ);
    if (!fl || !fr || !nl || !nr) return;

    // Viaduct concrete deck
    ctx.fillStyle = this.zone === 'underground' ? '#252038' : '#475569';
    ctx.beginPath();
    ctx.moveTo(fl.sx, fl.sy);
    ctx.lineTo(fr.sx, fr.sy);
    ctx.lineTo(nr.sx, nr.sy);
    ctx.lineTo(nl.sx, nl.sy);
    ctx.closePath();
    ctx.fill();

    // Scrolling concrete sleepers
    const sleeperStep = 4;
    const offset = this.trackScroll % sleeperStep;
    ctx.strokeStyle = this.zone === 'underground' ? 'rgba(168,85,247,0.22)' : 'rgba(226,232,240,0.42)';
    for (let z = nearZ; z > farZ; z -= sleeperStep) {
      const zz = z + offset;
      const pL = this.project(-5.2, 0.02, zz);
      const pR = this.project(5.2, 0.02, zz);
      if (!pL || !pR) continue;
      ctx.lineWidth = Math.max(1, pL.scale * 0.14);
      ctx.beginPath();
      ctx.moveTo(pL.sx, pL.sy);
      ctx.lineTo(pR.sx, pR.sy);
      ctx.stroke();
    }

    // 3 Metro Lane Rails + Karnataka Yellow Dividers
    for (const lx of LANE_POSITIONS) {
      for (const railOff of [-0.75, 0.75]) {
        const pFar = this.project(lx + railOff, 0.04, farZ);
        const pNear = this.project(lx + railOff, 0.04, nearZ);
        if (!pFar || !pNear) continue;
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = Math.max(1.2, pNear.scale * 0.08);
        ctx.beginPath();
        ctx.moveTo(pFar.sx, pFar.sy);
        ctx.lineTo(pNear.sx, pNear.sy);
        ctx.stroke();
      }
    }

    for (const divX of [-1.7, 1.7]) {
      const pFar = this.project(divX, 0.04, farZ);
      const pNear = this.project(divX, 0.04, nearZ);
      if (!pFar || !pNear) continue;
      ctx.strokeStyle = '#FFD60A';
      ctx.lineWidth = Math.max(1.5, pNear.scale * 0.07);
      ctx.beginPath();
      ctx.moveTo(pFar.sx, pFar.sy);
      ctx.lineTo(pNear.sx, pNear.sy);
      ctx.stroke();
    }

    // Karnataka Flag Colored Side Guardrails (Yellow, Crimson Red, Metro Purple)
    for (const side of [-1, 1]) {
      const gx = side * 5.85;
      const stripes = [
        { y0: 0, y1: 0.45, color: '#CBD5E1' },
        { y0: 0.45, y1: 0.65, color: '#7B2CBF' },
        { y0: 0.65, y1: 0.85, color: '#DC2626' },
        { y0: 0.85, y1: 1.05, color: '#FFD60A' },
      ];
      for (const st of stripes) {
        const f0 = this.project(gx, st.y0, farZ);
        const f1 = this.project(gx, st.y1, farZ);
        const n0 = this.project(gx, st.y0, nearZ);
        const n1 = this.project(gx, st.y1, nearZ);
        if (!f0 || !f1 || !n0 || !n1) continue;
        ctx.fillStyle = st.color;
        ctx.beginPath();
        ctx.moveTo(f0.sx, f0.sy);
        ctx.lineTo(f1.sx, f1.sy);
        ctx.lineTo(n1.sx, n1.sy);
        ctx.lineTo(n0.sx, n0.sy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private drawRoadsideAndArches(ctx: CanvasRenderingContext2D): void {
    const segLen = 40;
    const baseIdx = Math.floor(this.trackScroll / segLen);
    const localOffset = this.trackScroll % segLen;

    for (let step = 3; step >= 0; step--) {
      const z = -12 - step * segLen + localOffset;
      if (z > 6 || z < -130) continue;
      const worldIdx = baseIdx + step;

      if (this.zone === 'elevated') {
        // Pink Tabebuia Blossom Trees on both sides
        for (const side of [-1, 1]) {
          const p = this.project(side * 9.5, 0, z);
          if (p) {
            const r = p.scale * 1.9;
            ctx.fillStyle = '#6D4C41';
            ctx.fillRect(p.sx - p.scale * 0.25, p.sy - r * 1.4, p.scale * 0.5, r * 1.5);
            ctx.fillStyle = '#FF99C8';
            ctx.beginPath();
            ctx.arc(p.sx, p.sy - r * 1.6, r, 0, Math.PI * 2);
            ctx.arc(p.sx - r * 0.65, p.sy - r * 1.3, r * 0.72, 0, Math.PI * 2);
            ctx.arc(p.sx + r * 0.65, p.sy - r * 1.3, r * 0.72, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Karnataka Yellow-Red Flags along viaduct rail
        for (const side of [-1, 1]) {
          const pTop = this.project(side * 5.9, 3.3, z);
          const pBase = this.project(side * 5.9, 0.9, z);
          if (pTop && pBase) {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = Math.max(1.5, pTop.scale * 0.08);
            ctx.beginPath();
            ctx.moveTo(pBase.sx, pBase.sy);
            ctx.lineTo(pTop.sx, pTop.sy);
            ctx.stroke();

            const fw = pTop.scale * 1.45;
            const fh = pTop.scale * 0.86;
            const fx = side > 0 ? pTop.sx : pTop.sx - fw;
            ctx.fillStyle = '#FFD60A';
            ctx.fillRect(fx, pTop.sy, fw, fh * 0.5);
            ctx.fillStyle = '#DC2626';
            ctx.fillRect(fx, pTop.sy + fh * 0.5, fw, fh * 0.5);
            ctx.strokeStyle = '#1A1423';
            ctx.lineWidth = 1;
            ctx.strokeRect(fx, pTop.sy, fw, fh);
          }
        }

        // Giant Peak Bengaluru Roadside Billboard
        const ad = BILLBOARDS[Math.abs(worldIdx) % BILLBOARDS.length];
        const bSide = worldIdx % 2 === 0 ? -1 : 1;
        const bp = this.project(bSide * 10.6, 5.6, z - 6);
        const bpBase = this.project(bSide * 10.6, 0, z - 6);
        if (bp && bpBase && bp.scale > 5) {
          const bw = bp.scale * 8.4;
          const bh = bp.scale * 4.1;
          const bx = bp.sx - bw * 0.5;
          const by = bp.sy - bh * 0.5;

          // Twin steel pillars cleanly beneath board
          ctx.fillStyle = '#334155';
          const pw = Math.max(2, bp.scale * 0.32);
          ctx.fillRect(bx + bw * 0.22, by + bh, pw, Math.max(8, bpBase.sy - (by + bh) + 20));
          ctx.fillRect(bx + bw * 0.74, by + bh, pw, Math.max(8, bpBase.sy - (by + bh) + 20));

          // Poster face
          ctx.fillStyle = ad.bg;
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeStyle = '#1A1423';
          ctx.lineWidth = Math.max(2, bp.scale * 0.16);
          ctx.strokeRect(bx, by, bw, bh);

          ctx.fillStyle = ad.stripe;
          ctx.fillRect(bx + 2, by + 2, bw - 4, Math.max(3, bh * 0.1));
          ctx.fillStyle = ad.accent;
          ctx.fillRect(bx + 2, by + bh - Math.max(3, bh * 0.1) - 2, bw - 4, Math.max(3, bh * 0.1));

          if (bw > 70) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `900 ${Math.max(9, Math.floor(bh * 0.22))}px Fredoka, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ad.headline, bp.sx, by + bh * 0.44, bw - 14);

            ctx.fillStyle = ad.accent;
            ctx.font = `700 ${Math.max(8, Math.floor(bh * 0.16))}px "Noto Sans Kannada", sans-serif`;
            ctx.fillText(ad.sub, bp.sx, by + bh * 0.72, bw - 14);
          }
        }
      }

      // Overhead Karnataka Welcome Arch (every second segment)
      if (worldIdx % 2 === 1) {
        const archZ = z - 18;
        const pL = this.project(-6.2, 0, archZ);
        const pR = this.project(6.2, 0, archZ);
        const pTopL = this.project(-6.2, 8.2, archZ);
        const pTopR = this.project(6.2, 8.2, archZ);
        if (pL && pR && pTopL && pTopR && pTopL.scale > 4) {
          const postW = Math.max(3, pTopL.scale * 0.55);
          ctx.fillStyle = '#DC2626';
          ctx.fillRect(pTopL.sx - postW * 0.5, pTopL.sy, postW, pL.sy - pTopL.sy);
          ctx.fillRect(pTopR.sx - postW * 0.5, pTopR.sy, postW, pR.sy - pTopR.sy);

          const signW = pTopR.sx - pTopL.sx + postW * 2;
          const signH = pTopL.scale * 3.1;
          const sx = pTopL.sx - postW;
          const sy = pTopL.sy - signH;

          // Karnataka Yellow over Crimson Red overhead welcome arch
          ctx.fillStyle = '#FFD60A';
          ctx.fillRect(sx, sy, signW, signH * 0.5);
          ctx.fillStyle = '#DC2626';
          ctx.fillRect(sx, sy + signH * 0.5, signW, signH * 0.5);
          ctx.strokeStyle = '#1A1423';
          ctx.lineWidth = Math.max(2, pTopL.scale * 0.12);
          ctx.strokeRect(sx, sy, signW, signH);

          if (signW > 85) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#1A1423';
            ctx.font = `900 ${Math.max(10, Math.floor(signH * 0.28))}px "Noto Sans Kannada", Fredoka, sans-serif`;
            ctx.fillText('ಸಿರಿಗನ್ನಡಂ ಗೆಲ್ಗೆ • ನಮ್ಮ ಬೆಂಗಳೂರು', sx + signW * 0.5, sy + signH * 0.27, signW - 16);

            ctx.fillStyle = '#FFD60A';
            ctx.font = `900 ${Math.max(9, Math.floor(signH * 0.24))}px Fredoka, sans-serif`;
            ctx.fillText('NAMMA METRO • JAI KARNATAKA!', sx + signW * 0.5, sy + signH * 0.75, signW - 16);
          }
        }
      }
    }
  }

  private drawHazard(ctx: CanvasRenderingContext2D, h: Hazard2D): void {
    if (h.kind.startsWith('train')) {
      this.drawTrain(ctx, h);
      return;
    }

    const x = LANE_POSITIONS[h.lane];
    const z = (h.zStart + h.zEnd) * 0.5;
    const pBase = this.project(x, 0, z);
    const pTop = this.project(x, h.height, z);
    if (!pBase || !pTop) return;

    const bw = pBase.scale * 2.5;
    const bh = pBase.sy - pTop.sy;

    if (h.kind === 'barrier_jump') {
      // Yellow/Black BBMP Metro Work Barrier
      ctx.fillStyle = '#FFD60A';
      ctx.fillRect(pBase.sx - bw * 0.5, pTop.sy, bw, bh);
      ctx.fillStyle = '#1A1423';
      ctx.fillRect(pBase.sx - bw * 0.5, pTop.sy + bh * 0.35, bw, bh * 0.25);
      ctx.strokeStyle = '#1A1423';
      ctx.lineWidth = Math.max(1.5, pBase.scale * 0.08);
      ctx.strokeRect(pBase.sx - bw * 0.5, pTop.sy, bw, bh);
    } else if (h.kind === 'gantry_low') {
      // Overhead "MIND THE GAP" Arch — roll underneath!
      const pClear = this.project(x, h.clearanceBottomY ?? 1.15, z);
      if (!pClear) return;
      const postW = Math.max(2, pBase.scale * 0.22);
      ctx.fillStyle = '#334155';
      ctx.fillRect(pBase.sx - bw * 0.5, pTop.sy, postW, pBase.sy - pTop.sy);
      ctx.fillRect(pBase.sx + bw * 0.5 - postW, pTop.sy, postW, pBase.sy - pTop.sy);

      const boardH = pClear.sy - pTop.sy;
      ctx.fillStyle = '#1A1423';
      ctx.fillRect(pBase.sx - bw * 0.5, pTop.sy, bw, boardH);
      ctx.fillStyle = '#FFD60A';
      ctx.fillRect(pBase.sx - bw * 0.5, pTop.sy, bw, Math.max(2, boardH * 0.18));
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(pBase.sx - bw * 0.5, pTop.sy + Math.max(2, boardH * 0.18), bw, Math.max(2, boardH * 0.14));
      if (bw > 48) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `900 ${Math.max(8, Math.floor(boardH * 0.28))}px Fredoka, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ROLL! ಬಗ್ಗಿ', pBase.sx, pTop.sy + boardH * 0.65, bw - 8);
      }
    } else {
      // Concrete Metro Pillar / BBMP Barricade
      const pw = pBase.scale * 1.4;
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(pBase.sx - pw * 0.5, pTop.sy, pw, bh);
      ctx.fillStyle = '#FFD60A';
      ctx.fillRect(pBase.sx - pw * 0.5, pBase.sy - bh * 0.35, pw, bh * 0.12);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(pBase.sx - pw * 0.5, pBase.sy - bh * 0.23, pw, bh * 0.12);
      ctx.strokeStyle = '#1A1423';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pBase.sx - pw * 0.5, pTop.sy, pw, bh);
    }
  }

  private drawTrain(ctx: CanvasRenderingContext2D, h: Hazard2D): void {
    const x = LANE_POSITIONS[h.lane];
    const bodyFrontZ = h.kind === 'train_ramp' ? h.zStart - (h.rampLength ?? 0) : h.zStart;
    const bodyBackZ = h.zEnd;

    const fBL = this.project(x - 1.32, 0, bodyFrontZ);
    const fBR = this.project(x + 1.32, 0, bodyFrontZ);
    const fTL = this.project(x - 1.32, h.height, bodyFrontZ);
    const fTR = this.project(x + 1.32, h.height, bodyFrontZ);

    const bBL = this.project(x - 1.32, 0, bodyBackZ);
    const bBR = this.project(x + 1.32, 0, bodyBackZ);
    const bTL = this.project(x - 1.32, h.height, bodyBackZ);
    const bTR = this.project(x + 1.32, h.height, bodyBackZ);

    if (!fBL || !fBR || !fTL || !fTR) return;
    const stripeHex = h.line === 'green' ? '#2DC653' : '#7B2CBF';

    // Roof + Side perspective panels when back end is visible
    if (bTL && bTR && bBL && bBR) {
      // Roof
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(bTL.sx, bTL.sy);
      ctx.lineTo(bTR.sx, bTR.sy);
      ctx.lineTo(fTR.sx, fTR.sy);
      ctx.lineTo(fTL.sx, fTL.sy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Left or Right visible side wall
      if (fTL.sx > bTL.sx) {
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.moveTo(bTL.sx, bTL.sy);
        ctx.lineTo(fTL.sx, fTL.sy);
        ctx.lineTo(fBL.sx, fBL.sy);
        ctx.lineTo(bBL.sx, bBL.sy);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.moveTo(bTR.sx, bTR.sy);
        ctx.lineTo(fTR.sx, fTR.sy);
        ctx.lineTo(fBR.sx, fBR.sy);
        ctx.lineTo(bBR.sx, bBR.sy);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Train Front Face (Namma Metro + Karnataka Flag Trim)
    const fw = fBR.sx - fBL.sx;
    const fh = fBL.sy - fTL.sy;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(fTL.sx, fTL.sy, fw, fh);

    // Karnataka Yellow-Red brow strip
    ctx.fillStyle = '#FFD60A';
    ctx.fillRect(fTL.sx, fTL.sy, fw, Math.max(2, fh * 0.05));
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(fTL.sx, fTL.sy + Math.max(2, fh * 0.05), fw, Math.max(2, fh * 0.05));

    // Dark cab windshield
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(fTL.sx + fw * 0.1, fTL.sy + fh * 0.14, fw * 0.8, fh * 0.42);
    // Destination LED bar
    ctx.fillStyle = '#FFD60A';
    ctx.fillRect(fTL.sx + fw * 0.22, fTL.sy + fh * 0.17, fw * 0.56, Math.max(2, fh * 0.07));

    // Metro Purple/Green livery band
    ctx.fillStyle = stripeHex;
    ctx.fillRect(fTL.sx, fTL.sy + fh * 0.62, fw, fh * 0.18);
    // Lower skirt
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(fTL.sx, fTL.sy + fh * 0.8, fw, fh * 0.2);

    // Headlights
    const hr = Math.max(2, fw * 0.07);
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(fTL.sx + fw * 0.18, fTL.sy + fh * 0.88, hr, 0, Math.PI * 2);
    ctx.arc(fTL.sx + fw * 0.82, fTL.sy + fh * 0.88, hr, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1A1423';
    ctx.lineWidth = Math.max(1.5, fBL.scale * 0.08);
    ctx.strokeRect(fTL.sx, fTL.sy, fw, fh);

    // Boarding Ramp (if train_ramp)
    if (h.kind === 'train_ramp' && (h.rampLength ?? 0) > 0) {
      const rBL = this.project(x - 1.25, 0, h.zStart);
      const rBR = this.project(x + 1.25, 0, h.zStart);
      if (rBL && rBR) {
        ctx.fillStyle = '#FFD60A';
        ctx.beginPath();
        ctx.moveTo(fTL.sx, fTL.sy);
        ctx.lineTo(fTR.sx, fTR.sy);
        ctx.lineTo(rBR.sx, rBR.sy);
        ctx.lineTo(rBL.sx, rBL.sy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1A1423';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  private drawToken(ctx: CanvasRenderingContext2D, tk: Token2D): void {
    const p = this.project(tk.x, tk.y + Math.sin(this.elapsed * 5 + tk.z) * 0.14, tk.z);
    if (!p) return;
    const r = Math.max(3, p.scale * 0.42);
    ctx.fillStyle = '#FFD60A';
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7B2CBF';
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1A1423';
    ctx.lineWidth = Math.max(1, r * 0.15);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp2D): void {
    const p = this.project(LANE_POSITIONS[pu.lane], pu.y + Math.sin(this.elapsed * 4.5) * 0.2, pu.z);
    if (!p) return;
    const r = Math.max(6, p.scale * 0.65);
    const fill = pu.type === 'kaapi' ? '#F59E0B' : pu.type === 'magnet' ? '#EF4444' : '#00F5D4';
    const glyph = pu.type === 'kaapi' ? '☕' : pu.type === 'magnet' ? 'U' : '✦';

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1A1423';
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.stroke();

    ctx.fillStyle = '#1A1423';
    ctx.font = `900 ${Math.max(10, Math.floor(r * 1.1))}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, p.sx, p.sy + 1);
  }

  private drawRunner(ctx: CanvasRenderingContext2D): void {
    const charSpec: CharacterSpec =
      CHARACTERS.find((c) => c.id === this.profile.selectedCharacter) ?? CHARACTERS[0];
    const boardSpec: HoverboardSpec =
      HOVERBOARDS.find((b) => b.id === this.profile.selectedHoverboard) ?? HOVERBOARDS[0];

    const hopY = this.mode === 'title' && this.lobbyHopTimer > 0
      ? Math.sin((this.lobbyHopTimer / 0.55) * Math.PI) * 1.15
      : 0;
    const py = this.mode === 'title' ? hopY : this.player.y;
    const px = this.mode === 'title' ? 0 : this.player.x;

    // Ground shadow
    const pGround = this.project(px, 0.02, 0);
    const pFeet = this.project(px, py, 0);
    if (!pFeet) return;

    if (pGround) {
      ctx.fillStyle = 'rgba(15, 10, 28, 0.45)';
      ctx.beginPath();
      ctx.ellipse(
        pGround.sx,
        pGround.sy,
        pGround.scale * 0.65,
        pGround.scale * 0.22,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    const s = pFeet.scale;
    const rolling = this.player.rollTimer > 0;
    const bodyScaleY = rolling ? 0.56 : 1;
    const stride = this.mode === 'playing' && !rolling ? Math.sin(this.elapsed * 18) : 0;

    // Auto-Rickshaw Hoverboard underneath feet when active
    if (this.hoverboardTimer > 0) {
      ctx.fillStyle = hexNum(boardSpec.primaryColor);
      ctx.fillRect(pFeet.sx - s * 0.72, pFeet.sy - s * 0.26, s * 1.44, s * 0.28);
      ctx.fillStyle = hexNum(boardSpec.secondaryColor);
      ctx.fillRect(pFeet.sx - s * 0.64, pFeet.sy - s * 0.42, s * 1.28, s * 0.16);
      ctx.strokeStyle = '#1A1423';
      ctx.lineWidth = 2;
      ctx.strokeRect(pFeet.sx - s * 0.72, pFeet.sy - s * 0.26, s * 1.44, s * 0.28);
    }

    // Startup Drone overhead when flying
    if (this.droneTimer > 0) {
      ctx.fillStyle = '#00F5D4';
      ctx.fillRect(pFeet.sx - s * 0.9, pFeet.sy - s * 2.45, s * 1.8, s * 0.22);
      ctx.strokeStyle = '#1A1423';
      ctx.lineWidth = 2;
      ctx.strokeRect(pFeet.sx - s * 0.9, pFeet.sy - s * 2.45, s * 1.8, s * 0.22);
    }

    // Legs
    ctx.fillStyle = hexNum(charSpec.secondaryColor);
    ctx.fillRect(pFeet.sx - s * 0.32, pFeet.sy - s * 0.72 * bodyScaleY + stride * s * 0.08, s * 0.26, s * 0.68 * bodyScaleY);
    ctx.fillRect(pFeet.sx + s * 0.06, pFeet.sy - s * 0.72 * bodyScaleY - stride * s * 0.08, s * 0.26, s * 0.68 * bodyScaleY);

    // Shoes
    ctx.fillStyle = hexNum(charSpec.shoeColor);
    ctx.fillRect(pFeet.sx - s * 0.34, pFeet.sy - s * 0.16 + stride * s * 0.08, s * 0.3, s * 0.16);
    ctx.fillRect(pFeet.sx + s * 0.04, pFeet.sy - s * 0.16 - stride * s * 0.08, s * 0.3, s * 0.16);

    // Torso
    const torsoH = s * 0.74 * bodyScaleY;
    const torsoY = pFeet.sy - s * 1.42 * bodyScaleY;
    ctx.fillStyle = hexNum(charSpec.primaryColor);
    ctx.fillRect(pFeet.sx - s * 0.42, torsoY, s * 0.84, torsoH);
    ctx.strokeStyle = '#1A1423';
    ctx.lineWidth = 2;
    ctx.strokeRect(pFeet.sx - s * 0.42, torsoY, s * 0.84, torsoH);

    // Backpack / ID lanyard detail
    ctx.fillStyle = this.mode === 'title' ? '#FFD60A' : '#1E293B';
    ctx.fillRect(pFeet.sx - s * 0.22, torsoY + torsoH * 0.15, s * 0.44, torsoH * 0.62);

    // Head
    const headSize = s * 0.54;
    const headY = torsoY - headSize - s * 0.04;
    ctx.fillStyle = hexNum(charSpec.skinColor);
    ctx.fillRect(pFeet.sx - headSize * 0.5, headY, headSize, headSize);
    ctx.fillStyle = hexNum(charSpec.hairColor);
    ctx.fillRect(pFeet.sx - headSize * 0.52, headY - headSize * 0.1, headSize * 1.04, headSize * 0.36);

    // Eyes on lobby front view
    if (this.mode === 'title') {
      ctx.fillStyle = '#1A1423';
      ctx.fillRect(pFeet.sx - headSize * 0.24, headY + headSize * 0.44, headSize * 0.12, headSize * 0.14);
      ctx.fillRect(pFeet.sx + headSize * 0.12, headY + headSize * 0.44, headSize * 0.12, headSize * 0.14);
    }

    ctx.strokeStyle = '#1A1423';
    ctx.lineWidth = 2;
    ctx.strokeRect(pFeet.sx - headSize * 0.5, headY, headSize, headSize);
  }

  private drawChaser(ctx: CanvasRenderingContext2D, z: number): void {
    const p = this.project(this.player.x * 0.88, 0, z);
    if (!p) return;
    const s = p.scale;
    const stride = Math.sin(this.elapsed * 20) * s * 0.08;

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(p.sx - s * 0.3, p.sy - s * 0.7 + stride, s * 0.24, s * 0.7);
    ctx.fillRect(p.sx + s * 0.06, p.sy - s * 0.7 - stride, s * 0.24, s * 0.7);

    // Blue Bengaluru Traffic Police / Security Uniform + High-Vis Yellow Belt
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(p.sx - s * 0.44, p.sy - s * 1.44, s * 0.88, s * 0.76);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(p.sx - s * 0.44, p.sy - s * 1.06, s * 0.88, s * 0.18);
    ctx.strokeStyle = '#1A1423';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.sx - s * 0.44, p.sy - s * 1.44, s * 0.88, s * 0.76);

    // Head & Cap
    ctx.fillStyle = '#C68652';
    ctx.fillRect(p.sx - s * 0.26, p.sy - s * 1.98, s * 0.52, s * 0.52);
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(p.sx - s * 0.3, p.sy - s * 2.08, s * 0.6, s * 0.24);
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const pt of this.particles) {
      const p = this.project(pt.x, pt.y, pt.z);
      if (!p) continue;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(p.sx - pt.size * 0.5, p.sy - pt.size * 0.5, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawWeatherOverlay(ctx: CanvasRenderingContext2D): void {
    const isMonsoon = this.weather === 'heavy_monsoon';
    const count = isMonsoon ? 96 : 34;
    ctx.strokeStyle = isMonsoon ? 'rgba(186, 230, 253, 0.72)' : 'rgba(224, 242, 254, 0.5)';
    ctx.lineWidth = isMonsoon ? 2 : 1.3;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const speedY = isMonsoon ? 640 : 390;
      const windX = isMonsoon ? -160 : -55;
      const lenY = isMonsoon ? 24 : 13;
      const lenX = isMonsoon ? -7 : -2.5;
      const rx = (((i * 89 + this.elapsed * windX) % (this.width + 80)) + (this.width + 80)) % (this.width + 80) - 40;
      const ry = ((i * 67 + this.elapsed * speedY) % (this.height + 60)) - 30;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + lenX, ry + lenY);
    }
    ctx.stroke();

    if (isMonsoon) {
      // Subtle wet sheen tint over lower track
      const wetGrad = ctx.createLinearGradient(0, this.height * 0.55, 0, this.height);
      wetGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      wetGrad.addColorStop(1, 'rgba(56, 189, 248, 0.14)');
      ctx.fillStyle = wetGrad;
      ctx.fillRect(0, this.height * 0.55, this.width, this.height * 0.45);
    }
  }

  private pushHud(force: boolean): void {
    if (this.disposed) return;

    const activePowerUps: ActivePowerUpState[] = [];
    if (this.hoverboardTimer > 0) {
      activePowerUps.push({
        type: 'hoverboard',
        remaining: this.hoverboardTimer,
        duration: this.hoverboardDuration,
      });
    }
    if (this.kaapiTimer > 0) activePowerUps.push({ type: 'kaapi', remaining: this.kaapiTimer, duration: this.kaapiDuration });
    if (this.magnetTimer > 0) activePowerUps.push({ type: 'magnet', remaining: this.magnetTimer, duration: this.magnetDuration });
    if (this.droneTimer > 0) activePowerUps.push({ type: 'drone', remaining: this.droneTimer, duration: this.droneDuration });
    if (this.sneakersTimer > 0) activePowerUps.push({ type: 'sneakers', remaining: this.sneakersTimer, duration: this.sneakersDuration });
    if (this.multiplierTimer > 0) activePowerUps.push({ type: 'multiplier', remaining: this.multiplierTimer, duration: this.multiplierDuration });

    const maxCd = Math.max(6, HOVERBOARD_COOLDOWN - ((this.profile.upgrades.hoverboard ?? 1) - 1) * 1.4);
    const cdRatio =
      this.hoverboardTimer > 0
        ? this.hoverboardTimer / Math.max(1, this.hoverboardDuration)
        : this.hoverboardCooldown <= 0
          ? 1
          : Math.max(0, 1 - this.hoverboardCooldown / maxCd);
    const baseMult = getEffectiveMultiplier(this.profile);
    const multiplierBoosted = this.multiplierTimer > 0;
    const multiplier = multiplierBoosted ? baseMult * 2 : baseMult;
    const headstartRemaining =
      this.mode === 'playing' && !this.headstartActive
        ? Math.max(0, HEADSTART_WINDOW - this.runTime)
        : 0;

    if (this.onLiveTick && this.mode === 'playing') {
      this.onLiveTick({
        score: Math.round(this.score),
        distance: Math.round(this.distance),
        tokens: this.runTokens,
        multiplier,
        multiplierBoosted,
        hoverboardReady: this.hoverboardTimer <= 0 && this.hoverboardCooldown <= 0,
        hoverboardActive: this.hoverboardTimer > 0,
        hoverboardCooldownRatio: cdRatio,
        headstartRemaining,
        headstartActive: this.headstartActive,
        kaapiActive: this.kaapiTimer > 0,
        activePowerUps,
        fps: 60,
        drawCalls: 1,
      });
    }

    if (!force && this.elapsed - this.lastHudPush < 0.45) return;
    this.lastHudPush = this.elapsed;

    this.onHud({
      mode: this.mode,
      score: Math.round(this.score),
      distance: Math.round(this.distance),
      tokens: this.runTokens,
      multiplier,
      multiplierBoosted,
      zone: this.zone,
      weather: this.weather,
      currentStation: this.activeStationBanner,
      stationBannerVisible: this.stationBannerTimer > 0 && this.activeStationBanner !== null,
      activePowerUps,
      hoverboardReady: this.hoverboardTimer <= 0 && this.hoverboardCooldown <= 0,
      hoverboardCooldownRatio: cdRatio,
      hoverboardActive: this.hoverboardTimer > 0,
      kaapiActive: this.kaapiTimer > 0,
      headstartActive: this.headstartActive,
      headstartAvailable: headstartRemaining > 0,
      chaserClose: this.chaserTimer > 0,
      callout: this.callout,
      voiceOver: this.activeVoiceOver,
      lastStationName: this.lastStationName,
      gameOverQuip: this.gameOverQuip,
      runSummary: this.runSummary,
    });
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = Math.max(0.001, (now - this.lastTs) / 1000);
      this.lastTs = now;
      this.stepSimulation(rawDt);
      this.renderFrame();
      this.frameHandle = window.requestAnimationFrame(tick);
    };
    this.frameHandle = window.requestAnimationFrame(tick);
  }

  private handleResize(): void {
    if (this.disposed) return;
    this.width = Math.max(1, this.container.clientWidth || window.innerWidth);
    this.height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.dpr = this.profile.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.renderFrame();
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameHandle);
    window.removeEventListener('resize', this.onWindowResizeBound);
    window.removeEventListener('orientationchange', this.onWindowResizeBound);
    this.resizeObserver?.disconnect();
    if (this.canvas.parentNode === this.container) {
      this.container.removeChild(this.canvas);
    }
  }
}
