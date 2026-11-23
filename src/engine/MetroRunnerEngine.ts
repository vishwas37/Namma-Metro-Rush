import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BILLBOARDS,
  CLOSE_CALL_QUIPS,
  ELEVATED_STATIONS,
  GAME_OVER_QUIPS,
  SPEED_BOOST_QUIPS,
  UNDERGROUND_STATIONS,
  type CharacterId,
  type GraphicsQuality,
  type HoverboardId,
  type MetroStation,
  type PlayerProfile,
  type PowerUpType,
  type WeatherMode,
  type ZoneMode,
} from '../core/catalog';
import {
  DRONE_FLIGHT_Y,
  HOVERBOARD_COOLDOWN,
  LANE_POSITIONS,
  STUMBLE_CHASE_WINDOW,
  TRAIN_ROOF_Y,
  computeCameraFraming,
  createInitialPlayerKinematics,
  evaluateHazardInteraction,
  getEffectiveMultiplier,
  getPowerUpDuration,
  getRunSpeed,
  getWeatherForDistance,
  queuePlayerAction,
  stepPlayerPhysics,
  type CameraFraming,
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
  type VoiceOverPhrase,
} from '../core/voiceOver';
import { SoundEngine } from './sound';
import {
  buildChaserRig,
  buildObstacleMesh,
  buildPowerUpMesh,
  buildRunnerRig,
  buildSkylineBuilding,
  buildStationStructure,
  buildTabebuiaTree,
  buildTokenMesh,
  buildTrainMesh,
  buildTunnelPortal,
  disposeObject3D,
  type RunnerRig,
} from './meshes';
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
  zone: ZoneMode;
  weather: WeatherMode;
  currentStation: MetroStation | null;
  stationBannerVisible: boolean;
  activePowerUps: ActivePowerUpState[];
  hoverboardReady: boolean;
  hoverboardCooldownRatio: number;
  hoverboardActive: boolean;
  kaapiActive: boolean;
  chaserClose: boolean;
  callout: CalloutToast | null;
  voiceOver: ActiveVoiceOver | null;
  lastStationName: string;
  gameOverQuip: string;
  runSummary: RunSummary | null;
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
  dispose(): void;
}

export interface AcquiredWebGL2 {
  canvas: HTMLCanvasElement;
  context: WebGL2RenderingContext;
  antialias: boolean;
}

interface ActiveHazard extends HazardCollider {
  mesh: THREE.Group;
  speedOffset: number;
  active: boolean;
}

