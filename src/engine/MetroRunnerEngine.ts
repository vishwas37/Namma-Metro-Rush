import * as THREE from 'three';
import {
  BILLBOARDS,
  CLOSE_CALL_QUIPS,
  ELEVATED_STATIONS,
  GAME_OVER_QUIPS,
  HOVERBOARDS,
  SPEED_BOOST_QUIPS,
  UNDERGROUND_STATIONS,
  type CharacterId,
  type GraphicsQuality,
  type HoverboardId,
  type HoverboardPerk,
  type MetroStation,
  type PlayerProfile,
  type PowerUpType,
  type WeatherMode,
  type ZoneMode,
} from '../core/catalog';
import { selectNextChunk, type LevelChunk } from '../core/chunks';
import {
  DRONE_FLIGHT_Y,
  FIXED_DT,
  HEADSTART_DISTANCE,
  HEADSTART_WINDOW,
  HOVERBOARD_COOLDOWN,
  LANE_POSITIONS,
  MAX_FRAME_DT,
  STUMBLE_CHASE_WINDOW,
  TRAIN_ROOF_Y,
  computeCameraFraming,
  computeTrackUvOffsetDelta,
  createInitialPlayerKinematics,
  evaluateHazardInteraction,
  getEffectiveMultiplier,
  getNextUpcomingStation,
  getPowerUpDuration,
  getRunSpeed,
  getWeatherForDistance,
  lerpNumber,
  queuePlayerAction,
  stepPlayerPhysics,
  type CameraFraming,
  type HazardCollider,
  type PlayerKinematics,
  type RunSummary,
  type RunnerAction,
  type SupportBox,
} from '../core/simulation';
import type { VoiceOverPhrase } from '../core/voiceOver';
import { createAssetRegistry, mergeStaticGeometries, type AssetRegistry } from './assets';
import {
  buildChaserRig,
  buildRunnerRig,
  buildSkylineLandmark,
  disposeObject3D,
  type ChaserRig,
  type RunnerRig,
} from './meshes';
import {
  createEntityPools,
  type EntityPools,
  type ObstacleKind,
  type PooledObstacleSlot,
  type PooledTrainSlot,
  type TrainPoolKind,
} from './pools';
import {
  applyCurvedWorldShader,
  createSkyDome,
  createWorldShaderUniforms,
  type SkyDomeRig,
  type WorldShaderUniforms,
} from './shaders';
import { SoundEngine } from './sound';
import { createTextureLibrary, type TextureLibrary } from './textures';

export type GameMode = 'title' | 'playing' | 'paused' | 'gameover';

export interface ActivePowerUpState {
  type: PowerUpType | 'hoverboard';
  remaining: number;
  duration: number;
}

export interface CalloutToast {
  id: number;
  text: string;
  color: string;
}

export interface ActiveVoiceOver {
  id: number;
  phrase: VoiceOverPhrase;
}

export interface HudState {
  mode: GameMode;
  score: number;
  distance: number;
  tokens: number;
  multiplier: number;
  multiplierBoosted: boolean;
  zone: ZoneMode;
  weather: WeatherMode;
  currentStation: MetroStation | null;
  stationBannerVisible: boolean;
  stationBannerKind: 'next' | 'arriving';
  activePowerUps: ActivePowerUpState[];
  hoverboardReady: boolean;
  hoverboardCooldownRatio: number;
  hoverboardActive: boolean;
  kaapiActive: boolean;
  headstartActive: boolean;
  headstartAvailable: boolean;
  chaserClose: boolean;
  callout: CalloutToast | null;
  voiceOver: ActiveVoiceOver | null;
  lastStationName: string;
  gameOverQuip: string;
  runSummary: RunSummary | null;
}

/**
 * High-frequency live HUD counters pushed straight to DOM refs every frame
 * with ZERO React tree reconciliation during gameplay!
 */
export interface HudLiveCounters {
  score: number;
  distance: number;
  tokens: number;
  multiplier: number;
  multiplierBoosted: boolean;
  hoverboardReady: boolean;
  hoverboardActive: boolean;
  hoverboardCooldownRatio: number;
  headstartRemaining: number;
  headstartActive: boolean;
  kaapiActive: boolean;
  activePowerUps: ActivePowerUpState[];
  fps: number;
  drawCalls: number;
}

export interface RunnerEngine {
  updateProfile(profile: PlayerProfile): void;
  triggerLobbyWave(): void;
  startRun(): void;
  returnToTitle(): void;
  pause(): void;
  resume(): void;
  queueAction(action: RunnerAction): void;
  activateHoverboard(): void;
  activateHeadstart(): void;
  dispose(): void;
}

export interface AcquiredWebGL2 {
  canvas: HTMLCanvasElement;
  context: WebGL2RenderingContext;
  antialias: boolean;
}

interface ActiveHazard extends HazardCollider {
  trainSlot: PooledTrainSlot | null;
  obstacleSlot: PooledObstacleSlot | null;
  speedOffset: number;
  active: boolean;
  zCenter: number;
  prevZCenter: number;
  length: number;
}

interface SceneryItem {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotY: number;
}

interface CyclingBillboard {
  group: THREE.Group;
  side: -1 | 1;
  z: number;
}

// Module-level scratch objects to guarantee ZERO GC allocations inside the frame loop
const _dummy = new THREE.Object3D();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
const _colorC = new THREE.Color();
const _camTarget = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _lobbyCamPos = new THREE.Vector3();
const _lobbyLookPos = new THREE.Vector3();
const _chaseCamPos = new THREE.Vector3();
const _chaseLookPos = new THREE.Vector3();

function readWeatherOverride(): WeatherMode | null {
  if (typeof window === 'undefined') return null;
  const w = new URLSearchParams(window.location.search).get('weather');
  if (w === 'sunny' || w === 'light_rain' || w === 'heavy_monsoon') return w;
  return null;
}

/**
 * Safely probes and acquires a WebGL2 context BEFORE instantiating
 * THREE.WebGLRenderer so broken drivers (e.g. Linux Mesa/llvmpipe) cleanly fall
 * back to Canvas2DRunnerEngine without logging WebGL errors.
 */
export function acquireWebGL2Context(preferAntialias: boolean): AcquiredWebGL2 | null {
  if (typeof document === 'undefined') return null;
  const attempts: Array<{ antialias: boolean; powerPreference?: WebGLPowerPreference }> =
    preferAntialias
      ? [
          { antialias: true, powerPreference: 'high-performance' },
          { antialias: false, powerPreference: 'default' },
          { antialias: false },
        ]
      : [{ antialias: false, powerPreference: 'default' }, { antialias: false }];

  for (const attrs of attempts) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('webgl2', {
        alpha: false,
        antialias: attrs.antialias,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: attrs.powerPreference,
      }) as WebGL2RenderingContext | null;
      if (ctx && !ctx.isContextLost()) {
        return { canvas, context: ctx, antialias: attrs.antialias };
      }
    } catch {
      // Try next profile
    }
  }
  return null;
}

