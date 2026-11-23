import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyCurvedWorldShader, type WorldShaderUniforms } from './shaders';
import type { TextureLibrary } from './textures';

/**
 * Safely normalizes (converts to non-indexed, strips mismatched attributes) and
 * merges multiple static BufferGeometries into a single draw-call geometry.
 */
export function mergeStaticGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized: THREE.BufferGeometry[] = [];
  for (const raw of parts) {
    const g = raw.index ? raw.toNonIndexed() : raw.clone();
    if (!g.getAttribute('normal')) {
      g.computeVertexNormals();
    }
    // Keep only position, normal, uv so heterogeneous primitives merge cleanly
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') {
        g.deleteAttribute(key);
      }
    }
    if (!g.getAttribute('uv')) {
      const count = g.getAttribute('position').count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    normalized.push(g);
  }
  const merged = mergeGeometries(normalized, false);
  for (const g of normalized) g.dispose();
  if (!merged) {
    throw new Error('Failed to merge static geometries');
  }
  return merged;
}

export interface AssetRegistry {
  uniforms: WorldShaderUniforms;
  textures: TextureLibrary;
  geo: {
    // Token dual-instanced geometries
    tokenRim: THREE.CylinderGeometry;
    tokenCore: THREE.CylinderGeometry;
    // Train geometries (pre-merged for ~5-6 draw calls per train!)
    trainBodyStatic: THREE.BoxGeometry;
    trainBodyMoving: THREE.BoxGeometry;
    trainFrontPlanesStatic: THREE.BufferGeometry;
    trainFrontPlanesMoving: THREE.BufferGeometry;
    trainRoofStatic: THREE.CylinderGeometry;
    trainRoofMoving: THREE.CylinderGeometry;
    trainDarkDetailsStatic: THREE.BufferGeometry;
    trainDarkDetailsMoving: THREE.BufferGeometry;
    trainHeadlightsStatic: THREE.BufferGeometry;
    trainHeadlightsMoving: THREE.BufferGeometry;
    trainHeadlightBeamsMoving: THREE.BufferGeometry;
    trainRamp: THREE.ExtrudeGeometry;
    trainRampBars: THREE.BufferGeometry;
    trainShadowStatic: THREE.PlaneGeometry;
    trainShadowMoving: THREE.PlaneGeometry;
    // Obstacles (pre-merged for 2-3 draw calls per obstacle!)
    barrierBoard: THREE.BoxGeometry;
    barrierPostsMerged: THREE.BufferGeometry;
    bbmpPanel: THREE.BoxGeometry;
    bbmpLegsMerged: THREE.BufferGeometry;
    bbmpBeacon: THREE.CylinderGeometry;
    gantryFrameMerged: THREE.BufferGeometry;
    gantryBeam: THREE.BoxGeometry;
    pillarShaft: THREE.BoxGeometry;
    pillarTrimMerged: THREE.BufferGeometry;
    // Particles & VFX
    sparkBox: THREE.BoxGeometry;
    rainStreak: THREE.BoxGeometry;
    glowPlane: THREE.PlaneGeometry;
    contactShadowDisc: THREE.CircleGeometry;
    shockwaveRing: THREE.RingGeometry;
    // Power-up shared pieces
    haloTorus: THREE.TorusGeometry;
    mysteryCrate: THREE.BoxGeometry;
  };
  mat: {
    // Track & viaduct
    trackDeck: THREE.MeshStandardMaterial;
    viaductWall: THREE.MeshStandardMaterial;
    viaductPier: THREE.MeshStandardMaterial;
    trimPurple: THREE.MeshStandardMaterial;
    trimYellow: THREE.MeshStandardMaterial;
    trimRed: THREE.MeshStandardMaterial;
    darkMetal: THREE.MeshStandardMaterial;
    steelPole: THREE.MeshStandardMaterial;
    kannadaFlag: THREE.MeshStandardMaterial;
    // Tunnel
    tunnelWall: THREE.MeshStandardMaterial;
    tunnelRib: THREE.MeshStandardMaterial;
    tunnelLightStrip: THREE.MeshStandardMaterial;
    tunnelNeonPurple: THREE.MeshStandardMaterial;
    tunnelExitGreen: THREE.MeshStandardMaterial;
    // Tokens
    tokenGold: THREE.MeshStandardMaterial;
    tokenCorePurple: THREE.MeshStandardMaterial;
    // Trains
    trainSidePurple: THREE.MeshStandardMaterial;
    trainSideGreen: THREE.MeshStandardMaterial;
    trainFrontPurple: THREE.MeshStandardMaterial;
    trainFrontGreen: THREE.MeshStandardMaterial;
    trainFrontMajestic: THREE.MeshStandardMaterial;
    trainRoof: THREE.MeshStandardMaterial;
    trainDark: THREE.MeshStandardMaterial;
    headlightEmissive: THREE.MeshStandardMaterial;
    rampPurple: THREE.MeshStandardMaterial;
    rampGreen: THREE.MeshStandardMaterial;
    rampGripGold: THREE.MeshStandardMaterial;
    // Obstacles
    mindTheGap: THREE.MeshStandardMaterial;
    bbmpHazard: THREE.MeshStandardMaterial;
    pillarHazard: THREE.MeshStandardMaterial;
    beaconAmber: THREE.MeshStandardMaterial;
    signalRed: THREE.MeshStandardMaterial;
    signalGreen: THREE.MeshStandardMaterial;
    gantrySteel: THREE.MeshStandardMaterial;
    // Power-up materials
    kaapiBrass: THREE.MeshStandardMaterial;
    kaapiFroth: THREE.MeshStandardMaterial;
    magnetRed: THREE.MeshStandardMaterial;
    magnetGold: THREE.MeshStandardMaterial;
    dronePurple: THREE.MeshStandardMaterial;
    droneCyan: THREE.MeshStandardMaterial;
    sneakerGreen: THREE.MeshStandardMaterial;
    sneakerGold: THREE.MeshStandardMaterial;
    multiplierGold: THREE.MeshStandardMaterial;
    mysteryBox: THREE.MeshStandardMaterial;
    // Additive fake-bloom & shadows
    contactShadow: THREE.MeshBasicMaterial;
    glowGold: THREE.SpriteMaterial;
    glowCyan: THREE.SpriteMaterial;
    glowPurple: THREE.SpriteMaterial;
    glowRed: THREE.SpriteMaterial;
    glowGreen: THREE.SpriteMaterial;
    glowHeadlight: THREE.SpriteMaterial;
    headlightCone: THREE.MeshBasicMaterial;
    // Scenery & Skyline
    groundPark: THREE.MeshStandardMaterial;
    groundAvenue: THREE.MeshStandardMaterial;
    roadDash: THREE.MeshStandardMaterial;
    treeTrunk: THREE.MeshStandardMaterial;
    treeBlossom: THREE.MeshStandardMaterial;
    techTower: THREE.MeshStandardMaterial;
    shopfront: THREE.MeshStandardMaterial;
    vidhanaStone: THREE.MeshStandardMaterial;
    vidhanaGold: THREE.MeshStandardMaterial;
    cloudMat: THREE.MeshStandardMaterial;
    // VFX
    sparkMat: THREE.MeshBasicMaterial;
    rainMat: THREE.MeshBasicMaterial;
    shockwaveMat: THREE.MeshBasicMaterial;
  };
  setTrackWetness: (wetness: number) => void;
  dispose: () => void;
}