interface ActiveToken {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

interface ActivePowerUp {
  mesh: THREE.Group;
  type: PowerUpType;
  lane: number;
  y: number;
  z: number;
  collected: boolean;
}

interface ActiveStation {
  mesh: THREE.Group;
  station: MetroStation;
  z: number;
  announced: boolean;
}

interface ActivePortal {
  mesh: THREE.Group;
  z: number;
  targetZone: ZoneMode;
  passed: boolean;
}

interface BurstParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface WeatherDrop {
  x: number;
  y: number;
  z: number;
  vy: number;
  rot: number;
}

const _dummy = new THREE.Object3D();
const _colScratch = new THREE.Color();
const _targetSky = new THREE.Color();
const _targetFog = new THREE.Color();
const _elevatedSky = new THREE.Color(0x69c7f8);
const _lightRainSky = new THREE.Color(0x6888ab);
const _heavyMonsoonSky = new THREE.Color(0x283a54);
const _undergroundSky = new THREE.Color(0x0d081a);

function readWeatherOverride(): WeatherMode | null {
  if (typeof window === 'undefined') return null;
  const w = new URLSearchParams(window.location.search).get('weather');
  if (w === 'sunny' || w === 'light_rain' || w === 'heavy_monsoon') return w;
  return null;
}

function isSoftwareContext(gl: WebGLRenderingContext | WebGL2RenderingContext | null): boolean {
  if (!gl) return true;
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

/**
 * Acquires a WebGL2 context directly on a fresh canvas BEFORE instantiating
 * THREE.WebGLRenderer so broken Mesa/ANGLE/llvmpipe drivers (e.g. BindToCurrentSequence
 * failures) never trigger Three.js's internal console.error spam and can cleanly fall
 * back to Canvas2DRunnerEngine.
 */
export function acquireWebGL2Context(preferAntialias: boolean): AcquiredWebGL2 | null {
  if (typeof document === 'undefined') return null;

  const attempts: Array<{ antialias: boolean; powerPreference?: WebGLPowerPreference }> = [
    { antialias: preferAntialias, powerPreference: 'default' },
    { antialias: false },
  ];

  for (const attempt of attempts) {
    try {
      const canvas = document.createElement('canvas');
      const attrs: WebGLContextAttributes = {
        antialias: attempt.antialias,
        alpha: false,
        depth: true,
        stencil: false,
        failIfMajorPerformanceCaveat: false,
        ...(attempt.powerPreference ? { powerPreference: attempt.powerPreference } : {}),
      };
      const gl = canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null;
      if (gl && !gl.isContextLost()) {
        return { canvas, context: gl, antialias: attempt.antialias };
      }
    } catch {
      // Quietly proceed to fallback attempt
    }
  }
  return null;
}

export class MetroRunnerEngine implements RunnerEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private framing: CameraFraming;
  private textures: TextureLibrary;
  private sound: SoundEngine;
  private isSoftwareGl: boolean;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private tunnelLight: THREE.PointLight;
  private fog: THREE.Fog;

  private runnerRig: RunnerRig;
  private chaserRig: ReturnType<typeof buildChaserRig>;
  private player: PlayerKinematics = createInitialPlayerKinematics();
  private currentCharId: CharacterId;
  private currentBoardId: HoverboardId;
  private profile: PlayerProfile;

  private trackSegments: THREE.Group[] = [];
  private deckMat: THREE.MeshStandardMaterial | null = null;
  private tunnelRings: THREE.Group[] = [];
  private sceneryChunks: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private lobbyTrain: THREE.Group;

  private hazards: ActiveHazard[] = [];
  private tokens: ActiveToken[] = [];
  private powerUps: ActivePowerUp[] = [];
  private stations: ActiveStation[] = [];
  private portals: ActivePortal[] = [];
  private nextEntityId = 1;

  private particleMesh: THREE.InstancedMesh;
  private particles: BurstParticle[] = [];
  private particleCursor = 0;

  private weatherMesh: THREE.InstancedMesh;
  private weatherDrops: WeatherDrop[] = [];
  private weatherOverride: WeatherMode | null = readWeatherOverride();

  private mode: GameMode = 'title';
  private score = 0;
  private distance = 0;
  private runTokens = 0;
  private stationsPassed = 0;
  private kaapiUsed = 0;
  private closeCalls = 0;
  private lastStationName = 'Indiranagar';
  private gameOverQuip = GAME_OVER_QUIPS[0];
  private runSummary: RunSummary | null = null;

  private zone: ZoneMode = 'elevated';
  private spawnedZone: ZoneMode = 'elevated';
  private weather: WeatherMode = 'sunny';
  private elevatedIdx = 0;
  private undergroundIdx = 0;
  private nextWaveZ = -84;
  private nextStationDist = 210;
  private nextZoneDist = 720;

  private elapsed = 0;
  private lastTs = 0;
  private frameHandle = 0;
  private disposed = false;
  private contextLost = false;
  private hitstopTimer = 0;
  private crashPending = false;
  private crashDelayTimer = 0;
  private cameraTrauma = 0;
  private chaserTimer = 4.2;
  private stumbleGraceTimer = 0;
  private lobbyHopTimer = 0;

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
  private hoverboardTimer = 0;
  private hoverboardDuration = 10.0;
  private hoverboardCooldown = 0;

  private onHud: (hud: HudState) => void;
  private onRunEnd: (summary: RunSummary) => void;
  private lastHudPush = 0;
  private resizeObserver: ResizeObserver | null = null;
  private onWindowResizeBound: () => void;

  constructor(
    container: HTMLElement,
    profile: PlayerProfile,
    sound: SoundEngine,
    onHud: (hud: HudState) => void,
    onRunEnd: (summary: RunSummary) => void,
    preAcquiredWebGL?: AcquiredWebGL2,
  ) {
    this.container = container;
    this.profile = profile;
    this.currentCharId = profile.selectedCharacter;
    this.currentBoardId = profile.selectedHoverboard;
    this.sound = sound;
    this.onHud = onHud;
    this.onRunEnd = onRunEnd;

    const w = Math.max(1, container.clientWidth || window.innerWidth);
    const h = Math.max(1, container.clientHeight || window.innerHeight);
    this.framing = computeCameraFraming(w, h);

    const webgl = preAcquiredWebGL ?? acquireWebGL2Context(profile.quality === 'high');
    if (!webgl) {
      throw new Error('WebGL2 context unavailable on this device.');
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: webgl.canvas,
      context: webgl.context,
      antialias: webgl.antialias,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    });
    this.isSoftwareGl = isSoftwareContext(this.renderer.getContext());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.applyQuality(profile.quality);
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.lastTs = performance.now();
    });

    this.scene = new THREE.Scene();
    this.scene.background = _elevatedSky.clone();
    this.fog = new THREE.Fog(0x88d4fc, 48, 175);
    this.scene.fog = this.fog;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(this.framing.fov, w / h, 0.2, 240);

    this.hemiLight = new THREE.HemisphereLight(0xbbe6ff, 0x4b5563, 1.05);
    this.hemiLight.position.set(0, 40, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4d6, 1.85);
    this.sunLight.position.set(18, 32, 16);
    this.sunLight.castShadow = !this.isSoftwareGl && profile.quality === 'high';
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 90;
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 24;
    this.sunLight.shadow.camera.bottom = -24;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    this.tunnelLight = new THREE.PointLight(0xa855f7, 0, 32, 1.6);
    this.tunnelLight.position.set(0, 5.2, -6);
    this.scene.add(this.tunnelLight);

    this.textures = createTextureLibrary(this.renderer.capabilities.getMaxAnisotropy());

    this.runnerRig = buildRunnerRig(this.currentCharId, this.currentBoardId, this.textures);
    this.scene.add(this.runnerRig.root);

    this.chaserRig = buildChaserRig(this.textures);
    this.chaserRig.root.position.set(0, 0, 3.8);
    this.chaserRig.root.visible = false;
    this.scene.add(this.chaserRig.root);

    this.buildTrackPool();
    this.buildTunnelRingPool();
    this.buildSceneryPool();
    this.buildCloudPool();

    this.lobbyTrain = buildTrainMesh('purple', 24, false, this.textures);
    this.lobbyTrain.position.set(-LANE_POSITIONS[2], 0, -42);
    this.scene.add(this.lobbyTrain);

    // Zero-GC pooled burst particles
    const pCount = 110;
    this.particleMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      pCount,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < pCount; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0,
        color: new THREE.Color(0xffd60a),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _colScratch.setHex(0xffd60a));
    }
    this.scene.add(this.particleMesh);

    // Weather rain particle pool (Light Rain & Heavy Monsoon)
    const wCount = 220;
    this.weatherMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.11, 0.56, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.78 }),
      wCount,
    );
    this.weatherMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.weatherMesh.frustumCulled = false;
    this.weatherMesh.visible = false;
    for (let i = 0; i < wCount; i++) {
      this.weatherDrops.push({
        x: (Math.random() - 0.5) * 32,
        y: Math.random() * 18,
        z: -Math.random() * 55 + 8,
        vy: -7 - Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
      });
    }
    this.scene.add(this.weatherMesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.onWindowResizeBound = () => this.handleResize();
    window.addEventListener('resize', this.onWindowResizeBound);
    window.addEventListener('orientationchange', this.onWindowResizeBound);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }

    // Immediate Frame 0 draw so first paint is never a blank frame
    this.stepLobby(0.016);
    this.renderer.render(this.scene, this.camera);

    this.pushHud(true);
    this.lastTs = performance.now();
    this.startLoop();
  }

  private buildTrackPool(): void {
    const segLen = 30;
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.trackBed,
      roughness: 0.72,
      metalness: 0.14,
    });
    this.deckMat = deckMat;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.72 });
    const trimPurpleMat = new THREE.MeshStandardMaterial({ color: 0x7b2cbf, roughness: 0.35, metalness: 0.2 });
    const trimYellowMat = new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.35, metalness: 0.15 });
    const trimRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38, metalness: 0.15 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.6 });
    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.kannadaFlag,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });

    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.7, segLen), deckMat);
      deck.position.set(0, -0.35, 0);
      deck.receiveShadow = true;
      seg.add(deck);

      for (const sx of [-5.85, 5.85]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.08, segLen), wallMat);
        rail.position.set(sx, 0.36, 0);
        const stripeYellow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, segLen), trimYellowMat);
        stripeYellow.position.set(sx, 0.8, 0);
        const stripeRed = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, segLen), trimRedMat);
        stripeRed.position.set(sx, 0.64, 0);
        const stripePurple = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, segLen), trimPurpleMat);
        stripePurple.position.set(sx, 0.48, 0);
        seg.add(rail, stripeYellow, stripeRed, stripePurple);

        // Festive Karnataka Yellow-Red flag pennants along the elevated viaduct
        if (i % 2 === 0) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.1, 8), poleMat);
          pole.position.set(sx, 2.35, 0);
          const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.96), flagMat);
          flag.position.set(sx + (sx > 0 ? 0.78 : -0.78), 3.3, 0);
          flag.rotation.y = sx > 0 ? -0.25 : 0.25;
          seg.add(pole, flag);
        }
      }

      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.6, 14, 2.2), pierMat);
      pier.position.set(0, -7.7, 0);
      seg.add(pier);

      seg.position.z = 15 - i * segLen;
      this.scene.add(seg);
      this.trackSegments.push(seg);
    }
  }

  private buildTunnelRingPool(): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1b2e, roughness: 0.78 });
    const archMat = new THREE.MeshStandardMaterial({ color: 0x2d2642, roughness: 0.68 });
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x7dd3fc,
      emissiveIntensity: 2.0,
    });
    const neonPurple = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7b2cbf,
      emissiveIntensity: 1.8,
    });
    const exitGreen = new THREE.MeshStandardMaterial({
      color: 0x2dc653,
      emissive: 0x2dc653,
      emissiveIntensity: 2.2,
    });

    const spacing = 24;
    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Group();
      for (const sx of [-6.35, 6.35]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8.6, spacing + 0.4), wallMat);
        wall.position.set(sx, 4.1, 0);
        const neon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, spacing - 1), neonPurple);
        neon.position.set(sx - Math.sign(sx) * 0.34, 3.2, 0);
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.2, 1.1), archMat);
        rib.position.set(sx - Math.sign(sx) * 0.25, 4.1, 0);
        ring.add(wall, neon, rib);
      }
      const ceiling = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.8, spacing + 0.4), wallMat);
      ceiling.position.set(0, 8.4, 0);
      ring.add(ceiling);
      for (const lx of [-2.8, 2.8]) {
        const tube = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 12), stripMat);
        tube.position.set(lx, 7.9, 0);
        ring.add(tube);
      }
      if (i % 2 === 0) {
        const exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 1.3), exitGreen);
        exitSign.position.set(5.98, 2.1, 0);
        ring.add(exitSign);
      }
      ring.position.z = 12 - i * spacing;
      ring.visible = false;
      this.scene.add(ring);
      this.tunnelRings.push(ring);
    }
  }

  private buildSceneryPool(): void {
    const spacing = 36;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.4 });
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2f6b47, roughness: 0.92 });
    const avenueMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 });

    for (let i = 0; i < 7; i++) {
      const chunk = new THREE.Group();

      const road = new THREE.Mesh(new THREE.PlaneGeometry(18, spacing + 2), avenueMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, -9.45, 0);
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 9), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, -9.4, 0);
      chunk.add(road, dash);

      for (const side of [-1, 1]) {
        const park = new THREE.Mesh(new THREE.PlaneGeometry(54, spacing + 2), groundMat);
        park.rotation.x = -Math.PI / 2;
        park.position.set(side * 36, -9.5, 0);
        chunk.add(park);

        const t1 = buildTabebuiaTree();
        t1.position.set(side * (10.5 + (i % 2) * 2.5), -3.2, -6);
        const s1 = 1.05 + (i % 3) * 0.14;
        t1.scale.set(s1, s1, s1);
        const t2 = buildTabebuiaTree();
        t2.position.set(side * 14.5, -4.4, 10);
        t2.scale.set(1.2, 1.24, 1.2);
        chunk.add(t1, t2);

        const variant =
          i === 2 && side === 1
            ? 'vidhana'
            : (i + (side > 0 ? 1 : 0)) % 2 === 0
              ? 'tech'
              : 'apartment';
        const bldg = buildSkylineBuilding(variant, this.textures);
        bldg.position.set(side * (variant === 'vidhana' ? 28 : 22 + (i % 3) * 4), -9.5, -2);
        chunk.add(bldg);
      }

      // BIGGER, FUNNIER PEAK BENGALURU ROADSIDE BILLBOARDS (12.4 x 6.2 units on twin steel pillars!)
      const ad = BILLBOARDS[i % BILLBOARDS.length];
      const bSide = i % 2 === 0 ? -1 : 1;
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1423, roughness: 0.55, metalness: 0.3 });

      const billboardGroup = new THREE.Group();
      billboardGroup.position.set(bSide * 12.2, 0, 2.5);
      billboardGroup.rotation.y = bSide > 0 ? -0.42 : 0.42;

      const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 13.0, 8), poleMat);
      pillarL.position.set(-3.8, -3.0, -0.46);
      const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 13.0, 8), poleMat);
      pillarR.position.set(3.8, -3.0, -0.46);

      const boardTex = this.textures.createBillboard(ad);
      const boardFaceMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: boardTex,
        roughness: 0.45,
        emissive: 0xffffff,
        emissiveMap: boardTex,
        emissiveIntensity: 0.08,
      });
      const board = new THREE.Mesh(new THREE.BoxGeometry(12.4, 6.2, 0.42), [
        frameMat,
        frameMat,
        frameMat,
        frameMat,
        boardFaceMat,
        boardFaceMat,
      ]);
      board.position.set(0, 6.4, 0);
      billboardGroup.add(pillarL, pillarR, board);
      chunk.add(billboardGroup);

      // GIANT OVERHEAD VIADUCT ARCHES & FUNNY SKY-GANTRY ADS (safely above drone & jump height!)
      if (i % 2 === 1) {
        const isKannadaArch = i % 4 === 1;
        const archPillarMat = new THREE.MeshStandardMaterial({
          color: isKannadaArch ? 0xdc2626 : 0x334155,
          roughness: 0.48,
          metalness: 0.32,
        });
        const archTrimMat = new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.38 });
        for (const px of [-6.45, 6.45]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.68, 9.2, 0.68), archPillarMat);
          post.position.set(px, 4.0, -12);
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.0, 0.78), archTrimMat);
          band.position.set(px, 5.8, -12);
          chunk.add(post, band);
        }

        const overheadTex = isKannadaArch
          ? this.textures.kannadaArchSign
          : this.textures.createBillboard(BILLBOARDS[(i + 4) % BILLBOARDS.length]);
        const overheadFace = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: overheadTex,
          roughness: 0.44,
          emissive: 0xffffff,
          emissiveMap: overheadTex,
          emissiveIntensity: 0.08,
        });
        const overheadBoard = new THREE.Mesh(new THREE.BoxGeometry(14.4, 4.3, 0.48), [
          frameMat,
          frameMat,
          frameMat,
          frameMat,
          overheadFace,
          overheadFace,
        ]);
        overheadBoard.position.set(0, 10.75, -12);
        chunk.add(overheadBoard);
      }

      chunk.position.z = 10 - i * spacing;
      this.scene.add(chunk);
      this.sceneryChunks.push(chunk);
    }
  }

  private buildCloudPool(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.25,
    });
    for (let i = 0; i < 8; i++) {
      const cloud = new THREE.Group();
      const c1 = new THREE.Mesh(new THREE.SphereGeometry(2.8, 10, 8), cloudMat);
      const c2 = new THREE.Mesh(new THREE.SphereGeometry(2.1, 10, 8), cloudMat);
      c2.position.set(-2.4, -0.3, 0.3);
      const c3 = new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 8), cloudMat);
      c3.position.set(2.3, -0.4, -0.2);
      cloud.add(c1, c2, c3);
      cloud.position.set((i % 2 === 0 ? -1 : 1) * (14 + (i * 7) % 26), 22 + (i % 3) * 4.5, -20 - i * 20);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  public updateProfile(profile: PlayerProfile): void {
    this.profile = profile;
    this.sound.setMuted(profile.soundMuted);
    this.sound.setAnnouncerEnabled(profile.announcerEnabled);
    this.applyQuality(profile.quality);

    if (
      profile.selectedCharacter !== this.currentCharId ||
      profile.selectedHoverboard !== this.currentBoardId
    ) {
      const prevPos = this.runnerRig.root.position.clone();
      const prevScale = this.runnerRig.root.scale.clone();
      const hoverVis = this.runnerRig.hoverboardMount.visible;
      const droneVis = this.runnerRig.droneMount.visible;

      this.scene.remove(this.runnerRig.root);
      disposeObject3D(this.runnerRig.root);

      this.currentCharId = profile.selectedCharacter;
      this.currentBoardId = profile.selectedHoverboard;
      this.runnerRig = buildRunnerRig(this.currentCharId, this.currentBoardId, this.textures);
      this.runnerRig.root.position.copy(prevPos);
      this.runnerRig.root.scale.copy(prevScale);
      this.runnerRig.hoverboardMount.visible = hoverVis;
      this.runnerRig.droneMount.visible = droneVis;
      this.scene.add(this.runnerRig.root);
    }
    this.pushHud(true);
  }

  private applyQuality(quality: GraphicsQuality): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    } else {
      const dpr = quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      this.renderer.setPixelRatio(dpr);
      this.renderer.shadowMap.enabled = quality === 'high';
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    if (this.sunLight) {
      this.sunLight.castShadow = !this.isSoftwareGl && quality === 'high';
    }
  }

  public triggerLobbyWave(): void {
    if (this.mode !== 'title') return;
    this.lobbyHopTimer = 0.55;
    this.sound.playJump();
  }

  public startRun(): void {
    this.clearDynamicEntities();
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
    this.hoverboardTimer = 0;
    this.hoverboardCooldown = 0;
    this.chaserTimer = 4.2;
    this.stumbleGraceTimer = 0;
    this.stationBannerTimer = 0;
    this.activeStationBanner = null;
    this.callout = null;
    this.calloutTimer = 0;
    this.activeVoiceOver = null;
    this.voiceOverTimer = 0;

    this.runnerRig.root.position.set(0, 0, 0);
    this.runnerRig.root.rotation.set(0, 0, 0);
    this.runnerRig.bodyGroup.rotation.set(0, 0, 0);
    this.runnerRig.bodyGroup.scale.set(1, 1, 1);
    this.runnerRig.hoverboardMount.visible = false;
    this.runnerRig.droneMount.visible = false;

    this.chaserRig.root.visible = true;
    this.chaserRig.root.position.set(0, 0, 3.2);
    this.lobbyTrain.visible = false;

    for (const r of this.tunnelRings) r.visible = false;
    for (const c of this.sceneryChunks) c.visible = true;

    // Safe opening runway with welcoming golden tokens (survives initial seconds cleanly!)
    this.spawnTokenLine(1, -18, 8, 1.05, 3.2);
    this.nextWaveZ = -88;

    this.sound.startMusic();
    this.triggerStationBanner(ELEVATED_STATIONS[0], false);
    this.triggerVoiceOver('run_start');
    this.pushHud(true);
  }

  public returnToTitle(): void {
    this.clearDynamicEntities();
    this.mode = 'title';
    this.sound.stopMusic();
    this.sound.cancelSpeech();
    this.activeVoiceOver = null;
    this.voiceOverTimer = 0;
    this.player = createInitialPlayerKinematics();
    this.zone = 'elevated';
    this.weather = 'sunny';
    this.runnerRig.root.position.set(0, 0, 0);
    this.runnerRig.bodyGroup.scale.set(1, 1, 1);
    this.runnerRig.hoverboardMount.visible = false;
    this.runnerRig.droneMount.visible = false;
    this.chaserRig.root.visible = false;
    this.lobbyTrain.visible = true;
    this.lobbyTrain.position.set(-LANE_POSITIONS[2], 0, -42);
    this.weatherMesh.visible = false;

    for (const r of this.tunnelRings) r.visible = false;
    for (const c of this.sceneryChunks) c.visible = true;
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
    this.runnerRig.hoverboardMount.visible = true;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.25);
    this.sound.playAutoHorn();
    this.spawnBurst(this.player.x, this.player.y + 0.4, 0, 0xffd60a, 16);
    this.showCallout('AUTO BOARD ON! PEE-PEE!', '#FFD60A');
    this.triggerVoiceOver('hoverboard');
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

  private clearDynamicEntities(): void {
    for (const h of this.hazards) {
      this.scene.remove(h.mesh);
      disposeObject3D(h.mesh);
    }
    for (const t of this.tokens) {
      this.scene.remove(t.mesh);
      disposeObject3D(t.mesh);
    }
    for (const p of this.powerUps) {
      this.scene.remove(p.mesh);
      disposeObject3D(p.mesh);
    }
    for (const s of this.stations) {
      this.scene.remove(s.mesh);
      disposeObject3D(s.mesh);
    }
    for (const pt of this.portals) {
      this.scene.remove(pt.mesh);
      disposeObject3D(pt.mesh);
    }
    this.hazards = [];
    this.tokens = [];
    this.powerUps = [];
    this.stations = [];
    this.portals = [];
  }

  private spawnBurst(x: number, y: number, z: number, hexColor: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.6;
      slot.y = y + (Math.random() - 0.5) * 0.5;
      slot.z = z + (Math.random() - 0.5) * 0.6;
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 6.2;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = 2.6 + Math.random() * 6.0;
      slot.vz = Math.sin(angle) * spd;
      slot.maxLife = 0.35 + Math.random() * 0.32;
      slot.life = slot.maxLife;
      slot.scale = 0.7 + Math.random() * 0.85;
      slot.color.setHex(hexColor);
    }
  }

  private spawnTokenLine(
    lane: number,
    startZ: number,
    count: number,
    yBase: number,
    spacing: number,
    archHeight = 0,
  ): void {
    const x = LANE_POSITIONS[lane];
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const arch = archHeight > 0 ? Math.sin(t * Math.PI) * archHeight : 0;
      const mesh = buildTokenMesh();
      const z = startZ - i * spacing;
      const y = yBase + arch;
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.tokens.push({ mesh, x, y, z, collected: false });
    }
  }

  private spawnPowerUp(type: PowerUpType, lane: number, z: number, y = 1.35): void {
    const mesh = buildPowerUpMesh(type);
    mesh.position.set(LANE_POSITIONS[lane], y, z);
    this.scene.add(mesh);
    this.powerUps.push({ mesh, type, lane, y, z, collected: false });
  }

  /**
   * Prevents overlapping trains in the same lane AND prevents faster moving trains
   * from overtaking and clipping straight through static trains or barriers ahead!
   */
  private canSpawnInLane(lane: number, zStart: number, zEnd: number, isMoving: boolean): boolean {
    const pad = 16;
    for (let i = 0; i < this.hazards.length; i++) {
      const other = this.hazards[i];
      if (other.lane !== lane) continue;

      // Direct Z-interval overlap with safety margin
      if (zStart + pad >= other.zEnd && zEnd - pad <= other.zStart) {
        return false;
      }

      // If we are spawning a fast moving train behind a slower hazard in the same lane,
      // it would overtake and pass through it before reaching the player!
      if (isMoving && other.speedOffset === 0 && other.zEnd > zStart - 110) {
        return false;
      }

      // Conversely, don't spawn a static hazard in front of a moving train already rushing down this lane
      if (!isMoving && other.speedOffset > 0 && other.zStart < zEnd + 110) {
        return false;
      }
    }
    return true;
  }

  private spawnHazard(kind: HazardKind, lane: number, zCenter: number): boolean {
    const line: 'purple' | 'green' = Math.random() < 0.62 ? 'purple' : 'green';
    let length = 1.2;
    let height = 1.35;
    let speedOffset = 0;
    let clearanceBottomY: number | undefined;
    let rampLength: number | undefined;

    if (kind === 'train_static' || kind === 'train_ramp' || kind === 'train_moving') {
      length = kind === 'train_moving' ? 18 : 16;
      height = TRAIN_ROOF_Y;
      const hasRamp = kind === 'train_ramp';
      rampLength = hasRamp ? 5.4 : undefined;
      speedOffset = kind === 'train_moving' ? 11.5 : 0;
    } else {
      length = 0.8;
      if (kind === 'gantry_low') {
        height = 3.2;
        clearanceBottomY = 1.3;
      }
    }

    const zStart = zCenter + length / 2 + (rampLength ?? 0);
    const zEnd = zCenter - length / 2;

    if (!this.canSpawnInLane(lane, zStart, zEnd, speedOffset > 0)) {
      return false;
    }

    const id = this.nextEntityId++;
    const mesh =
      kind === 'train_static' || kind === 'train_ramp' || kind === 'train_moving'
        ? buildTrainMesh(line, length, kind === 'train_ramp', this.textures)
        : buildObstacleMesh(kind, this.textures);

    mesh.position.set(LANE_POSITIONS[lane], 0, zCenter);
    this.scene.add(mesh);

    this.hazards.push({
      id,
      kind,
      lane,
      zStart,
      zEnd,
      prevZStart: zStart,
      prevZEnd: zEnd,
      height,
      clearanceBottomY,
      rampLength,
      mesh,
      speedOffset,
      active: true,
    });
    return true;
  }

  private spawnNextWave(): void {
    const z = this.nextWaveZ;
    const lanes = [0, 1, 2];
    const openLane = lanes[Math.floor(Math.random() * 3)];
    const otherLanes = lanes.filter((l) => l !== openLane);

    const roll = Math.random();
    if (roll < 0.36) {
      const rampLane = otherLanes[0];
      if (this.spawnHazard('train_ramp', rampLane, z - 12)) {
        this.spawnTokenLine(rampLane, z - 2, 6, TRAIN_ROOF_Y + 0.9, 3.0);
      }
      if (Math.random() < 0.6) {
        if (this.spawnHazard('train_static', otherLanes[1], z - 24)) {
          this.spawnTokenLine(otherLanes[1], z - 16, 4, TRAIN_ROOF_Y + 0.9, 3.0);
        }
      } else {
        this.spawnHazard('barricade_bbmp', openLane, z - 8);
        this.spawnTokenLine(openLane, z - 4, 5, 1.1, 2.4, 2.0);
      }
    } else if (roll < 0.68) {
      if (!this.spawnHazard('train_moving', otherLanes[0], z - 26)) {
        // Fallback to clean static train if lane has a slower train ahead
        this.spawnHazard('train_static', otherLanes[0], z - 20);
      }
      this.spawnHazard('gantry_low', otherLanes[1], z - 6);
      this.spawnTokenLine(openLane, z - 2, 6, 1.1, 2.8);
    } else {
      this.spawnHazard('barricade_bbmp', otherLanes[0], z - 4);
      this.spawnHazard('barrier_jump', otherLanes[1], z - 12);
      this.spawnTokenLine(otherLanes[0], z - 1, 5, 1.15, 2.1, 2.1);
      this.spawnTokenLine(openLane, z - 6, 5, 1.1, 2.8);
    }

    if (Math.random() < 0.24) {
      const types: PowerUpType[] = ['kaapi', 'magnet', 'drone'];
      this.spawnPowerUp(types[Math.floor(Math.random() * types.length)], openLane, z - 18);
    }

    if (this.droneTimer > 0) {
      this.spawnTokenLine(Math.floor(Math.random() * 3), z - 2, 7, DRONE_FLIGHT_Y + 0.8, 3.0, 0.8);
    }

    this.nextWaveZ -= Math.max(28, 36 - this.distance * 0.004);
  }

  private spawnStationAhead(): void {
    const pool = this.spawnedZone === 'underground' ? UNDERGROUND_STATIONS : ELEVATED_STATIONS;
    const idx =
      this.spawnedZone === 'underground'
        ? this.undergroundIdx++ % pool.length
        : this.elevatedIdx++ % pool.length;
    const station = pool[idx];
    const mesh = buildStationStructure(station, this.textures);
    mesh.position.set(0, 0, -135);
    this.scene.add(mesh);
    this.stations.push({ mesh, station, z: -135, announced: false });
  }

  private spawnPortalAhead(targetZone: ZoneMode): void {
    const mesh = buildTunnelPortal(this.textures);
    mesh.position.set(0, 0, -135);
    this.scene.add(mesh);
    this.portals.push({ mesh, z: -135, targetZone, passed: false });
  }

  private stepSimulation(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    if (this.mode === 'title') {
      this.stepLobby(dt);
      return;
    }
    if (this.mode === 'paused' || this.mode === 'gameover') return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt);
      this.updateCamera(dt, 0);
      return;
    }

    if (this.crashPending) {
      this.crashDelayTimer -= dt;
      this.runnerRig.bodyGroup.rotation.x = THREE.MathUtils.damp(
        this.runnerRig.bodyGroup.rotation.x,
        -1.25,
        10,
        dt,
      );
      this.updateParticles(dt);
      this.updateCamera(dt, 0);
      if (this.crashDelayTimer <= 0) this.finalizeGameOver();
      return;
    }

    if (this.kaapiTimer > 0) {
      this.kaapiTimer = Math.max(0, this.kaapiTimer - dt);
      if (Math.random() < 0.65) {
        this.spawnBurst(this.player.x, this.player.y + 0.9, 0.5, 0xf59e0b, 1);
      }
    }
    if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    if (this.droneTimer > 0) {
      this.droneTimer = Math.max(0, this.droneTimer - dt);
      this.player.droneActive = this.droneTimer > 0;
      this.runnerRig.droneMount.visible = this.player.droneActive;
      for (const r of this.runnerRig.droneRotors) r.rotation.y += dt * 36;
    } else {
      this.player.droneActive = false;
      this.runnerRig.droneMount.visible = false;
    }

    if (this.hoverboardTimer > 0) {
      this.hoverboardTimer = Math.max(0, this.hoverboardTimer - dt);
      this.runnerRig.hoverboardMount.visible = true;
      if (this.hoverboardTimer <= 0) {
        this.runnerRig.hoverboardMount.visible = false;
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

    const speed = getRunSpeed(this.distance, this.kaapiTimer > 0);
    const dz = speed * dt;
    this.distance += dz * 0.55;
    const mult = getEffectiveMultiplier(this.profile);
    this.score += dz * mult * (this.kaapiTimer > 0 ? 1.8 : 1.0);

    if (this.distance >= this.nextZoneDist) {
      this.spawnedZone = this.spawnedZone === 'elevated' ? 'underground' : 'elevated';
      this.spawnPortalAhead(this.spawnedZone);
      this.nextZoneDist += 720;
    }
    if (this.distance >= this.nextStationDist) {
      this.spawnStationAhead();
      this.nextStationDist += 280;
    }

    this.nextWaveZ += dz;
    while (this.nextWaveZ > -145) this.spawnNextWave();

    const trackTotal = 30 * this.trackSegments.length;
    for (const seg of this.trackSegments) {
      seg.position.z += dz;
      if (seg.position.z > 32) seg.position.z -= trackTotal;
    }

    const showTunnel = this.zone === 'underground';
    const ringTotal = 24 * this.tunnelRings.length;
    for (const ring of this.tunnelRings) {
      ring.visible = showTunnel;
      ring.position.z += dz;
      if (ring.position.z > 26) ring.position.z -= ringTotal;
    }

    const sceneryTotal = 36 * this.sceneryChunks.length;
    for (const chunk of this.sceneryChunks) {
      chunk.visible = !showTunnel;
      chunk.position.z += dz * 0.85;
      if (chunk.position.z > 38) chunk.position.z -= sceneryTotal;
    }

    for (const cloud of this.clouds) {
      cloud.visible = !showTunnel;
      cloud.position.z += dz * 0.14;
      if (cloud.position.z > 24) cloud.position.z -= 180;
    }

    for (let i = this.portals.length - 1; i >= 0; i--) {
      const pt = this.portals[i];
      pt.z += dz;
      pt.mesh.position.z = pt.z;
      const pulse = Math.sin(this.elapsed * 12) > 0 ? 2.4 : 0.3;
      pt.mesh.traverse((c) => {
        if (c.name === 'portal_beacon' && c instanceof THREE.Mesh) {
          (c.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
        }
      });
      if (!pt.passed && pt.z >= -1.5) {
        pt.passed = true;
        this.zone = pt.targetZone;
        this.sound.setUnderground(this.zone === 'underground');
        this.showCallout(
          this.zone === 'underground' ? 'UNDERGROUND TUNNEL!' : 'ELEVATED VIADUCT!',
          this.zone === 'underground' ? '#A855F7' : '#38BDF8',
        );
      }
      if (pt.z > 32) {
        this.scene.remove(pt.mesh);
        disposeObject3D(pt.mesh);
        this.portals.splice(i, 1);
      }
    }

    for (let i = this.stations.length - 1; i >= 0; i--) {
      const st = this.stations[i];
      st.z += dz;
      st.mesh.position.z = st.z;
      if (!st.announced && st.z >= -32) {
        st.announced = true;
        this.stationsPassed++;
        this.triggerStationBanner(st.station, true);
      }
      if (st.z > 42) {
        this.scene.remove(st.mesh);
        disposeObject3D(st.mesh);
        this.stations.splice(i, 1);
      }
    }

    const supports: SupportBox[] = [];
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.prevZStart = h.zStart;
      h.prevZEnd = h.zEnd;
      const moveZ = dz + h.speedOffset * dt;
      h.mesh.position.z += moveZ;
      h.zStart += moveZ;
      h.zEnd += moveZ;

      if (h.kind === 'train_static' || h.kind === 'train_ramp' || h.kind === 'train_moving') {
        supports.push({
          lane: h.lane,
          zStart: h.kind === 'train_ramp' && h.rampLength ? h.zStart - h.rampLength : h.zStart,
          zEnd: h.zEnd,
          topY: h.height,
          isRamp: h.kind === 'train_ramp',
          rampStartZ: h.zStart,
          rampEndZ: h.rampLength ? h.zStart - h.rampLength : h.zStart,
        });
      }

      if (h.zEnd > 24) {
        this.scene.remove(h.mesh);
        disposeObject3D(h.mesh);
        this.hazards.splice(i, 1);
      }
    }

    const ev = stepPlayerPhysics(this.player, dt, supports, this.weather);
    if (ev.switchedLane !== 0) {
      this.sound.haptic(8);
      this.sound.playWhoosh(ev.switchedLane > 0 ? 1.08 : 0.94);
      if (this.weather === 'heavy_monsoon' && this.player.grounded) {
        this.spawnBurst(this.player.x, this.player.y + 0.14, 0, 0x93c5fd, 8);
      }
    }
    if (ev.jumped) {
      this.sound.playJump();
      this.spawnBurst(
        this.player.x,
        this.player.y + 0.1,
        0,
        this.weather === 'heavy_monsoon' ? 0xbae6fd : 0xffffff,
        6,
      );
    }
    if (ev.slammed || ev.rolled) this.sound.playRoll();
    if (ev.landed) {
      this.spawnBurst(
        this.player.x,
        this.player.y + 0.08,
        0,
        this.weather === 'heavy_monsoon' ? 0x93c5fd : 0xcbd5e1,
        this.weather === 'heavy_monsoon' ? 9 : 5,
      );
    }

    const invincible = this.kaapiTimer > 0 || this.droneTimer > 0;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (!h.active) continue;
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

      if (outcome === 'close_call') {
        h.closeCallTriggered = true;
        this.closeCalls++;
        this.score += 150 * mult;
        this.sound.playCloseCall();
        const q = CLOSE_CALL_QUIPS[this.closeCalls % CLOSE_CALL_QUIPS.length];
        this.showCallout(`${q} +${150 * mult}`, '#FFD60A');
      } else if (outcome === 'shield_break') {
        this.hoverboardTimer = 0;
        this.runnerRig.hoverboardMount.visible = false;
        this.hoverboardCooldown = HOVERBOARD_COOLDOWN;
        this.hitstopTimer = 0.06;
        this.cameraTrauma = 0.72;
        this.sound.playAutoHorn();
        this.spawnBurst(this.player.x, this.player.y + 1.1, 0, 0xffd60a, 24);
        this.showCallout('ಆಟೋ ಶೀಲ್ಡ್! AUTO SHIELD SAVED YOU!', '#2DC653');
        for (let j = this.hazards.length - 1; j >= 0; j--) {
          if (this.hazards[j].zEnd > -26 && this.hazards[j].zStart < 12) {
            this.scene.remove(this.hazards[j].mesh);
            disposeObject3D(this.hazards[j].mesh);
            this.hazards.splice(j, 1);
          }
        }
        break;
      } else if (outcome === 'stumble') {
        if (this.stumbleGraceTimer > 0) continue;
        // CRITICAL FIX: NEVER disable the train collider! Push the runner cleanly
        // back to the safe adjacent lane outside the train wall so you NEVER pass through trains.
        const trainX = LANE_POSITIONS[h.lane];
        const pushDir = this.player.x < trainX ? -1 : 1;
        let safeLane = Math.max(0, Math.min(2, h.lane + pushDir));
        if (safeLane === h.lane) {
          safeLane = this.player.lastSafeLane !== h.lane ? this.player.lastSafeLane : h.lane === 0 ? 1 : 0;
        }
        this.player.lane = safeLane;
        this.player.lastSafeLane = safeLane;
        this.player.x = trainX + (safeLane < h.lane ? -1.85 : 1.85);
        this.player.bufferedAction = 'none';
        this.player.bufferTimer = 0;
        this.stumbleGraceTimer = 0.28;
        this.chaserTimer = STUMBLE_CHASE_WINDOW;
        this.cameraTrauma = 0.55;
        this.hitstopTimer = 0.04;
        this.sound.playStumble();
        this.spawnBurst(this.player.x, this.player.y + 1.0, 0, 0xdc2626, 12);
        this.showCallout('ಹುಷಾರು! INSPECTOR ON YOUR TAIL!', '#FFD60A');
      } else if (outcome === 'crash') {
        this.triggerCrash();
        break;
      }
    }

    const magnetOn = this.magnetTimer > 0;
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const tk = this.tokens[i];
      tk.z += dz;
      tk.mesh.rotation.y += dt * 4.2;
      if (magnetOn && tk.z > -18 && tk.z < 4) {
        const pull = 1 - Math.exp(-13 * dt);
        tk.x += (this.player.x - tk.x) * pull;
        tk.y += (this.player.y + 1.15 - tk.y) * pull;
        tk.z += (0 - tk.z) * pull * 0.45;
      }
      tk.mesh.position.set(tk.x, tk.y + Math.sin(this.elapsed * 5 + i) * 0.1, tk.z);

      if (
        !tk.collected &&
        Math.abs(tk.x - this.player.x) < 1.15 &&
        Math.abs(tk.y - (this.player.y + 1.0)) < 1.45 &&
        Math.abs(tk.z) < 1.35
      ) {
        tk.collected = true;
        this.runTokens++;
        this.score += 25 * mult;
        this.sound.playToken();
        this.spawnBurst(tk.x, tk.y, tk.z, 0xffd60a, 5);
        this.scene.remove(tk.mesh);
        disposeObject3D(tk.mesh);
        this.tokens.splice(i, 1);
        continue;
      }
      if (tk.z > 16) {
        this.scene.remove(tk.mesh);
        disposeObject3D(tk.mesh);
        this.tokens.splice(i, 1);
      }
    }

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.z += dz;
      pu.mesh.rotation.y += dt * 2.8;
      pu.mesh.position.set(LANE_POSITIONS[pu.lane], pu.y + Math.sin(this.elapsed * 4.5 + i) * 0.22, pu.z);

      if (
        !pu.collected &&
        Math.abs(LANE_POSITIONS[pu.lane] - this.player.x) < 1.25 &&
        Math.abs(pu.y - (this.player.y + 1.0)) < 1.75 &&
        Math.abs(pu.z) < 1.5
      ) {
        pu.collected = true;
        this.activatePowerUp(pu.type);
        this.scene.remove(pu.mesh);
        disposeObject3D(pu.mesh);
        this.powerUps.splice(i, 1);
        continue;
      }
      if (pu.z > 16) {
        this.scene.remove(pu.mesh);
        disposeObject3D(pu.mesh);
        this.powerUps.splice(i, 1);
      }
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
    if (this.weather === 'heavy_monsoon' && this.player.grounded && Math.random() < 0.38) {
      this.spawnBurst(this.player.x, this.player.y + 0.08, 0.2, 0xbae6fd, 1);
    }
    this.updateAtmosphere(dt);
    this.updateWeatherParticles(dt, dz);
    this.updateRunnerAnim(dt, speed);
    this.updateChaserAnim(dt, speed);
    this.updateParticles(dt);
    this.updateCamera(dt, speed);

    if (this.elapsed - this.lastHudPush >= 0.1) this.pushHud(false);
  }

  private activatePowerUp(type: PowerUpType): void {
    this.sound.playPowerUp();
    if (type === 'kaapi') {
      this.kaapiDuration = getPowerUpDuration(this.profile, 'kaapi');
      this.kaapiTimer = this.kaapiDuration;
      this.kaapiUsed++;
      this.cameraTrauma = 0.3;
      this.spawnBurst(this.player.x, this.player.y + 1.2, 0, 0xf59e0b, 20);
      this.showCallout(SPEED_BOOST_QUIPS[this.kaapiUsed % SPEED_BOOST_QUIPS.length], '#F59E0B');
    } else if (type === 'magnet') {
      this.magnetDuration = getPowerUpDuration(this.profile, 'magnet');
      this.magnetTimer = this.magnetDuration;
      this.spawnBurst(this.player.x, this.player.y + 1.2, 0, 0xeab308, 18);
      this.showCallout('MASALA DOSA MAGNET!', '#EAB308');
    } else {
      this.droneDuration = getPowerUpDuration(this.profile, 'drone');
      this.droneTimer = this.droneDuration;
      this.player.droneActive = true;
      this.runnerRig.droneMount.visible = true;
      this.spawnBurst(this.player.x, this.player.y + 1.5, 0, 0x00f5d4, 22);
      this.showCallout('STARTUP DRONE FLIGHT!', '#00F5D4');
      this.spawnTokenLine(1, -22, 10, DRONE_FLIGHT_Y + 0.8, 3.4, 1.0);
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
    this.spawnBurst(this.player.x, this.player.y + 1.1, 0, 0xff4d8d, 24);
    this.spawnBurst(this.player.x, this.player.y + 1.1, 0, 0xffd60a, 14);
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
    };
    this.runSummary = summary;
    this.onRunEnd(summary);
    this.pushHud(true);
  }

  private stepLobby(dt: number): void {
    const orbit = Math.sin(this.elapsed * 0.45) * 0.3 + 0.32;
    const r = this.framing.lobbyRadius;
    this.camera.position.set(
      Math.sin(orbit) * r + 0.25,
      this.framing.lobbyY + Math.sin(this.elapsed * 0.7) * 0.12,
      Math.cos(orbit) * r + 0.35,
    );
    this.camera.lookAt(0, this.framing.lobbyLookY, -0.6);

    if (Math.abs(this.camera.fov - this.framing.fov) > 0.2) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.framing.fov, 8, dt);
      this.camera.updateProjectionMatrix();
    }

    let hopY = 0;
    if (this.lobbyHopTimer > 0) {
      this.lobbyHopTimer = Math.max(0, this.lobbyHopTimer - dt);
      hopY = Math.sin((this.lobbyHopTimer / 0.55) * Math.PI) * 1.15;
    }
    const bob = Math.sin(this.elapsed * 3.2) * 0.04;
    this.runnerRig.root.position.set(0, hopY, 0);
    this.runnerRig.bodyGroup.position.y = bob;
    this.runnerRig.bodyGroup.rotation.set(0, Math.PI - 0.16 + Math.sin(this.elapsed * 0.9) * 0.08, 0);
    this.runnerRig.leftArm.rotation.x = this.lobbyHopTimer > 0 ? -2.2 : Math.sin(this.elapsed * 2.4) * 0.16;
    this.runnerRig.rightArm.rotation.x = this.lobbyHopTimer > 0 ? -2.2 : -Math.sin(this.elapsed * 2.4) * 0.16;
    this.runnerRig.leftLeg.rotation.x = 0;
    this.runnerRig.rightLeg.rotation.x = 0;

    this.lobbyTrain.visible = true;
    this.lobbyTrain.position.x = -LANE_POSITIONS[2];
    this.lobbyTrain.position.z += 22 * dt;
    if (this.lobbyTrain.position.z > 48) this.lobbyTrain.position.z = -95;

    for (const cloud of this.clouds) {
      cloud.visible = true;
      cloud.position.z += 2.2 * dt;
      if (cloud.position.z > 24) cloud.position.z -= 180;
    }

    (this.scene.background as THREE.Color).lerp(_elevatedSky, 1 - Math.exp(-4 * dt));
    this.fog.color.lerp(_elevatedSky, 1 - Math.exp(-4 * dt));
    this.sunLight.intensity = THREE.MathUtils.damp(this.sunLight.intensity, 1.85, 4, dt);
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, 1.05, 4, dt);
    this.tunnelLight.intensity = 0;
  }

  private updateAtmosphere(dt: number): void {
    const isUg = this.zone === 'underground';
    if (isUg) {
      _targetSky.copy(_undergroundSky);
      _targetFog.setHex(0x140d29);
    } else if (this.weather === 'heavy_monsoon') {
      _targetSky.copy(_heavyMonsoonSky);
      _targetFog.setHex(0x334968);
    } else if (this.weather === 'light_rain') {
      _targetSky.copy(_lightRainSky);
      _targetFog.setHex(0x89a8c9);
    } else {
      _targetSky.copy(_elevatedSky);
      _targetFog.setHex(0x88d4fc);
    }

    const alpha = 1 - Math.exp(-2.8 * dt);
    (this.scene.background as THREE.Color).lerp(_targetSky, alpha);
    this.fog.color.lerp(_targetFog, alpha);
    this.fog.near = THREE.MathUtils.damp(
      this.fog.near,
      isUg ? 24 : this.weather === 'heavy_monsoon' ? 28 : 48,
      3,
      dt,
    );
    this.fog.far = THREE.MathUtils.damp(
      this.fog.far,
      isUg ? 115 : this.weather === 'heavy_monsoon' ? 128 : 175,
      3,
      dt,
    );
    this.sunLight.intensity = THREE.MathUtils.damp(
      this.sunLight.intensity,
      isUg ? 0.35 : this.weather === 'heavy_monsoon' ? 0.85 : this.weather === 'light_rain' ? 1.35 : 1.85,
      3,
      dt,
    );
    this.hemiLight.intensity = THREE.MathUtils.damp(
      this.hemiLight.intensity,
      isUg ? 0.72 : this.weather === 'heavy_monsoon' ? 0.82 : 1.08,
      3,
      dt,
    );
    this.tunnelLight.intensity = THREE.MathUtils.damp(this.tunnelLight.intensity, isUg ? 3.2 : 0, 4, dt);
    this.tunnelLight.position.set(this.player.x, 5.2, -5);

    if (this.deckMat) {
      const targetRoughness =
        this.weather === 'heavy_monsoon' ? 0.24 : this.weather === 'light_rain' ? 0.48 : 0.72;
      const targetMetalness =
        this.weather === 'heavy_monsoon' ? 0.36 : this.weather === 'light_rain' ? 0.22 : 0.14;
      this.deckMat.roughness = THREE.MathUtils.damp(this.deckMat.roughness, targetRoughness, 3.5, dt);
      this.deckMat.metalness = THREE.MathUtils.damp(this.deckMat.metalness, targetMetalness, 3.5, dt);
    }
  }

  private updateWeatherParticles(dt: number, dz: number): void {
    const show =
      this.zone === 'elevated' &&
      (this.weather === 'light_rain' || this.weather === 'heavy_monsoon');
    this.weatherMesh.visible = show;
    if (!show) return;

    const isMonsoon = this.weather === 'heavy_monsoon';
    const activeCount = isMonsoon ? this.weatherDrops.length : Math.floor(this.weatherDrops.length * 0.36);
    _colScratch.setHex(isMonsoon ? 0xbae6fd : 0xe0f2fe);

    for (let i = 0; i < this.weatherDrops.length; i++) {
      if (i >= activeCount) {
        _dummy.position.set(0, -60, 0);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        this.weatherMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      const wp = this.weatherDrops[i];
      wp.y += (isMonsoon ? wp.vy * 4.2 : wp.vy * 2.4) * dt;
      wp.x += (isMonsoon ? -6.8 : -2.4) * dt;
      wp.z += dz * (isMonsoon ? 0.85 : 0.55);

      if (wp.y < -1 || wp.z > 10 || wp.x < -18) {
        wp.x = (Math.random() - 0.5) * 32 + (isMonsoon ? 4 : 1);
        wp.y = 14 + Math.random() * 10;
        wp.z = -Math.random() * 55 + 6;
      }

      _dummy.position.set(wp.x, wp.y, wp.z);
      _dummy.rotation.set(0, 0, isMonsoon ? -0.32 : -0.16);
      _dummy.scale.set(isMonsoon ? 0.42 : 0.28, isMonsoon ? 3.8 : 2.1, 0.32);
      _dummy.updateMatrix();
      this.weatherMesh.setMatrixAt(i, _dummy.matrix);
      this.weatherMesh.setColorAt(i, _colScratch);
    }
    this.weatherMesh.instanceMatrix.needsUpdate = true;
    if (this.weatherMesh.instanceColor) this.weatherMesh.instanceColor.needsUpdate = true;
  }

  private updateRunnerAnim(dt: number, speed: number): void {
    const hoverActive = this.hoverboardTimer > 0;
    const hoverLift = hoverActive ? 0.42 + Math.sin(this.elapsed * 9) * 0.06 : 0;

    this.runnerRig.root.position.set(this.player.x, this.player.y, 0);
    this.runnerRig.bodyGroup.position.y = hoverLift;
    this.runnerRig.bodyGroup.scale.set(this.player.scaleX, this.player.scaleY, this.player.scaleZ);

    const bank = (LANE_POSITIONS[this.player.lane] - this.player.x) * -0.14;
    this.runnerRig.bodyGroup.rotation.z = THREE.MathUtils.damp(this.runnerRig.bodyGroup.rotation.z, bank, 14, dt);

    if (this.player.droneActive) {
      this.runnerRig.bodyGroup.rotation.x = THREE.MathUtils.damp(this.runnerRig.bodyGroup.rotation.x, -0.48, 8, dt);
      this.runnerRig.leftLeg.rotation.x = 0.35;
      this.runnerRig.rightLeg.rotation.x = 0.25;
      this.runnerRig.leftArm.rotation.x = -0.5;
      this.runnerRig.rightArm.rotation.x = -0.5;
    } else if (hoverActive) {
      this.runnerRig.bodyGroup.rotation.x = THREE.MathUtils.damp(this.runnerRig.bodyGroup.rotation.x, -0.1, 10, dt);
      this.runnerRig.bodyGroup.rotation.y = THREE.MathUtils.damp(this.runnerRig.bodyGroup.rotation.y, 0.55, 10, dt);
      this.runnerRig.leftLeg.rotation.x = 0.15;
      this.runnerRig.rightLeg.rotation.x = -0.15;
      this.runnerRig.leftArm.rotation.z = -0.55;
      this.runnerRig.rightArm.rotation.z = 0.55;
      this.runnerRig.hoverboardMount.rotation.z = bank * 1.4;
    } else {
      this.runnerRig.bodyGroup.rotation.y = THREE.MathUtils.damp(this.runnerRig.bodyGroup.rotation.y, 0, 12, dt);
      this.runnerRig.leftArm.rotation.z = 0;
      this.runnerRig.rightArm.rotation.z = 0;

      if (this.player.rolling) {
        this.runnerRig.bodyGroup.rotation.x = THREE.MathUtils.damp(this.runnerRig.bodyGroup.rotation.x, -0.65, 16, dt);
      } else if (!this.player.grounded) {
        this.runnerRig.bodyGroup.rotation.x = THREE.MathUtils.damp(this.runnerRig.bodyGroup.rotation.x, -0.2, 10, dt);
        this.runnerRig.leftLeg.rotation.x = -0.65;
        this.runnerRig.rightLeg.rotation.x = 0.45;
        this.runnerRig.leftArm.rotation.x = -1.0;
        this.runnerRig.rightArm.rotation.x = 0.7;
      } else {
        this.runnerRig.bodyGroup.rotation.x = THREE.MathUtils.damp(this.runnerRig.bodyGroup.rotation.x, -0.14, 12, dt);
        const phase = this.distance * 1.45;
        const swing = Math.sin(phase) * (0.85 + Math.min(0.25, speed * 0.005));
        this.runnerRig.leftLeg.rotation.x = swing;
        this.runnerRig.rightLeg.rotation.x = -swing;
        this.runnerRig.leftArm.rotation.x = -swing * 0.9;
        this.runnerRig.rightArm.rotation.x = swing * 0.9;
      }
    }

    const s = Math.max(0.35, 1 - this.player.y * 0.08);
    this.runnerRig.contactShadow.scale.set(s, s, 1);
  }

  private updateChaserAnim(dt: number, speed: number): void {
    const active = this.chaserTimer > 0 && !this.player.droneActive;
    const targetZ = active ? 2.85 : 11.5;
    this.chaserRig.root.position.z = THREE.MathUtils.damp(this.chaserRig.root.position.z, targetZ, 4.5, dt);
    this.chaserRig.root.position.x = THREE.MathUtils.damp(this.chaserRig.root.position.x, this.player.x, 7.5, dt);
    this.chaserRig.root.visible = this.chaserRig.root.position.z < 9.5;

    const swing = Math.sin(this.distance * 1.55 + 0.8) * (0.8 + speed * 0.005);
    this.chaserRig.leftLeg.rotation.x = swing;
    this.chaserRig.rightLeg.rotation.x = -swing;
    this.chaserRig.leftArm.rotation.x = -swing;
    this.chaserRig.rightArm.rotation.x = swing;
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.vy -= 18 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const s = p.scale * (p.life / p.maxLife);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  private updateCamera(dt: number, speed: number): void {
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.8);
    const shake = this.cameraTrauma * this.cameraTrauma;
    const shakeX = (Math.random() * 2 - 1) * shake * 0.65;
    const shakeY = (Math.random() * 2 - 1) * shake * 0.45;

    const targetCamX = this.player.x * 0.62 + shakeX;
    const rollDip = this.player.rolling ? -0.6 : 0;
    const droneLift = this.player.droneActive ? 2.4 : 0;
    const targetCamY = this.framing.chaseY + this.player.y * 0.62 + rollDip + droneLift + shakeY;
    const targetCamZ = this.player.droneActive ? this.framing.chaseZ + 2.8 : this.framing.chaseZ;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 10, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 9, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 7, dt);

    const targetFov =
      this.framing.fov + Math.min(9, Math.max(0, (speed - 21) * 0.28)) + (this.kaapiTimer > 0 ? 10 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }

    this.camera.lookAt(this.player.x * 0.42, 1.55 + this.player.y * 0.52, -14);
    const targetRoll = (LANE_POSITIONS[this.player.lane] - this.player.x) * -0.025;
    this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, targetRoll, 10, dt);
  }

  private pushHud(force: boolean): void {
    if (!force && this.elapsed - this.lastHudPush < 0.09) return;
    this.lastHudPush = this.elapsed;

    const activePowerUps: ActivePowerUpState[] = [];
    if (this.kaapiTimer > 0) activePowerUps.push({ type: 'kaapi', remaining: this.kaapiTimer, duration: this.kaapiDuration });
    if (this.magnetTimer > 0) activePowerUps.push({ type: 'magnet', remaining: this.magnetTimer, duration: this.magnetDuration });
    if (this.droneTimer > 0) activePowerUps.push({ type: 'drone', remaining: this.droneTimer, duration: this.droneDuration });
    if (this.hoverboardTimer > 0) activePowerUps.push({ type: 'hoverboard', remaining: this.hoverboardTimer, duration: this.hoverboardDuration });

    const maxCd = Math.max(6, HOVERBOARD_COOLDOWN - ((this.profile.upgrades.hoverboard ?? 1) - 1) * 1.4);
    const cdRatio =
      this.hoverboardTimer > 0
        ? this.hoverboardTimer / Math.max(1, this.hoverboardDuration)
        : this.hoverboardCooldown <= 0
          ? 1
          : Math.max(0, 1 - this.hoverboardCooldown / maxCd);

    this.onHud({
      mode: this.mode,
      score: Math.round(this.score),
      distance: Math.round(this.distance),
      tokens: this.runTokens,
      multiplier: getEffectiveMultiplier(this.profile),
      zone: this.zone,
      weather: this.weather,
      currentStation: this.activeStationBanner,
      stationBannerVisible: this.stationBannerTimer > 0 && this.activeStationBanner !== null,
      activePowerUps,
      hoverboardReady: this.hoverboardTimer <= 0 && this.hoverboardCooldown <= 0,
      hoverboardCooldownRatio: cdRatio,
      hoverboardActive: this.hoverboardTimer > 0,
      kaapiActive: this.kaapiTimer > 0,
      chaserClose: this.chaserTimer > 0,
      callout: this.callout,
      voiceOver: this.activeVoiceOver,
      lastStationName: this.lastStationName,
      gameOverQuip: this.gameOverQuip,
      runSummary: this.runSummary,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameHandle = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameHandle = window.setTimeout(cb, 80);
        }
      };
      this.frameHandle = window.setTimeout(poll, 5);
    } else {
      this.frameHandle = window.setTimeout(cb, 80);
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = Math.max(0.001, (now - this.lastTs) / 1000);
      this.lastTs = now;

      if (!this.contextLost) {
        this.stepSimulation(rawDt);
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameHandle = window.requestAnimationFrame(tick);
      }
    };
    this.frameHandle = window.requestAnimationFrame(tick);
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.framing = computeCameraFraming(w, h);
    this.camera.aspect = w / h;
    if (this.mode === 'title') {
      this.camera.fov = this.framing.fov;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (!this.contextLost) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameHandle);
    window.clearTimeout(this.frameHandle);
    window.removeEventListener('resize', this.onWindowResizeBound);
    window.removeEventListener('orientationchange', this.onWindowResizeBound);
    this.resizeObserver?.disconnect();
    this.clearDynamicEntities();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