export class MetroRunnerEngine implements RunnerEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: TextureLibrary;
  private uniforms: WorldShaderUniforms;
  private skyDome: SkyDomeRig;
  private assets: AssetRegistry;
  private pools: EntityPools;
  private sound: SoundEngine;
  private onHud: (hud: HudState) => void;
  private onLiveTick?: (live: HudLiveCounters) => void;
  private onRunEnd: (summary: RunSummary) => void;
  private profile: PlayerProfile;
  private currentCharId: CharacterId;
  private currentBoardId: HoverboardId;
  private currentQuality: GraphicsQuality;
  private isSoftwareGl = false;
  private adaptiveQualityStep = 0;
  private fpsSamples = new Float32Array(30);
  private fpsSampleIdx = 0;
  private fpsSampleCount = 0;
  private currentFps = 60;
  private currentDrawCalls = 0;
  private adaptiveCooldown = 0;

  // Lighting
  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private fog: THREE.Fog;

  // Characters & Lobby Showcase Train
  private runnerRig: RunnerRig;
  private chaserRig: ChaserRig;
  private lobbyTrainMesh: THREE.Group;

  // Compact, heavily instanced static environment (< 25 draw calls total!)
  private elevatedGroup = new THREE.Group();
  private undergroundGroup = new THREE.Group();
  private viaductPierInst!: THREE.InstancedMesh;
  private viaductPierZ: number[] = [];
  private flagInst!: THREE.InstancedMesh;
  private flagItems: Array<{ side: -1 | 1; z: number }> = [];
  private treeTrunkInst!: THREE.InstancedMesh;
  private treeBlossomInst!: THREE.InstancedMesh;
  private treeItems: SceneryItem[] = [];
  private techTowerInst!: THREE.InstancedMesh;
  private techTowerItems: SceneryItem[] = [];
  private shopfrontInst!: THREE.InstancedMesh;
  private shopfrontItems: SceneryItem[] = [];
  private cloudInst!: THREE.InstancedMesh;
  private cloudItems: SceneryItem[] = [];
  private tunnelRibInst!: THREE.InstancedMesh;
  private tunnelLightInst!: THREE.InstancedMesh;
  private tunnelNeonInst!: THREE.InstancedMesh;
  private tunnelRibZ: number[] = [];
  private cyclingBillboards: CyclingBillboard[] = [];
  private billboardBackInst!: THREE.InstancedMesh;
  private billboardPostInst!: THREE.InstancedMesh;
  private vidhanaLandmark!: THREE.Group;
  private ubCityLandmark!: THREE.Group;
  private roadDashInst!: THREE.InstancedMesh;
  private roadDashZ: number[] = [];

  // Active gameplay entities (all backed by zero-GC pools)
  private hazards: ActiveHazard[] = [];
  private supportsScratch: SupportBox[] = [];
  private nextHazardId = 1;
  private lastChunkId: string | null = null;

  // Simulation state
  private mode: GameMode = 'title';
  private player: PlayerKinematics = createInitialPlayerKinematics();
  private score = 0;
  private distance = 0;
  private runTokens = 0;
  private stationsPassed = 0;
  private kaapiUsed = 0;
  private closeCalls = 0;
  private mysteryBoxesCollected = 0;
  private mysteryBonusTokens = 0;
  private lastMysteryRewardLabel = '';
  private lastStationName = 'Indiranagar';
  private gameOverQuip = GAME_OVER_QUIPS[0];
  private runSummary: RunSummary | null = null;

  // Zone & Weather
  private zone: ZoneMode = 'elevated';
  private spawnedZone: ZoneMode = 'elevated';
  private weather: WeatherMode = 'sunny';
  private weatherOverride: WeatherMode | null = readWeatherOverride();
  private weatherBlend = 0; // 0 = sunny, 0.5 = light_rain, 1.0 = heavy_monsoon
  private rainIntensity = 0;
  private elevatedIdx = 0;
  private undergroundIdx = 0;
  private nextChunkZ = -34;
  private nextStationDistance = 175;
  private nextZoneSwitchDistance = 720;

  // Timers & Power-ups
  private runTime = 0;
  private kaapiTimer = 0;
  private kaapiDuration = 5;
  private magnetTimer = 0;
  private magnetDuration = 8;
  private droneTimer = 0;
  private droneDuration = 6.5;
  private sneakersTimer = 0;
  private sneakersDuration = 11;
  private multiplierTimer = 0;
  private multiplierDuration = 12;
  private hoverboardTimer = 0;
  private hoverboardDuration = 30;
  private hoverboardCooldown = 0;
  private headstartActive = false;
  private headstartTargetDist = 0;
  private invincibilityTimer = 0;
  private chaserTimer = 0;
  private chaserZ = 7.2;
  private prevChaserZ = 7.2;
  private shakeTime = 0;
  private shakeIntensity = 0;
  private lobbyWaveTimer = 0;
  private lobbyTransition = 0; // 0 = lobby camera, 1 = chase camera (0.65s smooth sweep!)
  private currentStation: MetroStation | null = null;
  private stationBannerKind: 'next' | 'arriving' = 'next';
  private stationBannerTimer = 0;
  private initialNextStationAnnounced = false;
  private callout: CalloutToast | null = null;
  private calloutTimer = 0;
  private calloutSeq = 1;
  private crashTimer = 0;

  // Camera & Curve State
  private currentFov = 60;
  private framing: CameraFraming = computeCameraFraming(1280, 720);
  private time = 0;
  private accumulator = 0;
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private hudSyncTimer = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private boundOnResize: () => void;
  private boundOnContextLost: (e: Event) => void;
  private boundOnContextRestored: () => void;
  private activePowerUpsScratch: ActivePowerUpState[] = [];

  constructor(
    container: HTMLElement,
    profile: PlayerProfile,
    sound: SoundEngine,
    onHud: (hud: HudState) => void,
    onRunEnd: (summary: RunSummary) => void,
    webgl: AcquiredWebGL2,
    onLiveTick?: (live: HudLiveCounters) => void,
  ) {
    this.container = container;
    this.profile = profile;
    this.currentCharId = profile.selectedCharacter;
    this.currentBoardId = profile.selectedHoverboard;
    this.currentQuality = profile.quality;
    this.sound = sound;
    this.onHud = onHud;
    this.onRunEnd = onRunEnd;
    this.onLiveTick = onLiveTick;

    this.scene = new THREE.Scene();
    this.fog = new THREE.Fog(0x7cc8f8, 62, 215);
    this.scene.fog = this.fog;
    this.scene.background = this.fog.color;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    this.framing = computeCameraFraming(width, height);
    this.currentFov = this.framing.fov;
    this.camera = new THREE.PerspectiveCamera(this.framing.fov, width / height, 0.2, 260);
    this.camera.position.set(0, this.framing.lobbyY, this.framing.lobbyRadius);

    const { canvas, context, antialias } = webgl;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    this.container.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.setSize(width, height, false);

    // Detect software WebGL rasterizers (SwiftShader / llvmpipe) to keep rendering fast
    try {
      const dbg = context.getExtension('WEBGL_debug_renderer_info');
      const glRenderer = String(
        dbg ? context.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER),
      );
      this.isSoftwareGl = /swiftshader|llvmpipe|softpipe|mesa/i.test(glRenderer);
    } catch {
      this.isSoftwareGl = false;
    }

    this.applyQualitySettings(this.currentQuality);

    this.boundOnContextLost = (e: Event) => e.preventDefault();
    this.boundOnContextRestored = () => {
      if (!this.disposed) this.renderer.render(this.scene, this.camera);
    };
    canvas.addEventListener('webglcontextlost', this.boundOnContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.boundOnContextRestored, false);

    // Lighting — punchy Subway Surfers daylight with crisp tight player-tracking directional shadow
    this.hemiLight = new THREE.HemisphereLight(0xdff4ff, 0x3b6e52, 1.32);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4d6, 2.25);
    this.sunLight.position.set(16, 32, 14);
    this.sunLight.castShadow = !this.isSoftwareGl && this.currentQuality === 'high';
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 6;
    this.sunLight.shadow.camera.far = 84;
    this.sunLight.shadow.camera.left = -16;
    this.sunLight.shadow.camera.right = 16;
    this.sunLight.shadow.camera.top = 24;
    this.sunLight.shadow.camera.bottom = -24;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Core visual registries & pre-allocated zero-GC pools
    this.textures = createTextureLibrary(this.renderer.capabilities.getMaxAnisotropy());
    this.uniforms = createWorldShaderUniforms();
    this.skyDome = createSkyDome();
    this.scene.add(this.skyDome.mesh);

    this.assets = createAssetRegistry(this.textures, this.uniforms);
    this.pools = createEntityPools(this.scene, this.assets);

    // Compact, instanced environment & landmarks
    this.buildStaticEnvironment();

    // Sculpted runner, Inspector + Bengaluru street dog, and lobby parked train
    this.runnerRig = buildRunnerRig(this.currentCharId, this.currentBoardId, this.assets);
    this.scene.add(this.runnerRig.root);

    this.chaserRig = buildChaserRig(this.assets);
    this.scene.add(this.chaserRig.root);

    // Lobby showcase parked BEML Purple Line train right behind the runner
    const lobbySlot = this.pools.acquireTrain('train_static', 'purple');
    if (lobbySlot) {
      this.lobbyTrainMesh = lobbySlot.mesh;
      this.lobbyTrainMesh.position.set(LANE_POSITIONS[0], 0, -10.5);
      this.lobbyTrainMesh.visible = true;
      // Release back to pool only when run starts, or keep dedicated static lobby placement
      this.pools.releaseTrain(lobbySlot);
    }
    // Use a lightweight visual reference to the first pooled static train while in title mode
    this.lobbyTrainMesh = this.pools.acquireTrain('train_static', 'purple')?.mesh ?? new THREE.Group();
    this.lobbyTrainMesh.position.set(LANE_POSITIONS[0], 0, -10.5);

    this.applyWeatherPreset(this.weatherOverride ?? 'sunny');
    this.positionLobbyActors();

    // Warm up GPU shader programs once on real hardware so first jump/train has zero shader stutter
    if (!this.isSoftwareGl) {
      try {
        this.renderer.compile(this.scene, this.camera);
      } catch {
        // Ignore compilation hints on exotic drivers
      }
    }

    this.boundOnResize = () => this.handleResize();
    window.addEventListener('resize', this.boundOnResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }

    this.emitHud();
    this.lastFrameMs = performance.now();
    this.loop(this.lastFrameMs);
  }

  private applyQualitySettings(quality: GraphicsQuality): void {
    this.currentQuality = quality;
    const rawDpr = window.devicePixelRatio || 1;
    const maxDpr = this.isSoftwareGl
      ? 0.85
      : quality === 'high'
        ? this.adaptiveQualityStep === 0
          ? 1.75
          : this.adaptiveQualityStep === 1
            ? 1.35
            : 1.0
        : 1.0;
    this.renderer.setPixelRatio(Math.min(rawDpr, maxDpr));

    const allowShadows =
      !this.isSoftwareGl && quality === 'high' && this.adaptiveQualityStep < 2;
    this.renderer.shadowMap.enabled = allowShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (this.sunLight) {
      this.sunLight.castShadow = allowShadows;
    }
  }

  /**
   * Builds a hyper-efficient, curved-world Bengaluru Metro viaduct, underground tunnel,
   * instanced Tabebuia blossom avenues, instanced skyline & shopfronts, landmarks,
   * big funny billboards, and parallax clouds (~26 draw calls total!).
   */
  private buildStaticEnvironment(): void {
    // 1. Subdivided continuous curved-world viaduct deck (bends seamlessly with uCurveX/uCurveY!)
    const trackLen = 220;
    const deckGeo = new THREE.BoxGeometry(11.5, 0.55, trackLen, 1, 1, 52);
    const deck = new THREE.Mesh(deckGeo, this.assets.mat.trackDeck);
    deck.position.set(0, -0.275, -trackLen / 2 + 24);
    deck.receiveShadow = true;
    this.scene.add(deck);

    // Side viaduct concrete parapet walls + Kannada yellow/red & Namma Metro purple stripes (merged left+right = 4 DC!)
    const mergePair = (w: number, h: number, xOff: number, yOff: number) => {
      const l = new THREE.BoxGeometry(w, h, trackLen, 1, 1, 40);
      l.translate(-xOff, yOff, -trackLen / 2 + 24);
      const r = new THREE.BoxGeometry(w, h, trackLen, 1, 1, 40);
      r.translate(xOff, yOff, -trackLen / 2 + 24);
      const merged = mergeStaticGeometries([l, r]);
      l.dispose();
      r.dispose();
      return merged;
    };
    const wallsMesh = new THREE.Mesh(mergePair(0.65, 1.4, 6.08, 0.58), this.assets.mat.viaductWall);
    wallsMesh.receiveShadow = true;
    const stripeYellow = new THREE.Mesh(mergePair(0.18, 0.24, 5.72, 1.04), this.assets.mat.trimYellow);
    const stripeRed = new THREE.Mesh(mergePair(0.18, 0.24, 5.72, 0.78), this.assets.mat.trimRed);
    const stripePurple = new THREE.Mesh(mergePair(0.18, 0.24, 5.72, 0.48), this.assets.mat.trimPurple);
    this.scene.add(wallsMesh, stripeYellow, stripeRed, stripePurple);

    // 2. Elevated Bengaluru World Group (hidden cleanly when underground)
    this.scene.add(this.elevatedGroup);

    // Ground parks + Outer Ring Road avenue below the elevated viaduct
    const parkGeo = new THREE.PlaneGeometry(300, 260, 1, 20);
    const park = new THREE.Mesh(parkGeo, this.assets.mat.groundPark);
    park.rotation.x = -Math.PI / 2;
    park.position.set(0, -7.8, -96);
    const avenueGeo = new THREE.PlaneGeometry(24, 260, 1, 20);
    const avenue = new THREE.Mesh(avenueGeo, this.assets.mat.groundAvenue);
    avenue.rotation.x = -Math.PI / 2;
    avenue.position.set(0, -7.72, -96);
    this.elevatedGroup.add(park, avenue);

    // Instanced yellow road dashes below viaduct (1 draw call)
    const dashCount = 24;
    this.roadDashInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.35, 0.08, 4.4),
      this.assets.mat.roadDash,
      dashCount,
    );
    this.roadDashInst.frustumCulled = false;
    for (let i = 0; i < dashCount; i++) {
      this.roadDashZ.push(16 - i * 10);
    }
    this.elevatedGroup.add(this.roadDashInst);

    // Instanced concrete viaduct piers (1 draw call)
    const pierCount = 16;
    this.viaductPierInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1.05, 1.35, 8.2, 8),
      this.assets.mat.viaductPier,
      pierCount,
    );
    this.viaductPierInst.frustumCulled = false;
    for (let i = 0; i < pierCount; i++) {
      this.viaductPierZ.push(16 - i * 14);
    }
    this.elevatedGroup.add(this.viaductPierInst);

    // Instanced Kannada yellow-red pride flags along the viaduct rim (1 draw call)
    const flagCount = 20;
    this.flagInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.45, 0.9),
      this.assets.mat.kannadaFlag,
      flagCount,
    );
    this.flagInst.frustumCulled = false;
    for (let i = 0; i < flagCount; i++) {
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const z = 12 - Math.floor(i / 2) * 20;
      this.flagItems.push({ side, z });
    }
    this.elevatedGroup.add(this.flagInst);

    // Instanced Tabebuia Pink Blossom Trees (2 draw calls total for 36 trees!)
    const treeCount = 36;
    this.treeTrunkInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.32, 0.5, 4.8, 6),
      this.assets.mat.treeTrunk,
      treeCount,
    );
    this.treeBlossomInst = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(2.65, 1),
      this.assets.mat.treeBlossom,
      treeCount,
    );
    this.treeTrunkInst.frustumCulled = false;
    this.treeBlossomInst.frustumCulled = false;
    const blossomPalette = [0xff85c0, 0xf472b6, 0xfb7185, 0xf9a8d4, 0xfde047, 0x34d399];
    for (let i = 0; i < treeCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const scale = 0.85 + (i % 5) * 0.14;
      this.treeItems.push({
        x: side * (11.5 + (i % 4) * 3.8),
        y: -7.8,
        z: 18 - i * 6.4,
        scaleX: scale,
        scaleY: scale * (0.95 + (i % 3) * 0.12),
        scaleZ: scale,
        rotY: i * 1.1,
      });
      _colorA.setHex(blossomPalette[i % blossomPalette.length]);
      this.treeBlossomInst.setColorAt(i, _colorA);
    }
    if (this.treeBlossomInst.instanceColor) {
      this.treeBlossomInst.instanceColor.needsUpdate = true;
    }
    this.elevatedGroup.add(this.treeTrunkInst, this.treeBlossomInst);

    // Instanced Bengaluru Tech Glass Towers (1 draw call for 24 towers!)
    const towerCount = 24;
    this.techTowerInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      this.assets.mat.techTower,
      towerCount,
    );
    this.techTowerInst.frustumCulled = false;
    const towerTints = [0xe0f2fe, 0xf3e8ff, 0xede9fe, 0xdbeafe, 0xfef3c7];
    for (let i = 0; i < towerCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 18 + (i % 6) * 5.2;
      const w = 7 + (i % 3) * 2.4;
      this.techTowerItems.push({
        x: side * (25 + (i % 4) * 7.5),
        y: -7.8 + h / 2,
        z: 10 - i * 9.5,
        scaleX: w,
        scaleY: h,
        scaleZ: 7 + (i % 4) * 1.8,
        rotY: 0,
      });
      _colorA.setHex(towerTints[i % towerTints.length]);
      this.techTowerInst.setColorAt(i, _colorA);
    }
    if (this.techTowerInst.instanceColor) {
      this.techTowerInst.instanceColor.needsUpdate = true;
    }
    this.elevatedGroup.add(this.techTowerInst);

    // Instanced Warm Bengaluru Shopfronts & Darshini Blocks (1 draw call for 20 blocks!)
    const shopCount = 20;
    this.shopfrontInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      this.assets.mat.shopfront,
      shopCount,
    );
    this.shopfrontInst.frustumCulled = false;
    const shopTints = [0xffedd5, 0xfef08a, 0xfecdd3, 0xd9f99d, 0xfde68a];
    for (let i = 0; i < shopCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 9 + (i % 4) * 2.6;
      this.shopfrontItems.push({
        x: side * (16.5 + (i % 3) * 3.4),
        y: -7.8 + h / 2,
        z: 14 - i * 11,
        scaleX: 6.2 + (i % 3) * 1.2,
        scaleY: h,
        scaleZ: 6.4,
        rotY: 0,
      });
      _colorA.setHex(shopTints[i % shopTints.length]);
      this.shopfrontInst.setColorAt(i, _colorA);
    }
    if (this.shopfrontInst.instanceColor) {
      this.shopfrontInst.instanceColor.needsUpdate = true;
    }
    this.elevatedGroup.add(this.shopfrontInst);

    // Iconic Bengaluru Skyline Landmarks (Vidhana Soudha + UB City Twin Towers)
    this.vidhanaLandmark = buildSkylineLandmark('vidhana', this.assets);
    this.vidhanaLandmark.position.set(-34, -7.8, -110);
    this.ubCityLandmark = buildSkylineLandmark('ub_city', this.assets);
    this.ubCityLandmark.position.set(36, -7.8, -160);
    this.elevatedGroup.add(this.vidhanaLandmark, this.ubCityLandmark);

    // Big Funny Bilingual Roadside Billboards (6 draw calls total: 1 instanced frame + 1 instanced post + 4 fronts!)
    const bbCount = 4;
    this.billboardBackInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(9.2, 4.6, 0.32),
      this.assets.mat.trimYellow,
      bbCount,
    );
    this.billboardPostInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.22, 0.28, 5.8, 6),
      this.assets.mat.steelPole,
      bbCount,
    );
    this.billboardBackInst.frustumCulled = false;
    this.billboardPostInst.frustumCulled = false;
    this.elevatedGroup.add(this.billboardBackInst, this.billboardPostInst);

    const frontPlaneGeo = new THREE.PlaneGeometry(8.9, 4.32);
    for (let i = 0; i < bbCount; i++) {
      const bbGroup = new THREE.Group();
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const bb = BILLBOARDS[i % BILLBOARDS.length];
      const tex = this.textures.createBillboard(bb);
      const cardMat = applyCurvedWorldShader(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: tex,
          roughness: 0.36,
          emissive: 0x1c1917,
          emissiveIntensity: 0.25,
        }),
        this.uniforms,
        { rim: true, rimScale: 0.5 },
      );
      const cardFront = new THREE.Mesh(frontPlaneGeo, cardMat);
      cardFront.position.set(0, 5.2, 0.18);
      bbGroup.add(cardFront);
      bbGroup.position.set(side * 10.6, 0, -28 - i * 48);
      bbGroup.rotation.y = side * -0.24;
      this.elevatedGroup.add(bbGroup);
      this.cyclingBillboards.push({ group: bbGroup, side, z: -28 - i * 48 });
    }

    // Parallax Stylized Clouds (1 draw call for 18 clouds!)
    const cloudCount = 18;
    this.cloudInst = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(3.8, 1),
      this.assets.mat.cloudMat,
      cloudCount,
    );
    this.cloudInst.frustumCulled = false;
    for (let i = 0; i < cloudCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.cloudItems.push({
        x: side * (16 + (i % 5) * 14),
        y: 26 + (i % 4) * 5,
        z: 10 - i * 14,
        scaleX: 2.1 + (i % 3) * 0.7,
        scaleY: 0.68 + (i % 2) * 0.22,
        scaleZ: 1.3 + (i % 3) * 0.35,
        rotY: i * 0.7,
      });
    }
    this.elevatedGroup.add(this.cloudInst);

    // 3. Underground Majestic / Cubbon Park Tunnel Group (hidden while elevated!)
    this.undergroundGroup.visible = false;
    this.scene.add(this.undergroundGroup);

    const tunnelWallGeo = new THREE.BoxGeometry(0.8, 9.6, trackLen, 1, 1, 36);
    for (const side of [-1, 1]) {
      const tWall = new THREE.Mesh(tunnelWallGeo, this.assets.mat.tunnelWall);
      tWall.position.set(side * 6.5, 4.6, -trackLen / 2 + 24);
      this.undergroundGroup.add(tWall);
    }
    const tCeiling = new THREE.Mesh(
      new THREE.BoxGeometry(13.8, 0.8, trackLen, 1, 1, 36),
      this.assets.mat.tunnelWall,
    );
    tCeiling.position.set(0, 9.2, -trackLen / 2 + 24);
    this.undergroundGroup.add(tCeiling);

    const ribCount = 18;
    this.tunnelRibInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(13.2, 0.55, 0.75),
      this.assets.mat.tunnelRib,
      ribCount,
    );
    this.tunnelLightInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(3.4, 0.16, 4.6),
      this.assets.mat.tunnelLightStrip,
      ribCount,
    );
    this.tunnelNeonInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.18, 0.34, 7.2),
      this.assets.mat.tunnelNeonPurple,
      ribCount * 2,
    );
    this.tunnelRibInst.frustumCulled = false;
    this.tunnelLightInst.frustumCulled = false;
    this.tunnelNeonInst.frustumCulled = false;
    for (let i = 0; i < ribCount; i++) {
      this.tunnelRibZ.push(14 - i * 12);
    }
    this.undergroundGroup.add(this.tunnelRibInst, this.tunnelLightInst, this.tunnelNeonInst);

    // Populate initial instance transforms
    this.updateStaticScenery(0);
  }

  private updateStaticScenery(forwardStep: number): void {
    // Lock track bed UV scroll 1:1 with physical forward speed (zero strobe or sliding)
    if (forwardStep !== 0) {
      this.textures.trackBed.offset.y =
        (this.textures.trackBed.offset.y + computeTrackUvOffsetDelta(forwardStep)) % 1;
    }

    if (this.elevatedGroup.visible) {
      // Road dashes
      for (let i = 0; i < this.roadDashZ.length; i++) {
        this.roadDashZ[i] += forwardStep;
        if (this.roadDashZ[i] > 26) this.roadDashZ[i] -= 240;
        _dummy.position.set(0, -7.66, this.roadDashZ[i]);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.roadDashInst.setMatrixAt(i, _dummy.matrix);
      }
      this.roadDashInst.instanceMatrix.needsUpdate = true;

      // Viaduct piers
      for (let i = 0; i < this.viaductPierZ.length; i++) {
        this.viaductPierZ[i] += forwardStep;
        if (this.viaductPierZ[i] > 26) this.viaductPierZ[i] -= 224;
        _dummy.position.set(0, -4.3, this.viaductPierZ[i]);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.viaductPierInst.setMatrixAt(i, _dummy.matrix);
      }
      this.viaductPierInst.instanceMatrix.needsUpdate = true;

      // Kannada yellow-red flags along viaduct parapets
      const flagWave = Math.sin(this.time * 5.2) * 0.18;
      for (let i = 0; i < this.flagItems.length; i++) {
        const f = this.flagItems[i];
        f.z += forwardStep;
        if (f.z > 24) f.z -= 200;
        _dummy.position.set(f.side * 6.28, 2.08, f.z);
        _dummy.rotation.set(0, f.side * 0.4 + flagWave, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.flagInst.setMatrixAt(i, _dummy.matrix);
      }
      this.flagInst.instanceMatrix.needsUpdate = true;

      // Tabebuia pink blossom trees
      for (let i = 0; i < this.treeItems.length; i++) {
        const t = this.treeItems[i];
        t.z += forwardStep;
        if (t.z > 28) t.z -= 230.4;
        _dummy.position.set(t.x, t.y + 2.4 * t.scaleY, t.z);
        _dummy.rotation.set(0, t.rotY, 0);
        _dummy.scale.set(t.scaleX, t.scaleY, t.scaleZ);
        _dummy.updateMatrix();
        this.treeTrunkInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(t.x, t.y + 5.6 * t.scaleY, t.z);
        _dummy.scale.set(t.scaleX * 1.08, t.scaleY * 0.88, t.scaleZ * 1.08);
        _dummy.updateMatrix();
        this.treeBlossomInst.setMatrixAt(i, _dummy.matrix);
      }
      this.treeTrunkInst.instanceMatrix.needsUpdate = true;
      this.treeBlossomInst.instanceMatrix.needsUpdate = true;

      // Skyline tech towers (slight parallax)
      for (let i = 0; i < this.techTowerItems.length; i++) {
        const b = this.techTowerItems[i];
        b.z += forwardStep * 0.84;
        if (b.z > 26) b.z -= 228;
        _dummy.position.set(b.x, b.y, b.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(b.scaleX, b.scaleY, b.scaleZ);
        _dummy.updateMatrix();
        this.techTowerInst.setMatrixAt(i, _dummy.matrix);
      }
      this.techTowerInst.instanceMatrix.needsUpdate = true;

      // Warm Bengaluru shopfronts
      for (let i = 0; i < this.shopfrontItems.length; i++) {
        const s = this.shopfrontItems[i];
        s.z += forwardStep * 0.96;
        if (s.z > 26) s.z -= 220;
        _dummy.position.set(s.x, s.y, s.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(s.scaleX, s.scaleY, s.scaleZ);
        _dummy.updateMatrix();
        this.shopfrontInst.setMatrixAt(i, _dummy.matrix);
      }
      this.shopfrontInst.instanceMatrix.needsUpdate = true;

      // Cycling landmarks (slow majestic parallax)
      this.vidhanaLandmark.position.z += forwardStep * 0.42;
      if (this.vidhanaLandmark.position.z > 35) this.vidhanaLandmark.position.z = -185;
      this.ubCityLandmark.position.z += forwardStep * 0.45;
      if (this.ubCityLandmark.position.z > 35) this.ubCityLandmark.position.z = -195;

      // Big funny roadside billboards + instanced backing frames & posts
      for (let i = 0; i < this.cyclingBillboards.length; i++) {
        const bb = this.cyclingBillboards[i];
        bb.z += forwardStep;
        if (bb.z > 22) bb.z -= 192;
        bb.group.position.z = bb.z;

        const rotY = bb.side * -0.24;
        _dummy.position.set(bb.side * 10.6, 5.2, bb.z);
        _dummy.rotation.set(0, rotY, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.billboardBackInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(bb.side * 10.6, 0.15, bb.z - 0.36);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        this.billboardPostInst.setMatrixAt(i, _dummy.matrix);
      }
      this.billboardBackInst.instanceMatrix.needsUpdate = true;
      this.billboardPostInst.instanceMatrix.needsUpdate = true;

      // Clouds
      for (let i = 0; i < this.cloudItems.length; i++) {
        const c = this.cloudItems[i];
        c.z += forwardStep * 0.25 + 0.015;
        if (c.z > 32) c.z -= 252;
        _dummy.position.set(c.x, c.y, c.z);
        _dummy.rotation.set(0, c.rotY, 0);
        _dummy.scale.set(c.scaleX, c.scaleY, c.scaleZ);
        _dummy.updateMatrix();
        this.cloudInst.setMatrixAt(i, _dummy.matrix);
      }
      this.cloudInst.instanceMatrix.needsUpdate = true;
    }

    if (this.undergroundGroup.visible) {
      for (let i = 0; i < this.tunnelRibZ.length; i++) {
        this.tunnelRibZ[i] += forwardStep;
        if (this.tunnelRibZ[i] > 24) this.tunnelRibZ[i] -= 216;
        const rz = this.tunnelRibZ[i];
        _dummy.position.set(0, 8.85, rz);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.tunnelRibInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(0, 8.65, rz - 4);
        _dummy.updateMatrix();
        this.tunnelLightInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(-6.05, 4.4, rz);
        _dummy.updateMatrix();
        this.tunnelNeonInst.setMatrixAt(i * 2, _dummy.matrix);

        _dummy.position.set(6.05, 4.4, rz);
        _dummy.updateMatrix();
        this.tunnelNeonInst.setMatrixAt(i * 2 + 1, _dummy.matrix);
      }
      this.tunnelRibInst.instanceMatrix.needsUpdate = true;
      this.tunnelLightInst.instanceMatrix.needsUpdate = true;
      this.tunnelNeonInst.instanceMatrix.needsUpdate = true;
    }
  }

  private getActiveBoardPerk(): HoverboardPerk | null {
    if (this.hoverboardTimer <= 0) return null;
    const spec = HOVERBOARDS.find((h) => h.id === this.currentBoardId);
    return spec?.perk ?? null;
  }

  private getActiveBoardGlowColor(): number {
    const spec = HOVERBOARDS.find((h) => h.id === this.currentBoardId);
    return spec?.glowColor ?? 0x00f5d4;
  }

  public updateProfile(profile: PlayerProfile): void {
    const charChanged = profile.selectedCharacter !== this.currentCharId;
    const boardChanged = profile.selectedHoverboard !== this.currentBoardId;
    const qualityChanged = profile.quality !== this.currentQuality;
    this.profile = profile;

    if (charChanged || boardChanged) {
      this.currentCharId = profile.selectedCharacter;
      this.currentBoardId = profile.selectedHoverboard;
      this.scene.remove(this.runnerRig.root);
      disposeObject3D(this.runnerRig.root);
      this.runnerRig = buildRunnerRig(this.currentCharId, this.currentBoardId, this.assets);
      this.scene.add(this.runnerRig.root);
      this.runnerRig.hoverboardMount.visible = this.hoverboardTimer > 0;
      this.runnerRig.droneMount.visible = this.droneTimer > 0;
      if (this.mode === 'title') {
        this.positionLobbyActors();
      }
    }

    if (qualityChanged) {
      this.adaptiveQualityStep = 0;
      this.applyQualitySettings(profile.quality);
    }
    this.emitHud();
  }

  public triggerLobbyWave(): void {
    if (this.mode === 'title') {
      this.lobbyWaveTimer = 1.15;
    }
  }

  private positionLobbyActors(): void {
    this.runnerRig.root.position.set(0, 0, 0);
    this.runnerRig.root.rotation.set(0, Math.PI, 0); // Facing the lobby camera!
    this.runnerRig.root.scale.set(1, 1, 1);
    this.runnerRig.hoverboardMount.visible = false;
    this.runnerRig.droneMount.visible = false;
    this.runnerRig.sneakersLeft.visible = false;
    this.runnerRig.sneakersRight.visible = false;

    // Inspector & Bengaluru street dog patrolling visibly to the right of the runner!
    this.chaserRig.root.visible = true;
    this.chaserRig.root.position.set(2.4, 0, -2.5);
    this.chaserRig.root.rotation.set(0, Math.PI - 0.35, 0);

    this.lobbyTrainMesh.visible = true;
    this.lobbyTrainMesh.position.set(LANE_POSITIONS[0], 0, -13.5);
  }

  private clearActiveRunEntities(): void {
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      if (h.trainSlot) this.pools.releaseTrain(h.trainSlot);
      if (h.obstacleSlot) this.pools.releaseObstacle(h.obstacleSlot);
    }
    this.hazards.length = 0;
    this.pools.resetAll();
  }

  public startRun(): void {
    this.clearActiveRunEntities();
    this.lobbyTrainMesh.visible = false;

    this.mode = 'playing';
    this.player = createInitialPlayerKinematics();
    this.score = 0;
    this.distance = 0;
    this.runTokens = 0;
    this.stationsPassed = 0;
    this.kaapiUsed = 0;
    this.closeCalls = 0;
    this.mysteryBoxesCollected = 0;
    this.mysteryBonusTokens = 0;
    this.lastMysteryRewardLabel = '';
    this.lastStationName = 'Indiranagar';
    this.runSummary = null;
    this.runTime = 0;

    this.zone = 'elevated';
    this.spawnedZone = 'elevated';
    this.weather = this.weatherOverride ?? 'sunny';
    this.applyZoneVisuals('elevated');
    this.applyWeatherPreset(this.weather);

    this.elevatedIdx = 0;
    this.undergroundIdx = 0;
    this.nextChunkZ = -68;
    this.nextStationDistance = 175;
    this.nextZoneSwitchDistance = 720;
    this.lastChunkId = null;

    // Inviting Subway Surfers warm-up coin runway across center lane so player settles in smoothly
    for (let c = 0; c < 10; c++) {
      this.pools.spawnToken(LANE_POSITIONS[1], 1.12, -16 - c * 3.8);
    }

    this.kaapiTimer = 0;
    this.magnetTimer = 0;
    this.droneTimer = 0;
    this.sneakersTimer = 0;
    this.multiplierTimer = 0;
    this.hoverboardTimer = 0;
    this.hoverboardCooldown = 0;
    this.headstartActive = false;
    this.headstartTargetDist = 0;
    this.invincibilityTimer = 0;
    this.chaserTimer = 4.2; // Inspector & street dog chase visibly at run start!
    this.chaserZ = 3.9;
    this.prevChaserZ = 3.9;
    this.shakeTime = 0;
    this.shakeIntensity = 0;
    this.crashTimer = 0;
    this.lobbyTransition = 0; // Triggers silky 0.65s lobby-to-chase camera sweep!
    this.currentStation = null;
    this.stationBannerKind = 'next';
    this.stationBannerTimer = 0;
    this.initialNextStationAnnounced = false;
    this.callout = null;
    this.calloutTimer = 0;

    this.runnerRig.root.position.set(0, 0, 0);
    this.runnerRig.root.rotation.set(0, 0, 0);
    this.runnerRig.hoverboardMount.visible = false;
    this.runnerRig.droneMount.visible = false;
    this.runnerRig.sneakersLeft.visible = false;
    this.runnerRig.sneakersRight.visible = false;
    this.chaserRig.root.visible = true;
    this.chaserRig.root.rotation.set(0, 0, 0);

    // Pre-populate horizon with 2 clean handcrafted chunks (keeps draw calls strictly < 85!)
    for (let i = 0; i < 2; i++) {
      this.spawnNextChunk();
    }

    this.sound.setUnderground(false);
    this.sound.startMusic();
    this.sound.playChaseStart();
    this.emitHud();
  }

  public returnToTitle(): void {
    this.clearActiveRunEntities();
    this.mode = 'title';
    this.zone = 'elevated';
    this.weather = this.weatherOverride ?? 'sunny';
    this.applyZoneVisuals('elevated');
    this.applyWeatherPreset(this.weather);
    this.player = createInitialPlayerKinematics();
    this.lobbyTransition = 0;
    this.sound.stopMusic();
    this.sound.cancelSpeech();
    this.currentStation = null;
    this.stationBannerKind = 'next';
    this.stationBannerTimer = 0;
    this.initialNextStationAnnounced = false;
    this.callout = null;
    this.calloutTimer = 0;
    this.positionLobbyActors();
    this.emitHud();
  }

  public pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.sound.stopMusic();
    this.emitHud();
  }

  public resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.lastFrameMs = performance.now();
    this.accumulator = 0;
    this.sound.startMusic();
    this.emitHud();
  }

  public queueAction(action: RunnerAction): void {
    if (this.mode !== 'playing') return;
    queuePlayerAction(this.player, action);
  }

  public activateHoverboard(): void {
    if (this.mode !== 'playing') return;
    if (this.hoverboardTimer > 0 || this.hoverboardCooldown > 0 || this.droneTimer > 0) return;

    this.hoverboardDuration = getPowerUpDuration(this.profile, 'hoverboard');
    this.hoverboardTimer = this.hoverboardDuration;
    this.runnerRig.hoverboardMount.visible = true;
    this.player.activeBoardPerk = this.getActiveBoardPerk();
    this.sound.playAutoHorn();
    this.pools.spawnBurst(this.player.x, this.player.y + 0.5, 0, this.getActiveBoardGlowColor(), 14, 6.5);
    this.showCallout('HOVERBOARD ON!', '#00f5d4');
    this.emitHud();
  }

  public activateHeadstart(): void {
    if (this.mode !== 'playing') return;
    if (this.headstartActive || this.runTime > HEADSTART_WINDOW) return;

    this.headstartActive = true;
    this.headstartTargetDist = this.distance + HEADSTART_DISTANCE;
    this.invincibilityTimer = Math.max(this.invincibilityTimer, 5.2);
    this.chaserTimer = 0;
    this.sound.playHeadstart();
    this.pools.triggerShockwave(this.player.x, this.player.y + 0.4, 0xffd60a);
    this.pools.spawnBurst(this.player.x, this.player.y + 1.1, 0, 0xffd60a, 18, 8.5);
    this.showCallout('NAMMA EXPRESS HEADSTART!', '#ffd60a');
    this.emitHud();
  }

  private showCallout(text: string, color: string): void {
    this.callout = { id: this.calloutSeq++, text, color };
    this.calloutTimer = 1.65;
  }

  private applyZoneVisuals(zone: ZoneMode): void {
    this.zone = zone;
    const isUnderground = zone === 'underground';
    this.elevatedGroup.visible = !isUnderground;
    this.undergroundGroup.visible = isUnderground;
    this.skyDome.mesh.visible = !isUnderground;
    this.sound.setUnderground(isUnderground);

    if (isUnderground) {
      this.fog.color.setHex(0x161228);
      this.fog.near = 28;
      this.fog.far = 128;
      this.hemiLight.color.setHex(0xb8c0ff);
      this.hemiLight.groundColor.setHex(0x231942);
      this.hemiLight.intensity = 1.2;
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 1.35;
      this.assets.setTrackWetness(0.15);
    } else {
      this.updateSkyAndLightingForWeather(1);
    }
  }

  private applyWeatherPreset(weather: WeatherMode): void {
    this.weather = weather;
    this.weatherBlend = weather === 'sunny' ? 0 : weather === 'light_rain' ? 0.5 : 1.0;
    this.rainIntensity = weather === 'sunny' ? 0 : weather === 'light_rain' ? 0.42 : 1.0;
    if (this.zone === 'elevated') {
      this.updateSkyAndLightingForWeather(1);
    }
  }

  private updateSkyAndLightingForWeather(lerpFactor: number): void {
    if (this.zone === 'underground') return;

    const targetBlend = this.weather === 'sunny' ? 0 : this.weather === 'light_rain' ? 0.5 : 1.0;
    this.weatherBlend += (targetBlend - this.weatherBlend) * lerpFactor;

    const targetRain = this.weather === 'sunny' ? 0 : this.weather === 'light_rain' ? 0.42 : 1.0;
    this.rainIntensity += (targetRain - this.rainIntensity) * lerpFactor;

    // Smooth Bengaluru sky dome + sunlight transition between Golden Sunny -> Light Rain -> Heavy Monsoon
    const t = this.weatherBlend;
    // Top zenith: vibrant sky blue -> rich moody monsoon slate
    _colorA.setHex(0x1d7ed6).lerp(_colorB.setHex(0x334866), t);
    this.skyDome.uniforms.uTopColor.value.copy(_colorA);
    // Mid sky: crisp cyan -> atmospheric storm blue-gray
    _colorA.setHex(0x4fc3f7).lerp(_colorB.setHex(0x526b8a), t);
    this.skyDome.uniforms.uMidColor.value.copy(_colorA);
    // Horizon: warm golden turquoise -> silver rain mist
    _colorA.setHex(0xc8f0ff).lerp(_colorB.setHex(0x889cb3), t);
    this.skyDome.uniforms.uHorizonColor.value.copy(_colorA);
    // Sun glow: radiant Bengaluru sun -> soft diffused storm glow
    _colorA.setHex(0xfff4b8).lerp(_colorB.setHex(0xcbd5e1), t);
    this.skyDome.uniforms.uSunColor.value.copy(_colorA);
    this.skyDome.uniforms.uSunIntensity.value = 1.0 - t * 0.72;

    _colorA.setHex(0x8fd6f6).lerp(_colorB.setHex(0x6d829c), t);
    this.fog.color.copy(_colorA);
    this.fog.near = 64 - t * 20;
    this.fog.far = 218 - t * 55;

    this.hemiLight.intensity = 1.35 - t * 0.28;
    this.sunLight.intensity = 2.25 - t * 0.95;
    _colorC.setHex(0xfff4d6).lerp(_colorB.setHex(0xcbd5e1), t);
    this.sunLight.color.copy(_colorC);

    // Wet reflective puddles & sheen on track & train roofs during rain/monsoon!
    this.assets.setTrackWetness(t * 0.92);
  }

  private pickWeightedPowerUp(pool?: PowerUpType[]): PowerUpType {
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const r = Math.random();
    if (r < 0.2) return 'magnet';
    if (r < 0.38) return 'sneakers';
    if (r < 0.56) return 'multiplier';
    if (r < 0.74) return 'kaapi';
    if (r < 0.89) return 'drone';
    return 'mystery_box';
  }

  /**
   * Spawns the next handcrafted, guaranteed-solvable level chunk strictly from
   * pre-allocated zero-GC object pools. Zero `new THREE.*` allocations!
   */
  private spawnNextChunk(): void {
    const chunk: LevelChunk = selectNextChunk(this.distance, this.lastChunkId);
    this.lastChunkId = chunk.id;
    const anchorZ = this.nextChunkZ;

    // 1. Spawn chunk hazards from pre-warmed train & obstacle pools
    for (let i = 0; i < chunk.hazards.length; i++) {
      const def = chunk.hazards[i];
      const zCenter = anchorZ - def.zOffset;
      const laneX = LANE_POSITIONS[def.lane];
      const line: 'purple' | 'green' = def.line ?? (Math.random() < 0.65 ? 'purple' : 'green');

      if (def.kind === 'train_static' || def.kind === 'train_ramp' || def.kind === 'train_moving') {
        const slot = this.pools.acquireTrain(def.kind as TrainPoolKind, line);
        if (!slot) continue;
        const length = def.kind === 'train_moving' ? 18 : 16;
        const rampLength = def.kind === 'train_ramp' ? 5.4 : undefined;
        slot.mesh.position.set(laneX, 0, zCenter);
        this.hazards.push({
          id: this.nextHazardId++,
          kind: def.kind,
          lane: def.lane,
          zCenter,
          prevZCenter: zCenter,
          zStart: zCenter + length / 2 + (rampLength ?? 0),
          zEnd: zCenter - length / 2,
          prevZStart: zCenter + length / 2 + (rampLength ?? 0),
          prevZEnd: zCenter - length / 2,
          height: TRAIN_ROOF_Y,
          rampLength,
          trainSlot: slot,
          obstacleSlot: null,
          speedOffset: def.kind === 'train_moving' ? 14 + Math.min(10, this.distance * 0.008) : 0,
          active: true,
          length,
        });
      } else {
        const slot = this.pools.acquireObstacle(def.kind as ObstacleKind);
        if (!slot) continue;
        slot.mesh.position.set(laneX, 0, zCenter);
        const halfDepth = def.kind === 'pillar_narrow' ? 0.52 : 0.42;
        const height =
          def.kind === 'pillar_narrow' ? 4.6 : def.kind === 'gantry_low' ? 2.85 : 1.38;
        this.hazards.push({
          id: this.nextHazardId++,
          kind: def.kind,
          lane: def.lane,
          zCenter,
          prevZCenter: zCenter,
          zStart: zCenter + halfDepth,
          zEnd: zCenter - halfDepth,
          prevZStart: zCenter + halfDepth,
          prevZEnd: zCenter - halfDepth,
          height,
          clearanceBottomY: def.kind === 'gantry_low' ? 1.32 : undefined,
          trainSlot: null,
          obstacleSlot: slot,
          speedOffset: 0,
          active: true,
          length: halfDepth * 2,
        });
      }
    }

    // 2. Spawn coin sightlines (straight, parabolic jump arcs, diagonal lane switchbacks)
    for (let i = 0; i < chunk.coinLines.length; i++) {
      const lineDef = chunk.coinLines[i];
      const startX = LANE_POSITIONS[lineDef.lane];
      const endX =
        lineDef.endLane !== undefined ? LANE_POSITIONS[lineDef.endLane] : startX;
      for (let c = 0; c < lineDef.count; c++) {
        const t = lineDef.count > 1 ? c / (lineDef.count - 1) : 0;
        const x = startX + (endX - startX) * t;
        const arch = lineDef.archHeight ? Math.sin(t * Math.PI) * lineDef.archHeight : 0;
        const y = lineDef.yBase + arch;
        const z = anchorZ - lineDef.zOffset - c * lineDef.spacing;
        this.pools.spawnToken(x, y, z);
      }
    }

    // 3. Spawn optional power-up anchors
    if (chunk.powerUps) {
      for (let i = 0; i < chunk.powerUps.length; i++) {
        const p = chunk.powerUps[i];
        if (Math.random() <= p.chance) {
          const type = this.pickWeightedPowerUp(p.pool);
          const z = anchorZ - p.zOffset;
          const slot = this.pools.acquirePowerUp(type, p.lane, p.y, z);
          if (slot) {
            slot.rig.root.position.set(LANE_POSITIONS[p.lane], p.y, z);
          }
        }
      }
    }

    // 4. Spawn Drone Sky Coin Ribbons when Bengaluru Tech Drone is flying!
    if (this.droneTimer > 1.2) {
      const skyLane = Math.floor(Math.random() * 3);
      for (let c = 0; c < 10; c++) {
        this.pools.spawnToken(
          LANE_POSITIONS[skyLane],
          DRONE_FLIGHT_Y + 0.35 + Math.sin(c * 0.55) * 0.3,
          anchorZ - 4 - c * 3.4,
        );
      }
    }

    // 5. Station & Underground Tunnel Portal pacing
    const predictedDist = this.distance + Math.abs(anchorZ);
    if (predictedDist >= this.nextStationDistance) {
      const list = this.spawnedZone === 'elevated' ? ELEVATED_STATIONS : UNDERGROUND_STATIONS;
      const idx = this.spawnedZone === 'elevated' ? this.elevatedIdx++ : this.undergroundIdx++;
      const station = list[idx % list.length];
      this.pools.acquireStation(station, anchorZ - chunk.length * 0.5);
      this.nextStationDistance = predictedDist + 210;
    }

    if (predictedDist >= this.nextZoneSwitchDistance) {
      const targetZone: ZoneMode = this.spawnedZone === 'elevated' ? 'underground' : 'elevated';
      this.pools.acquirePortal(targetZone, anchorZ - chunk.length + 6);
      this.spawnedZone = targetZone;
      this.nextZoneSwitchDistance = predictedDist + 720;
    }

    this.nextChunkZ = anchorZ - chunk.length;
  }

  private clearHazardsInRadius(radiusZ: number): void {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (h.zStart >= -radiusZ && h.zEnd <= 10) {
        this.pools.spawnBurst(LANE_POSITIONS[h.lane], 1.6, Math.max(-22, h.zCenter), 0x00f5d4, 8, 7.5);
        if (h.trainSlot) this.pools.releaseTrain(h.trainSlot);
        if (h.obstacleSlot) this.pools.releaseObstacle(h.obstacleSlot);
        this.hazards.splice(i, 1);
      }
    }
  }

  private collectPowerUp(type: PowerUpType): void {
    this.sound.playPowerUp();
    if (type === 'kaapi') {
      this.kaapiDuration = getPowerUpDuration(this.profile, 'kaapi');
      this.kaapiTimer = this.kaapiDuration;
      this.kaapiUsed++;
      this.invincibilityTimer = Math.max(this.invincibilityTimer, 0.8);
      const quip = SPEED_BOOST_QUIPS[Math.floor(Math.random() * SPEED_BOOST_QUIPS.length)];
      this.showCallout(quip, '#f59e0b');
    } else if (type === 'magnet') {
      this.magnetDuration = getPowerUpDuration(this.profile, 'magnet');
      this.magnetTimer = this.magnetDuration;
      this.showCallout('UPI COIN MAGNET!', '#ef4444');
    } else if (type === 'drone') {
      this.droneDuration = getPowerUpDuration(this.profile, 'drone');
      this.droneTimer = this.droneDuration;
      this.player.droneActive = true;
      this.runnerRig.droneMount.visible = true;
      this.invincibilityTimer = Math.max(this.invincibilityTimer, this.droneDuration + 1.0);
      this.showCallout('BENGALURU TECH DRONE!', '#00f5d4');
      // Spawn immediate aerial coin stream ahead across lanes!
      const lane = this.player.lane;
      for (let i = 0; i < 12; i++) {
        this.pools.spawnToken(
          LANE_POSITIONS[(lane + Math.floor(i / 4)) % 3],
          DRONE_FLIGHT_Y + 0.3,
          -14 - i * 3.6,
        );
      }
    } else if (type === 'sneakers') {
      this.sneakersDuration = getPowerUpDuration(this.profile, 'sneakers');
      this.sneakersTimer = this.sneakersDuration;
      this.player.sneakersActive = true;
      this.runnerRig.sneakersLeft.visible = true;
      this.runnerRig.sneakersRight.visible = true;
      this.showCallout('SUPER SNEAKERS! JUMP ON TRAINS!', '#2dc653');
    } else if (type === 'multiplier') {
      this.multiplierDuration = getPowerUpDuration(this.profile, 'multiplier');
      this.multiplierTimer = this.multiplierDuration;
      this.showCallout('2X SCORE MULTIPLIER!', '#ffd60a');
    } else if (type === 'mystery_box') {
      this.sound.playMysteryBox();
      this.mysteryBoxesCollected++;
      const roll = Math.random();
      if (roll < 0.5) {
        const bonus = 60 + Math.floor(Math.random() * 5) * 15;
        this.mysteryBonusTokens += bonus;
        this.lastMysteryRewardLabel = `+${bonus} Bonus Metro Tokens!`;
        this.showCallout(`MYSTERY BOX: +${bonus} TOKENS!`, '#c084fc');
      } else if (roll < 0.8) {
        this.hoverboardCooldown = 0;
        this.mysteryBonusTokens += 35;
        this.lastMysteryRewardLabel = 'Instant Hoverboard Charge + 35 Tokens!';
        this.showCallout('MYSTERY BOX: BOARD CHARGED!', '#c084fc');
      } else {
        this.multiplierDuration = getPowerUpDuration(this.profile, 'multiplier');
        this.multiplierTimer = Math.max(this.multiplierTimer, this.multiplierDuration);
        this.mysteryBonusTokens += 40;
        this.lastMysteryRewardLabel = '2x Multiplier Surge + 40 Tokens!';
        this.showCallout('MYSTERY BOX: 2X SURGE + 40!', '#ffd60a');
      }
    }
    this.emitHud();
  }

  /**
   * Fixed-timestep deterministic simulation step (`FIXED_DT = 1 / 120s`).
   * Zero allocations, zero disposals.
   */
  private stepFixedSimulation(dt: number): void {
    this.runTime += dt;

    // Power-up timers
    if (this.kaapiTimer > 0) {
      this.kaapiTimer = Math.max(0, this.kaapiTimer - dt);
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    }
    if (this.droneTimer > 0) {
      this.droneTimer = Math.max(0, this.droneTimer - dt);
      if (this.droneTimer === 0) {
        this.player.droneActive = false;
        this.runnerRig.droneMount.visible = false;
        this.invincibilityTimer = Math.max(this.invincibilityTimer, 1.15);
        this.clearHazardsInRadius(22);
      }
    }
    if (this.sneakersTimer > 0) {
      this.sneakersTimer = Math.max(0, this.sneakersTimer - dt);
      if (this.sneakersTimer === 0) {
        this.player.sneakersActive = false;
        this.runnerRig.sneakersLeft.visible = false;
        this.runnerRig.sneakersRight.visible = false;
      }
    }
    if (this.multiplierTimer > 0) {
      this.multiplierTimer = Math.max(0, this.multiplierTimer - dt);
    }
    if (this.hoverboardTimer > 0) {
      this.hoverboardTimer = Math.max(0, this.hoverboardTimer - dt);
      if (this.hoverboardTimer === 0) {
        this.runnerRig.hoverboardMount.visible = false;
        this.player.activeBoardPerk = null;
        this.hoverboardCooldown = HOVERBOARD_COOLDOWN;
      }
    } else if (this.hoverboardCooldown > 0) {
      this.hoverboardCooldown = Math.max(0, this.hoverboardCooldown - dt);
    }
    if (this.invincibilityTimer > 0) {
      this.invincibilityTimer = Math.max(0, this.invincibilityTimer - dt);
    }
    if (this.chaserTimer > 0) {
      this.chaserTimer = Math.max(0, this.chaserTimer - dt);
    }
    if (this.headstartActive && this.distance >= this.headstartTargetDist) {
      this.headstartActive = false;
      this.invincibilityTimer = Math.max(this.invincibilityTimer, 1.35);
      this.clearHazardsInRadius(24);
      this.emitHud();
    }

    // Speed & Distance progression
    const speed = getRunSpeed(this.distance, this.kaapiTimer > 0, this.headstartActive);
    const forwardStep = speed * dt;
    this.distance += forwardStep * 0.45;
    const baseMult = getEffectiveMultiplier(this.profile);
    const effectiveMult = this.multiplierTimer > 0 ? baseMult * 2 : baseMult;
    this.score += forwardStep * 0.45 * effectiveMult * (this.kaapiTimer > 0 || this.headstartActive ? 1.5 : 1);

    // Dynamic weather cycling
    const targetWeather = this.weatherOverride ?? getWeatherForDistance(this.distance, this.zone);
    if (targetWeather !== this.weather) {
      this.weather = targetWeather;
      if (this.zone === 'elevated') {
        if (targetWeather === 'heavy_monsoon') {
          this.showCallout('HEAVY MONSOON! SLIPPERY TRACKS!', '#38bdf8');
        } else if (targetWeather === 'light_rain') {
          this.showCallout('BENGALURU DRIZZLE!', '#7dd3fc');
        } else {
          this.showCallout('CLEAR SKIES AHEAD!', '#ffd60a');
        }
      }
      this.emitHud();
    }

    // Advance hazards & populate support boxes scratch array (zero allocation)
    this.supportsScratch.length = 0;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.prevZCenter = h.zCenter;
      h.prevZStart = h.zStart;
      h.prevZEnd = h.zEnd;

      const stepZ = forwardStep + h.speedOffset * dt;
      h.zCenter += stepZ;
      h.zStart += stepZ;
      h.zEnd += stepZ;

      if (h.zEnd > 18) {
        if (h.trainSlot) this.pools.releaseTrain(h.trainSlot);
        if (h.obstacleSlot) this.pools.releaseObstacle(h.obstacleSlot);
        this.hazards.splice(i, 1);
        continue;
      }

      if (h.kind.startsWith('train')) {
        this.supportsScratch.push({
          lane: h.lane,
          zStart: h.zStart - (h.rampLength ?? 0),
          zEnd: h.zEnd,
          topY: TRAIN_ROOF_Y,
          isRamp: h.kind === 'train_ramp',
          rampStartZ: h.kind === 'train_ramp' ? h.zStart : undefined,
          rampEndZ: h.kind === 'train_ramp' ? h.zStart - (h.rampLength ?? 5.4) : undefined,
        });
      }
    }

    // Step player kinematics
    this.player.activeBoardPerk = this.getActiveBoardPerk();
    const ev = stepPlayerPhysics(this.player, dt, this.supportsScratch, this.weather);
    if (ev.jumped) {
      const boosted = this.player.sneakersActive || this.player.activeBoardPerk === 'super_jump';
      this.sound.playJump(boosted || ev.doubleJumped);
      if (boosted || ev.doubleJumped) {
        this.pools.spawnBurst(this.player.x, this.player.y + 0.15, 0, boosted ? 0x2dc653 : 0x00f5d4, 7, 4.2);
      }
    }
    if (ev.slammed) {
      this.sound.playFastFallThud();
    } else if (ev.rolled) {
      this.sound.playRoll();
    }
    if (ev.landed) {
      this.pools.spawnBurst(this.player.x, this.player.y + 0.08, 0, 0xe2e8f0, 5, 3.0);
    }
    if (ev.switchedLane !== 0) {
      this.sound.playWhoosh(ev.switchedLane > 0 ? 1.08 : 0.92);
    }

    // Advance & collect instanced tokens
    this.pools.updateTokens(
      dt,
      forwardStep,
      this.time,
      this.player.x,
      this.player.y,
      this.magnetTimer > 0,
      (tx, ty) => {
        this.runTokens++;
        this.score += 12 * effectiveMult;
        this.sound.playToken();
        this.pools.spawnBurst(tx, ty, 0, 0xffd60a, 5, 3.4);
      },
    );

    // Advance & collect pooled power-ups
    for (let i = 0; i < this.pools.powerUps.length; i++) {
      const p = this.pools.powerUps[i];
      if (!p.inUse) continue;
      p.z += forwardStep;
      if (p.z > 12) {
        this.pools.releasePowerUp(p);
        continue;
      }
      const px = LANE_POSITIONS[p.lane];
      p.rig.root.position.set(px, p.baseY + Math.sin(this.time * 4.2 + p.z * 0.2) * 0.22, p.z);
      p.rig.spinGroup.rotation.y += dt * 2.7;

      const dx = Math.abs(px - this.player.x);
      const dy = Math.abs(p.baseY - (this.player.y + 1.05));
      if (dx < 1.35 && dy < 1.85 && Math.abs(p.z) < 1.5) {
        const pickedType = p.type;
        this.pools.spawnBurst(px, p.baseY, 0, 0x00f5d4, 12, 6.2);
        this.pools.releasePowerUp(p);
        this.collectPowerUp(pickedType);
      }
    }

    // Early authentic BMRCL "Next station" announcement well ahead of the first station (Indiranagar)
    if (!this.initialNextStationAnnounced && this.distance >= 40) {
      this.initialNextStationAnnounced = true;
      const firstStation = ELEVATED_STATIONS[0];
      this.currentStation = firstStation;
      this.stationBannerKind = 'next';
      this.stationBannerTimer = 3.4;
      this.sound.playStationChime(firstStation.nameEn);
      this.emitHud();
    }

    // Advance pooled stations: entering shows "ARRIVING AT" (no "Next station" speech);
    // departing announces "Next station, <upcoming>" for the station ahead!
    for (let i = 0; i < this.pools.stations.length; i++) {
      const st = this.pools.stations[i];
      if (!st.inUse || !st.station) continue;
      st.z += forwardStep;
      st.rig.root.position.z = st.z;
      if (!st.announced && st.z >= -24) {
        st.announced = true;
        this.currentStation = st.station;
        this.stationBannerKind = 'arriving';
        this.lastStationName = st.station.nameEn;
        this.stationBannerTimer = 2.4;
        this.stationsPassed++;
        this.emitHud();
      }
      if (!st.departed && st.z >= 14) {
        st.departed = true;
        const nextZone: ZoneMode =
          this.nextStationDistance >= this.nextZoneSwitchDistance
            ? this.spawnedZone === 'elevated'
              ? 'underground'
              : 'elevated'
            : this.spawnedZone;
        const upcomingIdx = nextZone === 'elevated' ? this.elevatedIdx : this.undergroundIdx;
        const nextSt = getNextUpcomingStation(st.station.id, nextZone, upcomingIdx);
        this.currentStation = nextSt;
        this.stationBannerKind = 'next';
        this.stationBannerTimer = 3.4;
        this.sound.playStationChime(nextSt.nameEn);
        this.emitHud();
      }
      if (st.z > 42) {
        this.pools.releaseStation(st);
      }
    }

    // Advance pooled tunnel portals
    for (let i = 0; i < this.pools.portals.length; i++) {
      const po = this.pools.portals[i];
      if (!po.inUse) continue;
      po.z += forwardStep;
      po.mesh.position.z = po.z;
      if (!po.passed && po.z >= 0) {
        po.passed = true;
        this.applyZoneVisuals(po.targetZone);
        this.showCallout(
          po.targetZone === 'underground'
            ? 'ENTERING MAJESTIC TUNNEL!'
            : 'BACK ON ELEVATED VIADUCT!',
          po.targetZone === 'underground' ? '#c084fc' : '#2dc653',
        );
        this.emitHud();
      }
      if (po.z > 30) {
        this.pools.releasePortal(po);
      }
    }

    // Advance chunk stream anchor & spawn ahead cleanly within fog horizon
    this.nextChunkZ += forwardStep;
    while (this.nextChunkZ > -104) {
      this.spawnNextChunk();
    }

    // Evaluate hazard collisions
    const invincible =
      this.invincibilityTimer > 0 ||
      this.kaapiTimer > 0 ||
      this.droneTimer > 0 ||
      this.headstartActive;
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      const outcome = evaluateHazardInteraction(
        {
          playerX: this.player.x,
          playerY: this.player.y,
          playerRolling: this.player.rolling,
          invincible,
          hoverboardActive: this.hoverboardTimer > 0,
          chaserClose: this.chaserTimer > 0,
        },
        h,
      );

      if (outcome === 'none') continue;

      if (outcome === 'close_call') {
        h.closeCallTriggered = true;
        this.closeCalls++;
        this.score += 55 * effectiveMult;
        this.sound.playCloseCall();
        const quip = CLOSE_CALL_QUIPS[Math.floor(Math.random() * CLOSE_CALL_QUIPS.length)];
        this.showCallout(quip, '#ffd60a');
        this.emitHud();
      } else if (outcome === 'shield_break') {
        // Subway Surfers Hoverboard Crash Shield: 25m shockwave blast clears nearby hazards + 1.25s i-frames!
        this.hoverboardTimer = 0;
        this.hoverboardCooldown = HOVERBOARD_COOLDOWN;
        this.runnerRig.hoverboardMount.visible = false;
        this.player.activeBoardPerk = null;
        this.invincibilityTimer = 1.25;
        this.shakeTime = 0.34;
        this.shakeIntensity = 0.55;
        this.sound.playShockwave();
        this.pools.triggerShockwave(this.player.x, this.player.y + 0.3, this.getActiveBoardGlowColor());
        this.clearHazardsInRadius(25);
        this.showCallout('HOVERBOARD SHOCKWAVE SAVED YOU!', '#00f5d4');
        this.emitHud();
        break;
      } else if (outcome === 'stumble') {
        // Side-bump stumble: push back toward safe lane, Inspector & street dog surge right behind for 8s!
        this.player.lane = this.player.lastSafeLane;
        this.player.laneFromX = this.player.x;
        this.player.laneTargetX = LANE_POSITIONS[this.player.lane];
        this.player.laneTransitionElapsed = 0;
        this.player.laneTransitionDuration = 0.12;
        this.chaserTimer = STUMBLE_CHASE_WINDOW;
        this.invincibilityTimer = 0.65;
        this.shakeTime = 0.24;
        this.shakeIntensity = 0.38;
        this.sound.playStumble();
        this.pools.spawnBurst(this.player.x, this.player.y + 1.0, 0, 0xf59e0b, 10, 5.5);
        this.showCallout('CAREFUL! INSPECTOR ON YOUR TAIL!', '#f97316');
        this.emitHud();
        break;
      } else if (outcome === 'crash') {
        this.triggerGameOver();
        break;
      }
    }

    // Chaser pursuit position
    this.prevChaserZ = this.chaserZ;
    const targetChaserZ = this.chaserTimer > 0 ? 2.45 : 9.8;
    this.chaserZ += (targetChaserZ - this.chaserZ) * (1 - Math.exp(-5.5 * dt));

    // Scroll static instanced environment & VFX
    this.updateStaticScenery(forwardStep);
    this.pools.updateSparks(dt, forwardStep);
    this.pools.updateShockwave(dt);
    const ribbonActive =
      this.hoverboardTimer > 0 || this.droneTimer > 0 || this.kaapiTimer > 0 || this.headstartActive;
    const ribbonColor =
      this.kaapiTimer > 0 || this.headstartActive
        ? 0xffd60a
        : this.droneTimer > 0
          ? 0x00f5d4
          : this.getActiveBoardGlowColor();
    this.pools.updateRibbon(
      dt,
      forwardStep,
      ribbonActive,
      this.player.x,
      this.player.y + (this.droneTimer > 0 ? 0.9 : 0.28),
      ribbonColor,
    );
  }

  private triggerGameOver(): void {
    this.mode = 'gameover';
    this.crashTimer = 0;
    this.shakeTime = 0.42;
    this.shakeIntensity = 0.72;
    this.sound.stopMusic();
    this.sound.playCrash();
    this.pools.spawnBurst(this.player.x, this.player.y + 1.1, 0, 0xef4444, 18, 7.5);
    this.gameOverQuip = GAME_OVER_QUIPS[Math.floor(Math.random() * GAME_OVER_QUIPS.length)];

    const summary: RunSummary = {
      score: Math.round(this.score),
      distance: Math.round(this.distance),
      tokensCollected: this.runTokens,
      stationsPassed: this.stationsPassed,
      kaapiUsed: this.kaapiUsed,
      closeCalls: this.closeCalls,
      mysteryBoxes: this.mysteryBoxesCollected > 0 ? this.mysteryBoxesCollected : undefined,
      mysteryBonusTokens: this.mysteryBonusTokens > 0 ? this.mysteryBonusTokens : undefined,
      mysteryRewardLabel: this.lastMysteryRewardLabel || undefined,
    };
    this.runSummary = summary;
    this.emitHud();
    this.onRunEnd(summary);
  }

  /**
   * Renders interpolated transforms & expressive Subway Surfers/Fortnite procedural
   * biomechanics for the runner, Metro Inspector + street dog, trains, sky, and camera.
   */
  private updateVisuals(frameDt: number, alpha: number): void {
    // Smooth world curvature sweeping gently left/right across Bengaluru districts!
    const curveBend =
      this.mode === 'title'
        ? 0.0005
        : Math.sin(this.distance * 0.0042) * 0.00115;
    this.uniforms.uCurveX.value += (curveBend - this.uniforms.uCurveX.value) * Math.min(1, frameDt * 2.2);
    // Positive uCurveY subtracts (uCurveY * dz^2) in vertex shader -> gentle downward Subway Surfers horizon drop!
    this.uniforms.uCurveY.value = 0.00068;

    // Smooth sky & rain weather transition
    this.updateSkyAndLightingForWeather(Math.min(1, frameDt * 2.6));
    this.pools.updateRain(frameDt, this.rainIntensity, this.player.x, this.zone === 'underground');

    // Sync interpolated hazard transforms
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      const interpZ = lerpNumber(h.prevZCenter, h.zCenter, alpha);
      const laneX = LANE_POSITIONS[h.lane];
      if (h.trainSlot) {
        h.trainSlot.mesh.position.set(laneX, 0, interpZ);
      } else if (h.obstacleSlot) {
        h.obstacleSlot.mesh.position.set(laneX, 0, interpZ);
      }
    }

    if (this.mode === 'title') {
      this.animateLobby(frameDt);
      return;
    }

    const interpX = lerpNumber(this.player.prevX, this.player.x, alpha);
    const interpY = lerpNumber(this.player.prevY, this.player.y, alpha);
    const interpChaserZ = lerpNumber(this.prevChaserZ, this.chaserZ, alpha);

    // Update tight player-tracking directional shadow frustum
    if (this.sunLight.castShadow) {
      this.sunLight.position.set(interpX + 16, 32, 10);
      this.sunLight.target.position.set(interpX, 0, -16);
      this.sunLight.target.updateMatrixWorld();
    }

    this.animateRunner(frameDt, interpX, interpY);
    this.animateChaser(frameDt, interpX, interpChaserZ);
    this.updateCamera(frameDt, interpX, interpY);
  }

  private animateLobby(dt: number): void {
    const t = this.time;
    this.runnerRig.root.position.set(0, Math.sin(t * 2.5) * 0.03, 0);
    this.runnerRig.root.rotation.set(0, Math.PI + Math.sin(t * 0.8) * 0.16, 0);
    this.runnerRig.bodyGroup.position.y = 0;
    this.runnerRig.bodyGroup.rotation.set(0, 0, 0);
    this.runnerRig.torsoGroup.rotation.set(0, Math.sin(t * 1.4) * 0.08, 0);
    this.runnerRig.headGroup.rotation.set(Math.sin(t * 1.6) * 0.06, Math.sin(t * 1.1) * 0.14, 0);
    this.runnerRig.leftLeg.rotation.set(0, 0, 0);
    this.runnerRig.rightLeg.rotation.set(0, 0, 0);
    this.runnerRig.leftShin.rotation.set(0, 0, 0);
    this.runnerRig.rightShin.rotation.set(0, 0, 0);

    if (this.lobbyWaveTimer > 0) {
      this.lobbyWaveTimer = Math.max(0, this.lobbyWaveTimer - dt);
      this.runnerRig.rightArm.rotation.set(0, 0, -2.55 + Math.sin(t * 16) * 0.25);
      this.runnerRig.rightForearm.rotation.set(0, 0, -0.35);
    } else {
      this.runnerRig.rightArm.rotation.set(0.08, 0, -0.14 + Math.sin(t * 2.2) * 0.04);
      this.runnerRig.rightForearm.rotation.set(-0.22, 0, 0);
    }
    this.runnerRig.leftArm.rotation.set(-0.06, 0, 0.14 - Math.sin(t * 2.2) * 0.04);
    this.runnerRig.leftForearm.rotation.set(-0.2, 0, 0);

    // Animate Inspector & street dog idling visibly on the viaduct beside the hero
    this.chaserRig.root.visible = true;
    this.chaserRig.root.position.set(2.4, 0, -2.5);
    this.chaserRig.root.rotation.set(0, Math.PI - 0.35 + Math.sin(t * 1.2) * 0.1, 0);
    this.chaserRig.dogTail.rotation.z = Math.sin(t * 12) * 0.42;
    this.chaserRig.dogGroup.position.y = Math.abs(Math.sin(t * 4.5)) * 0.06;

    // Heroic angled lobby camera showing character, parked BEML Purple Line train, viaduct & sky!
    const angle = Math.sin(t * 0.35) * 0.24;
    this.camera.position.set(
      Math.sin(angle) * this.framing.lobbyRadius + 0.85,
      this.framing.lobbyY,
      Math.cos(angle) * this.framing.lobbyRadius,
    );
    _camLook.set(-0.35, this.framing.lobbyLookY, -2.4);
    this.camera.lookAt(_camLook);

    const targetFov = this.framing.fov;
    if (Math.abs(this.currentFov - targetFov) > 0.01) {
      this.currentFov = targetFov;
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private animateRunner(dt: number, x: number, y: number): void {
    const rig = this.runnerRig;
    const isGameOver = this.mode === 'gameover';
    rig.root.position.set(x, y, 0);

    // Grounded contact shadow stays cleanly anchored to track or train roof below runner
    const shadowHeight = Math.max(0, y);
    rig.contactShadow.position.y = -shadowHeight + 0.03;
    const shadowScale = Math.max(0.32, 1 - shadowHeight * 0.14);
    rig.contactShadow.scale.setScalar(shadowScale);

    // Invincibility blink
    if (this.invincibilityTimer > 0 && this.droneTimer <= 0 && !this.headstartActive && this.kaapiTimer <= 0) {
      rig.bodyGroup.visible = Math.floor(this.time * 18) % 2 === 0;
    } else {
      rig.bodyGroup.visible = true;
    }

    if (isGameOver) {
      this.crashTimer = Math.min(1, this.crashTimer + dt * 2.4);
      rig.bodyGroup.rotation.set(-this.crashTimer * 1.15, 0, this.crashTimer * 0.4);
      rig.bodyGroup.position.y = 0.25 * (1 - this.crashTimer);
      return;
    }

    const bankZ = Math.max(-0.36, Math.min(0.36, -this.player.vx * 0.016));
    rig.root.scale.set(this.player.scaleX, this.player.scaleY, this.player.scaleZ);

    // Drone flying pose
    if (this.droneTimer > 0) {
      rig.bodyGroup.position.y = 0.1 + Math.sin(this.time * 8) * 0.08;
      rig.bodyGroup.rotation.set(0.38, 0, bankZ * 1.3);
      rig.torsoGroup.rotation.set(0.12, 0, 0);
      rig.leftArm.rotation.set(-0.45, 0, 0.35);
      rig.rightArm.rotation.set(-0.45, 0, -0.35);
      rig.leftLeg.rotation.set(0.35, 0, 0);
      rig.rightLeg.rotation.set(0.5, 0, 0);
      rig.leftShin.rotation.set(0.4, 0, 0);
      rig.rightShin.rotation.set(0.55, 0, 0);
      for (let i = 0; i < rig.droneRotors.length; i++) {
        rig.droneRotors[i].rotation.y += dt * 36;
      }
      return;
    }

    // Sideways hoverboard surfing stance + dynamic carve banking!
    if (this.hoverboardTimer > 0) {
      const hoverBob = Math.sin(this.time * 10) * 0.06;
      rig.hoverboardMount.position.set(0, hoverBob, 0);
      rig.hoverboardMount.rotation.set(0, 0, bankZ * 1.35);
      rig.bodyGroup.position.set(0, 0.32 + hoverBob, 0);
      rig.bodyGroup.rotation.set(0.08, 0.55, bankZ * 1.25);
      rig.torsoGroup.rotation.set(0.14, -0.35, 0);
      rig.leftArm.rotation.set(0.1, 0, 0.65);
      rig.rightArm.rotation.set(-0.1, 0, -0.65);
      rig.leftForearm.rotation.set(-0.25, 0, 0);
      rig.rightForearm.rotation.set(-0.25, 0, 0);
      rig.leftLeg.rotation.set(-0.22, 0, 0.15);
      rig.rightLeg.rotation.set(0.22, 0, -0.15);
      rig.leftShin.rotation.set(0.3, 0, 0);
      rig.rightShin.rotation.set(0.28, 0, 0);
      return;
    }

    // Tucked barrel roll!
    if (this.player.rolling) {
      const rollProgress = 1 - this.player.rollTimer / 0.62;
      rig.bodyGroup.position.y = 0.42;
      rig.bodyGroup.rotation.set(-rollProgress * Math.PI * 2, 0, bankZ * 0.5);
      rig.leftLeg.rotation.set(-0.9, 0, 0);
      rig.rightLeg.rotation.set(-0.9, 0, 0);
      rig.leftShin.rotation.set(1.2, 0, 0);
      rig.rightShin.rotation.set(1.2, 0, 0);
      rig.leftArm.rotation.set(-0.85, 0, 0.25);
      rig.rightArm.rotation.set(-0.85, 0, -0.25);
      return;
    }

    // Mid-air athletic jump tuck
    if (!this.player.grounded) {
      const rise = Math.max(-1, Math.min(1, this.player.vy / 18));
      rig.bodyGroup.position.y = 0;
      rig.bodyGroup.rotation.set(0.18 - rise * 0.14, 0, bankZ);
      rig.torsoGroup.rotation.set(0.16, 0, 0);
      rig.leftArm.rotation.set(-0.95 - rise * 0.35, 0, 0.35);
      rig.rightArm.rotation.set(-0.75 - rise * 0.35, 0, -0.35);
      rig.leftForearm.rotation.set(-0.6, 0, 0);
      rig.rightForearm.rotation.set(-0.6, 0, 0);
      rig.leftLeg.rotation.set(-0.82, 0, 0);
      rig.rightLeg.rotation.set(0.32, 0, 0);
      rig.leftShin.rotation.set(1.15, 0, 0);
      rig.rightShin.rotation.set(0.55, 0, 0);
      return;
    }

    // Expressive Subway Surfers sprint cycle with pelvis bob, shoulder/hip twist, and knee/elbow snap
    const cadence = this.kaapiTimer > 0 || this.headstartActive ? 22 : 16.5;
    const cycle = this.time * cadence;
    const swing = Math.sin(cycle);
    const cosSwing = Math.cos(cycle);

    rig.bodyGroup.position.y = Math.abs(cosSwing) * 0.11;
    rig.bodyGroup.rotation.set(0.16, 0, bankZ);
    rig.torsoGroup.rotation.set(0.12, swing * 0.16, -swing * 0.05);
    rig.headGroup.rotation.set(-0.08, -swing * 0.1, 0);

    rig.leftLeg.rotation.set(swing * 0.92, 0, 0);
    rig.rightLeg.rotation.set(-swing * 0.92, 0, 0);
    rig.leftShin.rotation.set(Math.max(0.08, -cosSwing * 0.95 + 0.38), 0, 0);
    rig.rightShin.rotation.set(Math.max(0.08, cosSwing * 0.95 + 0.38), 0, 0);

    rig.leftArm.rotation.set(-swing * 0.85, 0, 0.14);
    rig.rightArm.rotation.set(swing * 0.85, 0, -0.14);
    rig.leftForearm.rotation.set(-0.75 - Math.max(0, -swing) * 0.45, 0, 0);
    rig.rightForearm.rotation.set(-0.75 - Math.max(0, swing) * 0.45, 0, 0);
  }

  private animateChaser(dt: number, playerX: number, chaserZ: number): void {
    const visible = chaserZ < 8.8 || this.mode === 'gameover';
    this.chaserRig.root.visible = visible;
    if (!visible) return;

    const targetX = playerX * 0.88;
    const currX = this.chaserRig.root.position.x;
    this.chaserRig.root.position.set(
      currX + (targetX - currX) * Math.min(1, dt * 8.5),
      0,
      this.mode === 'gameover' ? 1.55 : chaserZ,
    );
    this.chaserRig.root.rotation.set(0, 0, 0);

    const c = this.time * 15;
    const s = Math.sin(c);
    this.chaserRig.inspectorBody.position.y = Math.abs(Math.cos(c)) * 0.09;
    this.chaserRig.leftLeg.rotation.x = s * 0.78;
    this.chaserRig.rightLeg.rotation.x = -s * 0.78;
    this.chaserRig.leftArm.rotation.x = -s * 0.72;
    this.chaserRig.rightArm.rotation.x = s * 0.72;

    // Animated playful Bengaluru street dog galloping alongside the Inspector
    const dogCycle = this.time * 19;
    this.chaserRig.dogGroup.position.y = Math.abs(Math.sin(dogCycle)) * 0.14;
    this.chaserRig.dogGroup.rotation.x = Math.cos(dogCycle) * 0.12;
    this.chaserRig.dogTail.rotation.z = Math.sin(dogCycle * 1.4) * 0.55;
    for (let i = 0; i < this.chaserRig.dogLegs.length; i++) {
      const phase = i === 0 ? 0 : Math.PI;
      this.chaserRig.dogLegs[i].rotation.x = Math.sin(dogCycle + phase) * 0.85;
    }
  }

  private updateCamera(dt: number, playerX: number, playerY: number): void {
    // Silky 0.65s lobby-to-chase camera transition when starting a run!
    if (this.lobbyTransition < 1) {
      this.lobbyTransition = Math.min(1, this.lobbyTransition + dt / 0.65);
    }
    const ease = 1 - Math.pow(1 - this.lobbyTransition, 3);

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      const decay = this.shakeTime * 2.8;
      shakeX = (Math.random() - 0.5) * this.shakeIntensity * decay;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity * decay;
    }

    const droneBoost = this.droneTimer > 0 ? 1.85 : 0;
    const boostPull = this.kaapiTimer > 0 || this.headstartActive ? 0.65 : 0;

    _chaseCamPos.set(
      playerX * 0.64 + shakeX,
      this.framing.chaseY + playerY * 0.58 + droneBoost + shakeY,
      this.framing.chaseZ + boostPull,
    );
    _chaseLookPos.set(playerX * 0.38, 1.8 + playerY * 0.48 + droneBoost * 0.4, -14.5);

    if (ease < 1) {
      _lobbyCamPos.set(0.85, this.framing.lobbyY, this.framing.lobbyRadius);
      _lobbyLookPos.set(-0.35, this.framing.lobbyLookY, -2.4);
      _camTarget.lerpVectors(_lobbyCamPos, _chaseCamPos, ease);
      _camLook.lerpVectors(_lobbyLookPos, _chaseLookPos, ease);
      this.camera.position.copy(_camTarget);
      this.camera.lookAt(_camLook);
    } else {
      const followAlpha = 1 - Math.exp(-11.5 * dt);
      this.camera.position.lerp(_chaseCamPos, followAlpha);
      this.camera.lookAt(_chaseLookPos);
    }

    // Dynamic FOV punch on Filter Kaapi Overdrive / Headstart / Drone — only call updateProjectionMatrix when changed!
    const targetFov =
      this.framing.fov +
      (this.headstartActive ? 13 : this.kaapiTimer > 0 ? 9.5 : this.droneTimer > 0 ? 5.5 : 0);
    const nextFov = this.currentFov + (targetFov - this.currentFov) * Math.min(1, dt * 6);
    if (Math.abs(nextFov - this.currentFov) > 0.01) {
      this.currentFov = nextFov;
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private buildActivePowerUpsList(): ActivePowerUpState[] {
    this.activePowerUpsScratch.length = 0;
    if (this.hoverboardTimer > 0) {
      this.activePowerUpsScratch.push({
        type: 'hoverboard',
        remaining: this.hoverboardTimer,
        duration: this.hoverboardDuration,
      });
    }
    if (this.kaapiTimer > 0) {
      this.activePowerUpsScratch.push({
        type: 'kaapi',
        remaining: this.kaapiTimer,
        duration: this.kaapiDuration,
      });
    }
    if (this.magnetTimer > 0) {
      this.activePowerUpsScratch.push({
        type: 'magnet',
        remaining: this.magnetTimer,
        duration: this.magnetDuration,
      });
    }
    if (this.droneTimer > 0) {
      this.activePowerUpsScratch.push({
        type: 'drone',
        remaining: this.droneTimer,
        duration: this.droneDuration,
      });
    }
    if (this.sneakersTimer > 0) {
      this.activePowerUpsScratch.push({
        type: 'sneakers',
        remaining: this.sneakersTimer,
        duration: this.sneakersDuration,
      });
    }
    if (this.multiplierTimer > 0) {
      this.activePowerUpsScratch.push({
        type: 'multiplier',
        remaining: this.multiplierTimer,
        duration: this.multiplierDuration,
      });
    }
    return this.activePowerUpsScratch;
  }

  private emitLiveTick(): void {
    if (!this.onLiveTick) return;
    const baseMult = getEffectiveMultiplier(this.profile);
    const multiplierBoosted = this.multiplierTimer > 0;
    const headstartRemaining =
      this.mode === 'playing' && !this.headstartActive
        ? Math.max(0, HEADSTART_WINDOW - this.runTime)
        : 0;

    this.onLiveTick({
      score: Math.round(this.score),
      distance: Math.round(this.distance),
      tokens: this.runTokens,
      multiplier: multiplierBoosted ? baseMult * 2 : baseMult,
      multiplierBoosted,
      hoverboardReady: this.hoverboardTimer === 0 && this.hoverboardCooldown === 0 && this.droneTimer === 0,
      hoverboardActive: this.hoverboardTimer > 0,
      hoverboardCooldownRatio:
        this.hoverboardTimer > 0
          ? this.hoverboardTimer / Math.max(0.1, this.hoverboardDuration)
          : 1 - this.hoverboardCooldown / HOVERBOARD_COOLDOWN,
      headstartRemaining,
      headstartActive: this.headstartActive,
      kaapiActive: this.kaapiTimer > 0,
      activePowerUps: this.buildActivePowerUpsList(),
      fps: Math.round(this.currentFps),
      drawCalls: this.currentDrawCalls,
    });
  }

  private emitHud(): void {
    const baseMult = getEffectiveMultiplier(this.profile);
    const multiplierBoosted = this.multiplierTimer > 0;
    this.onHud({
      mode: this.mode,
      score: Math.round(this.score),
      distance: Math.round(this.distance),
      tokens: this.runTokens,
      multiplier: multiplierBoosted ? baseMult * 2 : baseMult,
      multiplierBoosted,
      zone: this.zone,
      weather: this.weather,
      currentStation: this.currentStation,
      stationBannerVisible: this.stationBannerTimer > 0 && this.currentStation !== null,
      stationBannerKind: this.stationBannerKind,
      activePowerUps: this.buildActivePowerUpsList().map((p) => ({ ...p })),
      hoverboardReady: this.hoverboardTimer === 0 && this.hoverboardCooldown === 0 && this.droneTimer === 0,
      hoverboardCooldownRatio:
        this.hoverboardTimer > 0
          ? this.hoverboardTimer / Math.max(0.1, this.hoverboardDuration)
          : 1 - this.hoverboardCooldown / HOVERBOARD_COOLDOWN,
      hoverboardActive: this.hoverboardTimer > 0,
      kaapiActive: this.kaapiTimer > 0,
      headstartActive: this.headstartActive,
      headstartAvailable: this.mode === 'playing' && !this.headstartActive && this.runTime < HEADSTART_WINDOW,
      chaserClose: this.chaserTimer > 0,
      callout: this.callout,
      voiceOver: null,
      lastStationName: this.lastStationName,
      gameOverQuip: this.gameOverQuip,
      runSummary: this.runSummary,
    });
  }

  private updateAdaptiveResolution(frameDt: number): void {
    if (frameDt <= 0.0005) return;
    const instantFps = Math.min(240, 1 / frameDt);
    this.fpsSamples[this.fpsSampleIdx] = instantFps;
    this.fpsSampleIdx = (this.fpsSampleIdx + 1) % this.fpsSamples.length;
    if (this.fpsSampleCount < this.fpsSamples.length) this.fpsSampleCount++;

    let sum = 0;
    for (let i = 0; i < this.fpsSampleCount; i++) sum += this.fpsSamples[i];
    this.currentFps = sum / Math.max(1, this.fpsSampleCount);

    if (this.isSoftwareGl || this.mode !== 'playing') return;
    if (this.adaptiveCooldown > 0) {
      this.adaptiveCooldown -= frameDt;
      return;
    }
    if (this.fpsSampleCount >= 30 && this.currentFps < 50 && this.adaptiveQualityStep < 2) {
      this.adaptiveQualityStep++;
      this.adaptiveCooldown = 4.0;
      this.applyQualitySettings(this.currentQuality);
    }
  }

  private loop = (nowMs: number): void => {
    if (this.disposed) return;

    const rawDt = Math.max(0, (nowMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = nowMs;
    const frameDt = Math.min(rawDt, MAX_FRAME_DT);
    this.time += frameDt;
    this.updateAdaptiveResolution(rawDt > 0 ? rawDt : 1 / 60);

    // Banner / toast / voice-over UI timers
    let hudEventChanged = false;
    if (this.stationBannerTimer > 0) {
      this.stationBannerTimer = Math.max(0, this.stationBannerTimer - frameDt);
      if (this.stationBannerTimer === 0) hudEventChanged = true;
    }
    if (this.calloutTimer > 0) {
      this.calloutTimer = Math.max(0, this.calloutTimer - frameDt);
      if (this.calloutTimer === 0) {
        this.callout = null;
        hudEventChanged = true;
      }
    }

    // Clamped fixed-timestep accumulator (120Hz physics) for zero-judder 60–144Hz monitors!
    let alpha = 1;
    if (this.mode === 'playing') {
      this.accumulator += frameDt;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < 6) {
        this.stepFixedSimulation(FIXED_DT);
        this.accumulator -= FIXED_DT;
        steps++;
        if (this.mode !== 'playing') {
          this.accumulator = 0;
          break;
        }
      }
      alpha = Math.min(1, this.accumulator / FIXED_DT);
    } else if (this.mode === 'gameover') {
      this.pools.updateSparks(frameDt, 0);
      this.pools.updateShockwave(frameDt);
    }

    this.updateVisuals(frameDt, alpha);
    this.renderer.render(this.scene, this.camera);
    this.currentDrawCalls = this.renderer.info.render.calls;

    // Push live counters straight to DOM refs every frame without React re-renders!
    if (this.mode === 'playing') {
      this.emitLiveTick();
    }

    // Low-frequency structural HUD sync (only when discrete flags or banners change, or 2Hz safety check)
    this.hudSyncTimer += frameDt;
    if (hudEventChanged || (this.mode === 'playing' && this.hudSyncTimer >= 0.5)) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }

    if (this.isSoftwareGl) {
      this.rafId = window.setTimeout(() => this.loop(performance.now()), 120) as unknown as number;
    } else {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.framing = computeCameraFraming(width, height);
    this.camera.aspect = width / height;
    this.camera.fov = this.framing.fov;
    this.currentFov = this.framing.fov;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) {
      if (this.isSoftwareGl) {
        window.clearTimeout(this.rafId);
      } else {
        cancelAnimationFrame(this.rafId);
      }
      this.rafId = null;
    }
    window.removeEventListener('resize', this.boundOnResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.renderer.domElement.removeEventListener('webglcontextlost', this.boundOnContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.boundOnContextRestored);

    this.pools.dispose();
    this.assets.dispose();
    this.skyDome.dispose();
    this.textures.dispose();
    disposeObject3D(this.runnerRig.root);
    disposeObject3D(this.chaserRig.root);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