export function createAssetRegistry(
  textures: TextureLibrary,
  uniforms: WorldShaderUniforms,
): AssetRegistry {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geos.push(g);
    return g;
  };
  const regMat = <T extends THREE.Material>(
    m: T,
    curved = true,
    opts: { rim?: boolean; rimScale?: number; wetSheen?: boolean } = {},
  ): T => {
    if (curved) {
      applyCurvedWorldShader(m, uniforms, opts);
    }
    mats.push(m);
    return m;
  };

  // Pre-build shared ramp geometry once
  const rampLen = 5.4;
  const rampH = 3.05;
  const rampShape = new THREE.Shape();
  rampShape.moveTo(0, 0);
  rampShape.lineTo(rampLen, 0);
  rampShape.lineTo(0, rampH);
  rampShape.closePath();
  const trainRampGeo = new THREE.ExtrudeGeometry(rampShape, {
    depth: 2.34,
    bevelEnabled: false,
  });
  trainRampGeo.center();

  // Merge all 4 golden ramp grip bars into 1 geometry
  const rampBarParts: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 4; s++) {
    const t = (s + 0.6) / 4.2;
    const bar = new THREE.BoxGeometry(2.22, 0.09, 0.24);
    bar.rotateX(Math.atan2(rampH, rampLen));
    bar.translate(0, t * rampH + 0.08, 8 + (1 - t) * rampLen);
    rampBarParts.push(bar);
  }
  const trainRampBars = regGeo(mergeStaticGeometries(rampBarParts));
  for (const g of rampBarParts) g.dispose();

  const tokenRim = regGeo(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 14));
  tokenRim.rotateX(Math.PI / 2);
  const tokenCore = regGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.145, 14));
  tokenCore.rotateX(Math.PI / 2);

  const trainRoofStatic = regGeo(
    new THREE.CylinderGeometry(1.22, 1.24, 16, 12, 1, false, 0, Math.PI),
  );
  trainRoofStatic.rotateZ(Math.PI / 2);
  trainRoofStatic.rotateY(Math.PI / 2);
  trainRoofStatic.scale(1, 0.26, 1);

  const trainRoofMoving = regGeo(
    new THREE.CylinderGeometry(1.22, 1.24, 18, 12, 1, false, 0, Math.PI),
  );
  trainRoofMoving.rotateZ(Math.PI / 2);
  trainRoofMoving.rotateY(Math.PI / 2);
  trainRoofMoving.scale(1, 0.26, 1);

  // Helper to pre-merge front + rear BEML cab face planes into 1 single-material draw call
  const buildTrainFrontPlanes = (len: number) => {
    const bodyH = 2.74;
    const front = new THREE.PlaneGeometry(2.44, bodyH);
    front.translate(0, bodyH / 2 + 0.2, len / 2 + 0.015);
    const rear = new THREE.PlaneGeometry(2.44, bodyH);
    rear.rotateY(Math.PI);
    rear.translate(0, bodyH / 2 + 0.2, -len / 2 - 0.015);
    const merged = mergeStaticGeometries([front, rear]);
    front.dispose();
    rear.dispose();
    return regGeo(merged);
  };

  // Helper to pre-merge bogie + beveled nose visor + HVAC pods + pantograph into 1 dark-metal draw call
  const buildTrainDarkDetails = (len: number, acCount: number) => {
    const bodyH = 2.74;
    const parts: THREE.BufferGeometry[] = [];
    const bogie = new THREE.BoxGeometry(2.08, 0.28, len - 0.8);
    bogie.translate(0, 0.14, 0);
    parts.push(bogie);

    const nose = new THREE.BoxGeometry(2.34, 0.42, 0.46);
    nose.rotateX(0.24);
    nose.translate(0, bodyH + 0.05, len / 2 - 0.12);
    parts.push(nose);

    for (let i = 0; i < acCount; i++) {
      const zPos = -len / 2 + 2.8 + i * ((len - 5.6) / Math.max(1, acCount - 1));
      const ac = new THREE.BoxGeometry(1.48, 0.18, 1.95);
      ac.translate(0, bodyH + 0.34, zPos);
      parts.push(ac);
    }

    const pantoL = new THREE.BoxGeometry(0.08, 0.55, 0.08);
    pantoL.rotateZ(0.35);
    pantoL.translate(-0.32, bodyH + 0.45, 0);
    const pantoR = new THREE.BoxGeometry(0.08, 0.55, 0.08);
    pantoR.rotateZ(-0.35);
    pantoR.translate(0.32, bodyH + 0.45, 0);
    parts.push(pantoL, pantoR);

    const merged = mergeStaticGeometries(parts);
    for (const g of parts) g.dispose();
    return regGeo(merged);
  };

  // Helper to pre-merge left + right glowing LED headlights into 1 draw call
  const buildTrainHeadlights = (len: number) => {
    const l = new THREE.BoxGeometry(0.4, 0.22, 0.08);
    l.translate(-0.74, 0.92, len / 2 + 0.04);
    const r = new THREE.BoxGeometry(0.4, 0.22, 0.08);
    r.translate(0.74, 0.92, len / 2 + 0.04);
    const merged = mergeStaticGeometries([l, r]);
    l.dispose();
    r.dispose();
    return regGeo(merged);
  };

  // Pre-merged twin volumetric headlight cones for moving express trains (1 draw call)
  const beamL = new THREE.PlaneGeometry(1.6, 8.2);
  beamL.rotateX(-Math.PI / 2 + 0.08);
  beamL.translate(-0.74, 0.48, 18 / 2 + 4.15);
  const beamR = new THREE.PlaneGeometry(1.6, 8.2);
  beamR.rotateX(-Math.PI / 2 + 0.08);
  beamR.translate(0.74, 0.48, 18 / 2 + 4.15);
  const trainHeadlightBeamsMoving = regGeo(mergeStaticGeometries([beamL, beamR]));
  beamL.dispose();
  beamR.dispose();

  // Pre-merged obstacle frame geometries (cuts obstacle draw calls by 60%+)
  const bpL = new THREE.CylinderGeometry(0.09, 0.11, 1.42, 8);
  bpL.translate(-1.06, 0.7, 0);
  const bpR = new THREE.CylinderGeometry(0.09, 0.11, 1.42, 8);
  bpR.translate(1.06, 0.7, 0);
  const barrierPostsMerged = regGeo(mergeStaticGeometries([bpL, bpR]));
  bpL.dispose();
  bpR.dispose();

  const bbmpLegParts: THREE.BufferGeometry[] = [];
  for (const lx of [-0.95, 0.95]) {
    const legF = new THREE.BoxGeometry(0.12, 1.18, 0.12);
    legF.rotateX(-0.32);
    legF.translate(lx, 0.55, 0.24);
    const legB = new THREE.BoxGeometry(0.12, 1.18, 0.12);
    legB.rotateX(0.32);
    legB.translate(lx, 0.55, -0.24);
    bbmpLegParts.push(legF, legB);
  }
  const bbmpLegsMerged = regGeo(mergeStaticGeometries(bbmpLegParts));
  for (const g of bbmpLegParts) g.dispose();

  const gpL = new THREE.BoxGeometry(0.24, 3.2, 0.28);
  gpL.translate(-1.25, 1.6, 0);
  const gpR = new THREE.BoxGeometry(0.24, 3.2, 0.28);
  gpR.translate(1.25, 1.6, 0);
  const gRail = new THREE.BoxGeometry(2.76, 0.24, 0.32);
  gRail.translate(0, 2.55, 0);
  const gantryFrameMerged = regGeo(mergeStaticGeometries([gpL, gpR, gRail]));
  gpL.dispose();
  gpR.dispose();
  gRail.dispose();

  const pBase = new THREE.BoxGeometry(1.12, 0.34, 1.12);
  pBase.translate(0, 0.17, 0);
  const pCap = new THREE.BoxGeometry(1.16, 0.28, 1.16);
  pCap.translate(0, 4.68, 0);
  const pillarTrimMerged = regGeo(mergeStaticGeometries([pBase, pCap]));
  pBase.dispose();
  pCap.dispose();

  const geo: AssetRegistry['geo'] = {
    tokenRim,
    tokenCore,
    trainBodyStatic: regGeo(new THREE.BoxGeometry(2.44, 2.74, 16)),
    trainBodyMoving: regGeo(new THREE.BoxGeometry(2.44, 2.74, 18)),
    trainFrontPlanesStatic: buildTrainFrontPlanes(16),
    trainFrontPlanesMoving: buildTrainFrontPlanes(18),
    trainRoofStatic,
    trainRoofMoving,
    trainDarkDetailsStatic: buildTrainDarkDetails(16, 2),
    trainDarkDetailsMoving: buildTrainDarkDetails(18, 3),
    trainHeadlightsStatic: buildTrainHeadlights(16),
    trainHeadlightsMoving: buildTrainHeadlights(18),
    trainHeadlightBeamsMoving,
    trainRamp: regGeo(trainRampGeo),
    trainRampBars,
    trainShadowStatic: regGeo(new THREE.PlaneGeometry(3.15, 17.4)),
    trainShadowMoving: regGeo(new THREE.PlaneGeometry(3.15, 19.4)),
    barrierBoard: regGeo(new THREE.BoxGeometry(2.38, 0.88, 0.24)),
    barrierPostsMerged,
    bbmpPanel: regGeo(new THREE.BoxGeometry(2.44, 1.0, 0.26)),
    bbmpLegsMerged,
    bbmpBeacon: regGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.28, 10)),
    gantryFrameMerged,
    gantryBeam: regGeo(new THREE.BoxGeometry(2.68, 0.96, 0.36)),
    pillarShaft: regGeo(new THREE.BoxGeometry(0.86, 4.6, 0.86)),
    pillarTrimMerged,
    sparkBox: regGeo(new THREE.BoxGeometry(0.22, 0.22, 0.22)),
    rainStreak: regGeo(new THREE.BoxGeometry(0.09, 0.62, 0.07)),
    glowPlane: regGeo(new THREE.PlaneGeometry(1, 1)),
    contactShadowDisc: regGeo(new THREE.CircleGeometry(0.82, 16)),
    shockwaveRing: regGeo(new THREE.RingGeometry(0.65, 1.15, 28)),
    haloTorus: regGeo(new THREE.TorusGeometry(0.7, 0.065, 8, 20)),
    mysteryCrate: regGeo(new THREE.BoxGeometry(0.84, 0.84, 0.84)),
  };

  const trackDeck = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.trackBed,
      roughness: 0.72,
      metalness: 0.14,
    }),
    true,
    { rim: false, wetSheen: true },
  );

  const trainRoof = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbe4ee,
      roughness: 0.45,
      metalness: 0.35,
    }),
    true,
    { rim: true, rimScale: 0.8, wetSheen: true },
  );

  const makeGlowSpriteMat = (hex: number, opacity = 0.85) =>
    regMat(
      new THREE.SpriteMaterial({
        map: textures.glowSprite,
        color: hex,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      false,
    );

  const mat: AssetRegistry['mat'] = {
    trackDeck,
    viaductWall: regMat(
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.68 }),
      true,
      { rim: true, rimScale: 0.4 },
    ),
    viaductPier: regMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 }), true),
    trimPurple: regMat(
      new THREE.MeshStandardMaterial({ color: 0x7b2cbf, roughness: 0.35, metalness: 0.22 }),
      true,
      { rim: true, rimScale: 0.6 },
    ),
    trimYellow: regMat(
      new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.32, metalness: 0.18 }),
      true,
      { rim: true, rimScale: 0.6 },
    ),
    trimRed: regMat(
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, metalness: 0.18 }),
      true,
      { rim: true, rimScale: 0.6 },
    ),
    darkMetal: regMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.44, metalness: 0.62 }),
      true,
      { rim: true, rimScale: 0.5 },
    ),
    steelPole: regMat(
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.6 }),
      true,
    ),
    kannadaFlag: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.kannadaFlag,
        roughness: 0.45,
        side: THREE.DoubleSide,
      }),
      true,
    ),
    tunnelWall: regMat(new THREE.MeshStandardMaterial({ color: 0x191529, roughness: 0.8 }), true),
    tunnelRib: regMat(
      new THREE.MeshStandardMaterial({ color: 0x2f254a, roughness: 0.62, metalness: 0.25 }),
      true,
      { rim: true, rimScale: 0.5 },
    ),
    tunnelLightStrip: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x7dd3fc,
        emissiveIntensity: 2.2,
      }),
      true,
    ),
    tunnelNeonPurple: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x7b2cbf,
        emissiveIntensity: 2.0,
      }),
      true,
    ),
    tunnelExitGreen: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x2dc653,
        emissive: 0x2dc653,
        emissiveIntensity: 2.2,
      }),
      true,
    ),
    tokenGold: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffd60a,
        emissive: 0xd97706,
        emissiveIntensity: 0.62,
        roughness: 0.2,
        metalness: 0.78,
      }),
      true,
      { rim: true, rimScale: 1.2 },
    ),
    tokenCorePurple: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x7b2cbf,
        emissive: 0x7b2cbf,
        emissiveIntensity: 0.75,
        roughness: 0.26,
        metalness: 0.35,
      }),
      true,
    ),
    trainSidePurple: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.trainSidePurple,
        roughness: 0.26,
        metalness: 0.48,
      }),
      true,
      { rim: true, rimScale: 0.9 },
    ),
    trainSideGreen: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.trainSideGreen,
        roughness: 0.26,
        metalness: 0.48,
      }),
      true,
      { rim: true, rimScale: 0.9 },
    ),
    trainFrontPurple: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.trainFrontPurple,
        roughness: 0.2,
        metalness: 0.5,
      }),
      true,
      { rim: true, rimScale: 1.0 },
    ),
    trainFrontGreen: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.trainFrontGreen,
        roughness: 0.2,
        metalness: 0.5,
      }),
      true,
      { rim: true, rimScale: 1.0 },
    ),
    trainFrontMajestic: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.trainFrontMajestic,
        roughness: 0.2,
        metalness: 0.5,
      }),
      true,
      { rim: true, rimScale: 1.0 },
    ),
    trainRoof,
    trainDark: regMat(
      new THREE.MeshStandardMaterial({ color: 0x1a1423, roughness: 0.72, metalness: 0.25 }),
      true,
    ),
    headlightEmissive: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xfff9db,
        emissive: 0xffea70,
        emissiveIntensity: 2.6,
        roughness: 0.1,
      }),
      true,
    ),
    rampPurple: regMat(
      new THREE.MeshStandardMaterial({ color: 0x7b2cbf, roughness: 0.42, metalness: 0.22 }),
      true,
      { rim: true, rimScale: 0.85 },
    ),
    rampGreen: regMat(
      new THREE.MeshStandardMaterial({ color: 0x2dc653, roughness: 0.42, metalness: 0.22 }),
      true,
      { rim: true, rimScale: 0.85 },
    ),
    rampGripGold: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffd60a,
        emissive: 0xca8a04,
        emissiveIntensity: 0.4,
        roughness: 0.35,
      }),
      true,
    ),
    mindTheGap: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.mindTheGap,
        roughness: 0.4,
      }),
      true,
      { rim: true, rimScale: 0.85 },
    ),
    bbmpHazard: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.bbmpHazard,
        roughness: 0.45,
      }),
      true,
      { rim: true, rimScale: 0.85 },
    ),
    pillarHazard: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.pillarHazard,
        roughness: 0.5,
        metalness: 0.2,
      }),
      true,
      { rim: true, rimScale: 0.9 },
    ),
    beaconAmber: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xff9f1c,
        emissive: 0xff6b00,
        emissiveIntensity: 2.0,
      }),
      true,
    ),
    signalRed: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 2.2,
      }),
      true,
    ),
    signalGreen: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x2dc653,
        emissive: 0x2dc653,
        emissiveIntensity: 1.8,
      }),
      true,
    ),
    gantrySteel: regMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.55 }),
      true,
      { rim: true, rimScale: 0.7 },
    ),
    kaapiBrass: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xf5b700,
        emissive: 0x92400e,
        emissiveIntensity: 0.35,
        roughness: 0.18,
        metalness: 0.85,
      }),
      true,
      { rim: true, rimScale: 1.2 },
    ),
    kaapiFroth: regMat(
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 }),
      true,
    ),
    magnetRed: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.45,
      }),
      true,
      { rim: true, rimScale: 1.1 },
    ),
    magnetGold: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xeab308,
        emissive: 0x854d0e,
        emissiveIntensity: 0.4,
        roughness: 0.35,
        metalness: 0.55,
      }),
      true,
      { rim: true, rimScale: 1.1 },
    ),
    dronePurple: regMat(
      new THREE.MeshStandardMaterial({ color: 0x7b2cbf, roughness: 0.28, metalness: 0.48 }),
      true,
      { rim: true, rimScale: 1.2 },
    ),
    droneCyan: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x00f5d4,
        emissive: 0x00f5d4,
        emissiveIntensity: 1.75,
        roughness: 0.2,
      }),
      true,
    ),
    sneakerGreen: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x2dc653,
        emissive: 0x15803d,
        emissiveIntensity: 0.45,
        roughness: 0.28,
        metalness: 0.2,
      }),
      true,
      { rim: true, rimScale: 1.25 },
    ),
    sneakerGold: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffd60a,
        emissive: 0xca8a04,
        emissiveIntensity: 0.6,
        roughness: 0.25,
        metalness: 0.6,
      }),
      true,
    ),
    multiplierGold: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffd60a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.1,
        roughness: 0.2,
        metalness: 0.72,
      }),
      true,
      { rim: true, rimScale: 1.3 },
    ),
    mysteryBox: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.mysteryBox,
        emissive: 0x7b2cbf,
        emissiveIntensity: 0.45,
        roughness: 0.28,
        metalness: 0.35,
      }),
      true,
      { rim: true, rimScale: 1.3 },
    ),
    contactShadow: regMat(
      new THREE.MeshBasicMaterial({
        map: textures.contactShadow,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      }),
      true,
    ),
    glowGold: makeGlowSpriteMat(0xffd60a, 0.85),
    glowCyan: makeGlowSpriteMat(0x00f5d4, 0.9),
    glowPurple: makeGlowSpriteMat(0xc084fc, 0.88),
    glowRed: makeGlowSpriteMat(0xff4d6d, 0.82),
    glowGreen: makeGlowSpriteMat(0x2dc653, 0.85),
    glowHeadlight: makeGlowSpriteMat(0xfff4b0, 0.92),
    headlightCone: regMat(
      new THREE.MeshBasicMaterial({
        map: textures.lightCone,
        color: 0xfff6c2,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      true,
    ),
    groundPark: regMat(new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.92 }), true),
    groundAvenue: regMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 }), true),
    roadDash: regMat(new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 }), true),
    treeTrunk: regMat(new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.88 }), true),
    treeBlossom: regMat(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
      true,
      { rim: true, rimScale: 0.65 },
    ),
    techTower: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.techFacade,
        roughness: 0.25,
        metalness: 0.52,
      }),
      true,
      { rim: true, rimScale: 0.45 },
    ),
    shopfront: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.shopfrontFacade,
        roughness: 0.72,
      }),
      true,
      { rim: true, rimScale: 0.4 },
    ),
    vidhanaStone: regMat(
      new THREE.MeshStandardMaterial({ color: 0xede2cd, roughness: 0.72 }),
      true,
      { rim: true, rimScale: 0.55 },
    ),
    vidhanaGold: regMat(
      new THREE.MeshStandardMaterial({ color: 0xd4a359, roughness: 0.3, metalness: 0.55 }),
      true,
      { rim: true, rimScale: 0.8 },
    ),
    cloudMat: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.92,
        emissive: 0xe0f2fe,
        emissiveIntensity: 0.28,
      }),
      false,
    ),
    sparkMat: regMat(new THREE.MeshBasicMaterial({ color: 0xffffff }), true),
    rainMat: regMat(
      new THREE.MeshBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.78 }),
      false,
    ),
    shockwaveMat: regMat(
      new THREE.MeshBasicMaterial({
        color: 0x00f5d4,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      true,
    ),
  };

  return {
    uniforms,
    textures,
    geo,
    mat,
    setTrackWetness: (wetness: number) => {
      const clamped = Math.max(0, Math.min(1, wetness));
      uniforms.uWetness.value = clamped;
      trackDeck.roughness = 0.72 - clamped * 0.48;
      trackDeck.metalness = 0.14 + clamped * 0.28;
      trainRoof.roughness = 0.45 - clamped * 0.28;
      trainRoof.metalness = 0.35 + clamped * 0.28;
    },
    dispose: () => {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
