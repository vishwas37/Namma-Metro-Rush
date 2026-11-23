import * as THREE from 'three';
import type { MetroStation, PowerUpType } from '../core/catalog';
import type { HazardKind } from '../core/simulation';
import type { AssetRegistry } from './assets';
import {
  buildObstacleRig,
  buildStationRig,
  buildTrainRig,
  buildTunnelPortalRig,
  buildUnifiedPowerUpRig,
  type PooledStationRig,
  type UnifiedPowerUpRig,
} from './meshes';

export type ObstacleKind = Exclude<HazardKind, 'train_static' | 'train_ramp' | 'train_moving'>;
export type TrainPoolKind = 'train_static' | 'train_ramp' | 'train_moving';

export interface PooledTrainSlot {
  mesh: THREE.Group;
  kind: TrainPoolKind;
  line: 'purple' | 'green';
  inUse: boolean;
}

export interface PooledObstacleSlot {
  mesh: THREE.Group;
  kind: ObstacleKind;
  inUse: boolean;
}

export interface PooledPowerUpSlot {
  rig: UnifiedPowerUpRig;
  type: PowerUpType;
  lane: number;
  baseY: number;
  z: number;
  inUse: boolean;
}

export interface PooledStationSlot {
  rig: PooledStationRig;
  zone: 'elevated' | 'underground';
  station: MetroStation | null;
  z: number;
  announced: boolean;
  inUse: boolean;
}

export interface PooledPortalSlot {
  mesh: THREE.Group;
  z: number;
  targetZone: 'elevated' | 'underground';
  passed: boolean;
  inUse: boolean;
}

export interface TokenSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  spinPhase: number;
  magnetizing: boolean;
}

interface SparkSlot {
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
  colorHex: number;
}

interface RainSlot {
  x: number;
  y: number;
  z: number;
  speed: number;
}

// Module-level scratch objects to guarantee ZERO allocations in render & physics loops
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

const TOKEN_CAPACITY = 220;
const SPARK_CAPACITY = 140;
const RAIN_CAPACITY = 220;
const RIBBON_SEGMENTS = 22;

export interface EntityPools {
  // Instanced tokens (2 draw calls total for up to 220 spinning coins!)
  tokenRimInst: THREE.InstancedMesh;
  tokenCoreInst: THREE.InstancedMesh;
  tokens: TokenSlot[];
  spawnToken: (x: number, y: number, z: number) => void;
  clearTokens: () => void;
  updateTokens: (
    dt: number,
    forwardStep: number,
    time: number,
    playerX: number,
    playerY: number,
    magnetActive: boolean,
    onCollect: (x: number, y: number) => void,
  ) => void;

  // Trains (14 pre-warmed rigs)
  acquireTrain: (kind: TrainPoolKind, line: 'purple' | 'green') => PooledTrainSlot | null;
  releaseTrain: (slot: PooledTrainSlot) => void;

  // Obstacles (32 pre-warmed rigs: 8 each)
  acquireObstacle: (kind: ObstacleKind) => PooledObstacleSlot | null;
  releaseObstacle: (slot: PooledObstacleSlot) => void;

  // Power-Ups (8 reusable unified rigs)
  powerUps: PooledPowerUpSlot[];
  acquirePowerUp: (type: PowerUpType, lane: number, y: number, z: number) => PooledPowerUpSlot | null;
  releasePowerUp: (slot: PooledPowerUpSlot) => void;

  // Stations (2 elevated + 2 underground)
  stations: PooledStationSlot[];
  acquireStation: (station: MetroStation, z: number) => PooledStationSlot | null;
  releaseStation: (slot: PooledStationSlot) => void;

  // Tunnel Portals (2 reusable portals)
  portals: PooledPortalSlot[];
  acquirePortal: (targetZone: 'elevated' | 'underground', z: number) => PooledPortalSlot | null;
  releasePortal: (slot: PooledPortalSlot) => void;

  // Instanced burst sparks & dust puffs
  sparkInst: THREE.InstancedMesh;
  spawnBurst: (x: number, y: number, z: number, colorHex: number, count?: number, spread?: number) => void;
  updateSparks: (dt: number, forwardStep: number) => void;

  // Instanced rain streaks
  rainInst: THREE.InstancedMesh;
  updateRain: (dt: number, intensity: number, playerX: number, underground: boolean) => void;

  // Dynamic hoverboard/drone ribbon trail (zero allocations)
  ribbonMesh: THREE.Mesh;
  resetRibbon: () => void;
  updateRibbon: (
    dt: number,
    forwardStep: number,
    active: boolean,
    x: number,
    y: number,
    colorHex: number,
  ) => void;

  // Expanding hoverboard shield-break shockwave ring
  shockwaveMesh: THREE.Mesh;
  triggerShockwave: (x: number, y: number, colorHex?: number) => void;
  updateShockwave: (dt: number) => void;

  resetAll: () => void;
  dispose: () => void;
}

export function createEntityPools(scene: THREE.Scene, assets: AssetRegistry): EntityPools {
  // ---------------- 1. DUAL-INSTANCED TOKENS (capacity 220) ----------------
  const tokenRimInst = new THREE.InstancedMesh(
    assets.geo.tokenRim,
    assets.mat.tokenGold,
    TOKEN_CAPACITY,
  );
  const tokenCoreInst = new THREE.InstancedMesh(
    assets.geo.tokenCore,
    assets.mat.tokenCorePurple,
    TOKEN_CAPACITY,
  );
  tokenRimInst.frustumCulled = false;
  tokenCoreInst.frustumCulled = false;
  tokenRimInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tokenCoreInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const tokens: TokenSlot[] = [];
  for (let i = 0; i < TOKEN_CAPACITY; i++) {
    tokens.push({ active: false, x: 0, y: -50, z: 100, spinPhase: i * 0.45, magnetizing: false });
    tokenRimInst.setMatrixAt(i, _hiddenMatrix);
    tokenCoreInst.setMatrixAt(i, _hiddenMatrix);
  }
  tokenRimInst.instanceMatrix.needsUpdate = true;
  tokenCoreInst.instanceMatrix.needsUpdate = true;
  scene.add(tokenRimInst, tokenCoreInst);

  let tokenCursor = 0;
  const spawnToken = (x: number, y: number, z: number) => {
    for (let attempt = 0; attempt < TOKEN_CAPACITY; attempt++) {
      const idx = (tokenCursor + attempt) % TOKEN_CAPACITY;
      const slot = tokens[idx];
      if (!slot.active) {
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.z = z;
        slot.spinPhase = z * 0.16;
        slot.magnetizing = false;
        tokenCursor = (idx + 1) % TOKEN_CAPACITY;
        return;
      }
    }
  };

  const clearTokens = () => {
    for (let i = 0; i < TOKEN_CAPACITY; i++) {
      tokens[i].active = false;
      tokenRimInst.setMatrixAt(i, _hiddenMatrix);
      tokenCoreInst.setMatrixAt(i, _hiddenMatrix);
    }
    tokenRimInst.instanceMatrix.needsUpdate = true;
    tokenCoreInst.instanceMatrix.needsUpdate = true;
  };

  const updateTokens = (
    dt: number,
    forwardStep: number,
    time: number,
    playerX: number,
    playerY: number,
    magnetActive: boolean,
    onCollect: (x: number, y: number) => void,
  ) => {
    let anyActive = false;
    const pullFactor = 1 - Math.exp(-15.5 * dt);
    for (let i = 0; i < TOKEN_CAPACITY; i++) {
      const t = tokens[i];
      if (!t.active) continue;
      anyActive = true;
      t.z += forwardStep;

      if (t.z > 10) {
        t.active = false;
        tokenRimInst.setMatrixAt(i, _hiddenMatrix);
        tokenCoreInst.setMatrixAt(i, _hiddenMatrix);
        continue;
      }

      if (magnetActive && t.z > -32 && t.z < 5) {
        t.magnetizing = true;
      }
      if (t.magnetizing) {
        t.x += (playerX - t.x) * pullFactor;
        t.y += (playerY + 1.15 - t.y) * pullFactor;
        t.z += (0 - t.z) * pullFactor;
      }

      const dx = Math.abs(t.x - playerX);
      const dy = Math.abs(t.y - (playerY + 1.05));
      const dz = Math.abs(t.z);
      if (dx < 1.25 && dy < 1.5 && dz < 1.35) {
        t.active = false;
        tokenRimInst.setMatrixAt(i, _hiddenMatrix);
        tokenCoreInst.setMatrixAt(i, _hiddenMatrix);
        onCollect(t.x, t.y);
        continue;
      }

      const bob = Math.sin(time * 4.5 + t.spinPhase) * 0.14;
      _dummy.position.set(t.x, t.y + bob, t.z);
      _dummy.rotation.set(0, time * 3.1 + t.spinPhase, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      tokenRimInst.setMatrixAt(i, _dummy.matrix);
      tokenCoreInst.setMatrixAt(i, _dummy.matrix);
    }
    if (anyActive) {
      tokenRimInst.instanceMatrix.needsUpdate = true;
      tokenCoreInst.instanceMatrix.needsUpdate = true;
    }
  };

  // ---------------- 2. PRE-ALLOCATED TRAINS (14 rigs) ----------------
  const trainSlots: PooledTrainSlot[] = [];
  const trainPlan: Array<{ kind: TrainPoolKind; line: 'purple' | 'green'; count: number }> = [
    { kind: 'train_static', line: 'purple', count: 3 },
    { kind: 'train_static', line: 'green', count: 2 },
    { kind: 'train_ramp', line: 'purple', count: 2 },
    { kind: 'train_ramp', line: 'green', count: 2 },
    { kind: 'train_moving', line: 'purple', count: 3 },
    { kind: 'train_moving', line: 'green', count: 2 },
  ];
  for (const spec of trainPlan) {
    for (let i = 0; i < spec.count; i++) {
      const mesh = buildTrainRig(
        spec.line,
        spec.kind === 'train_moving',
        spec.kind === 'train_ramp',
        assets,
      );
      mesh.visible = false;
      scene.add(mesh);
      trainSlots.push({ mesh, kind: spec.kind, line: spec.line, inUse: false });
    }
  }

  const acquireTrain = (kind: TrainPoolKind, line: 'purple' | 'green'): PooledTrainSlot | null => {
    // Prefer exact line match first, fall back to same kind
    let found = trainSlots.find((s) => !s.inUse && s.kind === kind && s.line === line);
    if (!found) {
      found = trainSlots.find((s) => !s.inUse && s.kind === kind);
    }
    if (!found) return null;
    found.inUse = true;
    found.mesh.visible = true;
    return found;
  };

  const releaseTrain = (slot: PooledTrainSlot) => {
    slot.inUse = false;
    slot.mesh.visible = false;
  };

  // ---------------- 3. PRE-ALLOCATED OBSTACLES (8 each = 32) ----------------
  const obstacleSlots: PooledObstacleSlot[] = [];
  const obstacleKinds: ObstacleKind[] = [
    'barrier_jump',
    'barricade_bbmp',
    'gantry_low',
    'pillar_narrow',
  ];
  for (const kind of obstacleKinds) {
    for (let i = 0; i < 8; i++) {
      const mesh = buildObstacleRig(kind, assets);
      mesh.visible = false;
      scene.add(mesh);
      obstacleSlots.push({ mesh, kind, inUse: false });
    }
  }

  const acquireObstacle = (kind: ObstacleKind): PooledObstacleSlot | null => {
    const found = obstacleSlots.find((s) => !s.inUse && s.kind === kind);
    if (!found) return null;
    found.inUse = true;
    found.mesh.visible = true;
    return found;
  };

  const releaseObstacle = (slot: PooledObstacleSlot) => {
    slot.inUse = false;
    slot.mesh.visible = false;
  };

  // ---------------- 4. POWER-UPS (8 reusable unified rigs) ----------------
  const powerUps: PooledPowerUpSlot[] = [];
  for (let i = 0; i < 8; i++) {
    const rig = buildUnifiedPowerUpRig(assets);
    rig.root.visible = false;
    scene.add(rig.root);
    powerUps.push({ rig, type: 'kaapi', lane: 1, baseY: 1.35, z: 100, inUse: false });
  }

  const acquirePowerUp = (
    type: PowerUpType,
    lane: number,
    y: number,
    z: number,
  ): PooledPowerUpSlot | null => {
    const slot = powerUps.find((s) => !s.inUse);
    if (!slot) return null;
    slot.inUse = true;
    slot.type = type;
    slot.lane = lane;
    slot.baseY = y;
    slot.z = z;
    slot.rig.setType(type);
    slot.rig.root.visible = true;
    return slot;
  };

  const releasePowerUp = (slot: PooledPowerUpSlot) => {
    slot.inUse = false;
    slot.rig.root.visible = false;
  };

  // ---------------- 5. STATIONS (2 elevated + 2 underground) ----------------
  const stations: PooledStationSlot[] = [];
  for (const zone of ['elevated', 'underground'] as const) {
    for (let i = 0; i < 2; i++) {
      const rig = buildStationRig(zone, assets);
      rig.root.visible = false;
      scene.add(rig.root);
      stations.push({ rig, zone, station: null, z: 200, announced: false, inUse: false });
    }
  }

  const acquireStation = (station: MetroStation, z: number): PooledStationSlot | null => {
    const slot = stations.find((s) => !s.inUse && s.zone === station.zone);
    if (!slot) return null;
    slot.inUse = true;
    slot.station = station;
    slot.z = z;
    slot.announced = false;
    slot.rig.configure(station);
    slot.rig.root.position.set(0, 0, z);
    slot.rig.root.visible = true;
    return slot;
  };

  const releaseStation = (slot: PooledStationSlot) => {
    slot.inUse = false;
    slot.station = null;
    slot.rig.root.visible = false;
  };

  // ---------------- 6. TUNNEL PORTALS (2 reusable portals) ----------------
  const portals: PooledPortalSlot[] = [];
  for (let i = 0; i < 2; i++) {
    const mesh = buildTunnelPortalRig(assets);
    mesh.visible = false;
    scene.add(mesh);
    portals.push({ mesh, z: 200, targetZone: 'underground', passed: false, inUse: false });
  }

  const acquirePortal = (
    targetZone: 'elevated' | 'underground',
    z: number,
  ): PooledPortalSlot | null => {
    const slot = portals.find((s) => !s.inUse);
    if (!slot) return null;
    slot.inUse = true;
    slot.targetZone = targetZone;
    slot.z = z;
    slot.passed = false;
    slot.mesh.position.set(0, 0, z);
    slot.mesh.visible = true;
    return slot;
  };

  const releasePortal = (slot: PooledPortalSlot) => {
    slot.inUse = false;
    slot.mesh.visible = false;
  };

  // ---------------- 7. INSTANCED BURST SPARKS & DUST PUFFS ----------------
  const sparkInst = new THREE.InstancedMesh(assets.geo.sparkBox, assets.mat.sparkMat, SPARK_CAPACITY);
  sparkInst.frustumCulled = false;
  sparkInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const sparks: SparkSlot[] = [];
  for (let i = 0; i < SPARK_CAPACITY; i++) {
    sparks.push({
      active: false,
      x: 0,
      y: -50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.4,
      scale: 1,
      colorHex: 0xffd60a,
    });
    sparkInst.setMatrixAt(i, _hiddenMatrix);
    sparkInst.setColorAt(i, _color.setHex(0xffd60a));
  }
  sparkInst.instanceMatrix.needsUpdate = true;
  if (sparkInst.instanceColor) sparkInst.instanceColor.needsUpdate = true;
  scene.add(sparkInst);

  let sparkCursor = 0;
  const spawnBurst = (
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count = 8,
    spread = 5.5,
  ) => {
    _color.setHex(colorHex);
    for (let n = 0; n < count; n++) {
      const idx = sparkCursor;
      sparkCursor = (sparkCursor + 1) % SPARK_CAPACITY;
      const s = sparks[idx];
      s.active = true;
      s.x = x;
      s.y = y;
      s.z = z;
      const angle = (n / count) * Math.PI * 2 + Math.random() * 0.6;
      const speed = spread * (0.45 + Math.random() * 0.75);
      s.vx = Math.cos(angle) * speed;
      s.vy = 2.4 + Math.random() * 4.5;
      s.vz = Math.sin(angle) * speed * 0.7;
      s.maxLife = 0.28 + Math.random() * 0.24;
      s.life = s.maxLife;
      s.scale = 0.7 + Math.random() * 0.75;
      s.colorHex = colorHex;
      sparkInst.setColorAt(idx, _color);
    }
    if (sparkInst.instanceColor) sparkInst.instanceColor.needsUpdate = true;
  };

  const updateSparks = (dt: number, forwardStep: number) => {
    let dirty = false;
    for (let i = 0; i < SPARK_CAPACITY; i++) {
      const s = sparks[i];
      if (!s.active) continue;
      dirty = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        sparkInst.setMatrixAt(i, _hiddenMatrix);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt + forwardStep * 0.45;
      s.vy -= 18 * dt;
      const ratio = s.life / s.maxLife;
      _dummy.position.set(s.x, s.y, s.z);
      _dummy.rotation.set(ratio * 4, ratio * 6, 0);
      _dummy.scale.setScalar(s.scale * ratio);
      _dummy.updateMatrix();
      sparkInst.setMatrixAt(i, _dummy.matrix);
    }
    if (dirty) {
      sparkInst.instanceMatrix.needsUpdate = true;
    }
  };

  // ---------------- 8. INSTANCED MONSOON RAIN STREAKS ----------------
  const rainInst = new THREE.InstancedMesh(assets.geo.rainStreak, assets.mat.rainMat, RAIN_CAPACITY);
  rainInst.frustumCulled = false;
  rainInst.visible = false;
  rainInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const rainDrops: RainSlot[] = [];
  for (let i = 0; i < RAIN_CAPACITY; i++) {
    rainDrops.push({
      x: (Math.random() - 0.5) * 26,
      y: Math.random() * 16 + 1,
      z: -Math.random() * 68 + 8,
      speed: 22 + Math.random() * 14,
    });
    rainInst.setMatrixAt(i, _hiddenMatrix);
  }
  rainInst.instanceMatrix.needsUpdate = true;
  scene.add(rainInst);

  const updateRain = (dt: number, intensity: number, playerX: number, underground: boolean) => {
    if (intensity <= 0.02 || underground) {
      rainInst.visible = false;
      return;
    }
    rainInst.visible = true;
    const activeCount = Math.floor(RAIN_CAPACITY * Math.min(1, intensity));
    const heavy = intensity > 0.65;
    assets.mat.rainMat.opacity = heavy ? 0.8 : 0.48;
    const windX = heavy ? -5.8 : -2.2;
    const tiltZ = heavy ? 0.18 : 0.07;

    for (let i = 0; i < RAIN_CAPACITY; i++) {
      if (i >= activeCount) {
        rainInst.setMatrixAt(i, _hiddenMatrix);
        continue;
      }
      const d = rainDrops[i];
      d.y -= d.speed * (heavy ? 1.35 : 0.9) * dt;
      d.x += windX * dt;
      d.z += 16 * dt;
      if (d.y < 0.2 || d.z > 10) {
        d.y = 14 + Math.random() * 6;
        d.x = playerX + (Math.random() - 0.5) * 26;
        d.z = -Math.random() * 64 + 4;
      }
      _dummy.position.set(d.x, d.y, d.z);
      _dummy.rotation.set(0, 0, tiltZ);
      _dummy.scale.set(1, heavy ? 1.55 : 0.9, 1);
      _dummy.updateMatrix();
      rainInst.setMatrixAt(i, _dummy.matrix);
    }
    rainInst.instanceMatrix.needsUpdate = true;
  };

  // ---------------- 9. DYNAMIC HOVERBOARD/DRONE RIBBON TRAIL ----------------
  const ribbonPositions = new Float32Array(RIBBON_SEGMENTS * 2 * 3);
  const ribbonIndices: number[] = [];
  for (let i = 0; i < RIBBON_SEGMENTS - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    ribbonIndices.push(a, b, c, b, d, c);
  }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPositions, 3));
  ribbonGeo.setIndex(ribbonIndices);
  const ribbonMat = new THREE.MeshBasicMaterial({
    color: 0x00f5d4,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonMesh.frustumCulled = false;
  ribbonMesh.visible = false;
  scene.add(ribbonMesh);

  const trailPtsX = new Float32Array(RIBBON_SEGMENTS);
  const trailPtsY = new Float32Array(RIBBON_SEGMENTS);
  const trailPtsZ = new Float32Array(RIBBON_SEGMENTS);
  let ribbonSampleAccum = 0;
  let ribbonInitialized = false;

  const resetRibbon = () => {
    ribbonInitialized = false;
    ribbonMesh.visible = false;
  };

  const updateRibbon = (
    dt: number,
    forwardStep: number,
    active: boolean,
    x: number,
    y: number,
    colorHex: number,
  ) => {
    if (!active) {
      ribbonMesh.visible = false;
      ribbonInitialized = false;
      return;
    }
    ribbonMat.color.setHex(colorHex);
    ribbonMesh.visible = true;

    if (!ribbonInitialized) {
      for (let i = 0; i < RIBBON_SEGMENTS; i++) {
        trailPtsX[i] = x;
        trailPtsY[i] = y;
        trailPtsZ[i] = i * 0.4;
      }
      ribbonInitialized = true;
    } else {
      for (let i = 1; i < RIBBON_SEGMENTS; i++) {
        trailPtsZ[i] += forwardStep;
      }
      ribbonSampleAccum += dt;
      if (ribbonSampleAccum >= 0.016) {
        ribbonSampleAccum = 0;
        for (let i = RIBBON_SEGMENTS - 1; i > 0; i--) {
          trailPtsX[i] = trailPtsX[i - 1];
          trailPtsY[i] = trailPtsY[i - 1];
          trailPtsZ[i] = trailPtsZ[i - 1];
        }
      }
      trailPtsX[0] = x;
      trailPtsY[0] = y;
      trailPtsZ[0] = 0.65;
    }

    for (let i = 0; i < RIBBON_SEGMENTS; i++) {
      const halfW = (1 - i / (RIBBON_SEGMENTS - 1)) * 0.44;
      const baseIdx = i * 6;
      ribbonPositions[baseIdx] = trailPtsX[i] - halfW;
      ribbonPositions[baseIdx + 1] = trailPtsY[i];
      ribbonPositions[baseIdx + 2] = trailPtsZ[i];
      ribbonPositions[baseIdx + 3] = trailPtsX[i] + halfW;
      ribbonPositions[baseIdx + 4] = trailPtsY[i];
      ribbonPositions[baseIdx + 5] = trailPtsZ[i];
    }
    ribbonGeo.attributes.position.needsUpdate = true;
  };

  // ---------------- 10. HOVERBOARD SHIELD-BREAK SHOCKWAVE RING ----------------
  const shockwaveMesh = new THREE.Mesh(assets.geo.shockwaveRing, assets.mat.shockwaveMat);
  shockwaveMesh.rotation.x = -Math.PI / 2;
  shockwaveMesh.visible = false;
  scene.add(shockwaveMesh);

  let shockwaveTimer = 0;
  const SHOCKWAVE_DURATION = 0.48;

  const triggerShockwave = (x: number, y: number, colorHex = 0x00f5d4) => {
    shockwaveTimer = SHOCKWAVE_DURATION;
    assets.mat.shockwaveMat.color.setHex(colorHex);
    assets.mat.shockwaveMat.opacity = 0.92;
    shockwaveMesh.position.set(x, Math.max(0.25, y + 0.4), 0);
    shockwaveMesh.scale.setScalar(1);
    shockwaveMesh.visible = true;
  };

  const updateShockwave = (dt: number) => {
    if (shockwaveTimer <= 0) return;
    shockwaveTimer = Math.max(0, shockwaveTimer - dt);
    const t = 1 - shockwaveTimer / SHOCKWAVE_DURATION;
    const radius = 1 + t * 18;
    shockwaveMesh.scale.setScalar(radius);
    assets.mat.shockwaveMat.opacity = (1 - t) * 0.9;
    if (shockwaveTimer <= 0) {
      shockwaveMesh.visible = false;
    }
  };

  // ---------------- RESET & DISPOSE ----------------
  const resetAll = () => {
    clearTokens();
    for (const s of trainSlots) releaseTrain(s);
    for (const o of obstacleSlots) releaseObstacle(o);
    for (const p of powerUps) releasePowerUp(p);
    for (const st of stations) releaseStation(st);
    for (const po of portals) releasePortal(po);
    for (let i = 0; i < SPARK_CAPACITY; i++) {
      sparks[i].active = false;
      sparkInst.setMatrixAt(i, _hiddenMatrix);
    }
    sparkInst.instanceMatrix.needsUpdate = true;
    rainInst.visible = false;
    resetRibbon();
    shockwaveTimer = 0;
    shockwaveMesh.visible = false;
  };

  const dispose = () => {
    ribbonGeo.dispose();
    ribbonMat.dispose();
  };

  return {
    tokenRimInst,
    tokenCoreInst,
    tokens,
    spawnToken,
    clearTokens,
    updateTokens,
    acquireTrain,
    releaseTrain,
    acquireObstacle,
    releaseObstacle,
    powerUps,
    acquirePowerUp,
    releasePowerUp,
    stations,
    acquireStation,
    releaseStation,
    portals,
    acquirePortal,
    releasePortal,
    sparkInst,
    spawnBurst,
    updateSparks,
    rainInst,
    updateRain,
    ribbonMesh,
    resetRibbon,
    updateRibbon,
    shockwaveMesh,
    triggerShockwave,
    updateShockwave,
    resetAll,
    dispose,
  };
}
