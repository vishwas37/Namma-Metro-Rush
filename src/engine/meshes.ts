import * as THREE from 'three';
import {
  CHARACTERS,
  HOVERBOARDS,
  type CharacterId,
  type HoverboardId,
  type MetroStation,
  type PowerUpType,
} from '../core/catalog';
import type { HazardKind } from '../core/simulation';
import { mergeStaticGeometries, type AssetRegistry } from './assets';
import { applyCurvedWorldShader } from './shaders';

export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        for (const m of child.material) m.dispose();
      } else {
        child.material.dispose();
      }
    }
  });
}

export interface RunnerRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftShin: THREE.Group;
  rightShin: THREE.Group;
  hoverboardMount: THREE.Group;
  droneMount: THREE.Group;
  droneRotors: THREE.Object3D[];
  sneakersLeft: THREE.Group;
  sneakersRight: THREE.Group;
  contactShadow: THREE.Mesh;
}

export interface ChaserRig {
  root: THREE.Group;
  inspectorBody: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  dogGroup: THREE.Group;
  dogTail: THREE.Object3D;
  dogLegs: THREE.Object3D[];
}

export interface UnifiedPowerUpRig {
  root: THREE.Group;
  spinGroup: THREE.Group;
  haloMesh: THREE.Mesh;
  haloMat: THREE.MeshStandardMaterial;
  glowSprite: THREE.Sprite;
  variants: Record<PowerUpType, THREE.Group>;
  setType: (type: PowerUpType) => void;
}

export interface PooledStationRig {
  root: THREE.Group;
  signMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  configure: (station: MetroStation) => void;
}

export function buildHoverboardMesh(skinId: HoverboardId, assets: AssetRegistry): THREE.Group {
  const def = HOVERBOARDS.find((h) => h.id === skinId) ?? HOVERBOARDS[0];
  const group = new THREE.Group();

  const primaryMat = applyCurvedWorldShader(
    new THREE.MeshStandardMaterial({ color: def.primaryColor, roughness: 0.3, metalness: 0.32 }),
    assets.uniforms,
    { rim: true, rimScale: 1.0 },
  );
  const secondaryMat = applyCurvedWorldShader(
    new THREE.MeshStandardMaterial({ color: def.secondaryColor, roughness: 0.26, metalness: 0.25 }),
    assets.uniforms,
    { rim: true, rimScale: 0.9 },
  );
  const glowMat = applyCurvedWorldShader(
    new THREE.MeshStandardMaterial({
      color: def.glowColor,
      emissive: def.glowColor,
      emissiveIntensity: 2.0,
      roughness: 0.18,
    }),
    assets.uniforms,
  );

  // Aerodynamic rounded board deck
  const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.54, 1.38, 6, 12), primaryMat);
  deck.rotation.x = Math.PI / 2;
  deck.scale.set(1.05, 1.0, 0.22);
  deck.position.set(0, 0.28, 0);
  deck.castShadow = true;
  group.add(deck);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.32, 0.62), secondaryMat);
  nose.position.set(0, 0.42, -0.88);
  group.add(nose);

  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10), glowMat);
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, 0.44, -1.2);
  group.add(lamp);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.1, 0.34), secondaryMat);
  spoiler.position.set(0, 0.47, 0.92);
  group.add(spoiler);

  for (const sx of [-0.55, 0.55]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 1.85), assets.mat.darkMetal);
    rail.position.set(sx, 0.27, 0);
    group.add(rail);
  }

  // Twin glowing hover thrusters + additive fake-bloom sprites
  for (const sx of [-0.34, 0.34]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.18, 10), assets.mat.darkMetal);
    pod.position.set(sx, 0.13, 0.62);
    group.add(pod);

    const flame = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.04, 0.22, 8), glowMat);
    flame.position.set(sx, 0.04, 0.62);
    group.add(flame);

    const halo = new THREE.Sprite(assets.mat.glowCyan);
    halo.position.set(sx, 0.1, 0.72);
    halo.scale.set(0.95, 0.95, 1);
    group.add(halo);
  }

  return group;
}

export function buildDronePack(assets: AssetRegistry): { group: THREE.Group; rotors: THREE.Object3D[] } {
  const group = new THREE.Group();
  const rotors: THREE.Object3D[] = [];

  const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.34, 6, 10), assets.mat.dronePurple);
  core.position.set(0, 1.38, 0.46);
  group.add(core);

  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), assets.mat.trimYellow);
  badge.position.set(0, 1.42, 0.76);
  group.add(badge);

  for (const [ax, az] of [
    [-0.82, 0.64],
    [0.82, 0.64],
    [-0.76, 0.22],
    [0.76, 0.22],
  ]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.08), assets.mat.darkMetal);
    strut.position.set(ax * 0.52, 1.68, az);
    group.add(strut);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10), assets.mat.trimYellow);
    motor.position.set(ax, 1.72, az);
    group.add(motor);

    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(ax, 1.82, az);
    bladeGroup.add(
      new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.09), assets.mat.droneCyan),
      new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.7), assets.mat.droneCyan),
    );
    group.add(bladeGroup);
    rotors.push(bladeGroup);
  }

  const glow = new THREE.Sprite(assets.mat.glowCyan);
  glow.position.set(0, 1.25, 0.65);
  glow.scale.set(1.6, 1.6, 1);
  group.add(glow);

  return { group, rotors };
}

function buildSuperSneakerBoot(assets: AssetRegistry): THREE.Group {
  const boot = new THREE.Group();
  const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.22, 10), assets.mat.sneakerGold);
  spring.position.set(0, -0.44, -0.05);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.56), assets.mat.sneakerGreen);
  sole.position.set(0, -0.32, -0.06);
  const glow = new THREE.Sprite(assets.mat.glowGreen);
  glow.position.set(0, -0.42, -0.06);
  glow.scale.set(0.75, 0.75, 1);
  boot.add(spring, sole, glow);
  return boot;
}

/**
 * Sculpted Fortnite / Subway Surfers stylized runner rig using CapsuleGeometry
 * torso & articulated limbs (shoulder/elbow + hip/knee), expressive stylized
 * head/eyes/brows, chunky sneakers, hoodie straps/backpack, hoverboard & drone.
 */
export function buildRunnerRig(
  charId: CharacterId,
  boardId: HoverboardId,
  assets: AssetRegistry,
): RunnerRig {
  const def = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.92, 0);
  bodyGroup.add(torsoGroup);
  root.add(bodyGroup);

  const mkMat = (color: number, roughness: number, metalness = 0.08, rimScale = 1.15) =>
    applyCurvedWorldShader(
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
      assets.uniforms,
      { rim: true, rimScale },
    );

  const primaryMat = mkMat(def.primaryColor, 0.56, 0.08, 1.2);
  const secondaryMat = mkMat(def.secondaryColor, 0.68, 0.1, 1.0);
  const skinMat = mkMat(def.skinColor, 0.62, 0.02, 0.9);
  const hairMat = mkMat(def.hairColor, 0.78, 0.05, 0.8);
  const shoeMat = mkMat(def.shoeColor, 0.32, 0.18, 1.2);
  const whiteMat = mkMat(0xffffff, 0.42, 0.05, 0.8);
  const goldMat = mkMat(0xffd60a, 0.24, 0.65, 1.25);

  // Sculpted tapered hoodie / torso (merged static parts per material!)
  const torsoParts: THREE.BufferGeometry[] = [];
  const torsoG = new THREE.CapsuleGeometry(0.32, 0.36, 6, 12);
  torsoG.scale(1.12, 1.0, 0.72);
  torsoG.translate(0, 0.32, 0);
  torsoParts.push(torsoG);

  const secondaryParts: THREE.BufferGeometry[] = [];
  const hipsG = new THREE.CylinderGeometry(0.28, 0.3, 0.22, 12);
  hipsG.scale(1.08, 1, 0.78);
  hipsG.translate(0, 0.02, 0);
  secondaryParts.push(hipsG);

  const goldTorsoParts: THREE.BufferGeometry[] = [];
  const whiteTorsoParts: THREE.BufferGeometry[] = [];

  if (charId === 'techie') {
    const hoodCollar = new THREE.TorusGeometry(0.24, 0.085, 8, 16);
    hoodCollar.rotateX(Math.PI / 2);
    hoodCollar.translate(0, 0.62, 0.04);
    torsoParts.push(hoodCollar);

    const lanyard = new THREE.BoxGeometry(0.11, 0.36, 0.04);
    lanyard.translate(0, 0.38, -0.24);
    goldTorsoParts.push(lanyard);

    const badge = new THREE.BoxGeometry(0.16, 0.2, 0.05);
    badge.translate(0, 0.18, -0.25);
    whiteTorsoParts.push(badge);
    for (const sx of [-0.09, 0.09]) {
      const strap = new THREE.CylinderGeometry(0.018, 0.018, 0.24, 6);
      strap.translate(sx, 0.44, -0.23);
      whiteTorsoParts.push(strap);
    }

    const backpack = new THREE.CapsuleGeometry(0.26, 0.24, 6, 10);
    backpack.scale(1.05, 1.0, 0.62);
    backpack.translate(0, 0.34, 0.32);
    secondaryParts.push(backpack);
  } else if (charId === 'skater') {
    const stripe = new THREE.CylinderGeometry(0.35, 0.34, 0.14, 12);
    stripe.scale(1.05, 1, 0.7);
    stripe.translate(0, 0.38, 0);
    secondaryParts.push(stripe);

    const pack = new THREE.CapsuleGeometry(0.22, 0.2, 6, 10);
    pack.scale(1.0, 1.0, 0.62);
    pack.translate(0, 0.34, 0.3);
    goldTorsoParts.push(pack);
  } else if (charId === 'auto_anna') {
    const scarf = new THREE.TorusGeometry(0.25, 0.08, 8, 16);
    scarf.rotateX(Math.PI / 2);
    scarf.translate(0, 0.62, 0);
    goldTorsoParts.push(scarf);

    const belt = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12);
    belt.scale(1.08, 1, 0.78);
    belt.translate(0, 0.06, 0);
    secondaryParts.push(belt);
  } else {
    const apron = new THREE.BoxGeometry(0.56, 0.52, 0.44);
    apron.translate(0, 0.2, 0);
    secondaryParts.push(apron);

    const sash = new THREE.BoxGeometry(0.16, 0.68, 0.46);
    sash.translate(0.14, 0.34, 0);
    goldTorsoParts.push(sash);
  }

  const torsoMesh = new THREE.Mesh(mergeStaticGeometries(torsoParts), primaryMat);
  torsoMesh.castShadow = true;
  for (const g of torsoParts) g.dispose();
  const secondaryTorsoMesh = new THREE.Mesh(mergeStaticGeometries(secondaryParts), secondaryMat);
  secondaryTorsoMesh.castShadow = true;
  for (const g of secondaryParts) g.dispose();
  torsoGroup.add(torsoMesh, secondaryTorsoMesh);

  if (goldTorsoParts.length > 0) {
    torsoGroup.add(new THREE.Mesh(mergeStaticGeometries(goldTorsoParts), goldMat));
    for (const g of goldTorsoParts) g.dispose();
  }
  if (whiteTorsoParts.length > 0) {
    torsoGroup.add(new THREE.Mesh(mergeStaticGeometries(whiteTorsoParts), whiteMat));
    for (const g of whiteTorsoParts) g.dispose();
  }

  // Sculpted expressive head (clean top-tilted hair crown, warm open face, eyes, smile!)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.94, 0);
  torsoGroup.add(headGroup);

  const headG = new THREE.SphereGeometry(0.28, 14, 12);
  headG.scale(0.96, 1.06, 0.94);
  const noseG = new THREE.SphereGeometry(0.036, 6, 6);
  noseG.translate(0, -0.02, -0.27);
  const head = new THREE.Mesh(mergeStaticGeometries([headG, noseG]), skinMat);
  headG.dispose();
  noseG.dispose();
  head.castShadow = true;
  headGroup.add(head);

  // Expressive eyes, pupils, friendly grin & brows (merged per material = 3 DC total!)
  const eyeWhiteMat = mkMat(0xffffff, 0.2, 0.0, 0.5);
  const eyePupilMat = mkMat(0x1a1423, 0.15, 0.1, 0.4);
  const whiteFaceParts: THREE.BufferGeometry[] = [];
  const pupilParts: THREE.BufferGeometry[] = [];
  const hairParts: THREE.BufferGeometry[] = [];

  for (const ex of [-0.095, 0.095]) {
    const sclera = new THREE.SphereGeometry(0.05, 8, 8);
    sclera.scale(0.92, 1.12, 0.5);
    sclera.translate(ex, 0.035, -0.245);
    whiteFaceParts.push(sclera);

    const pupil = new THREE.SphereGeometry(0.028, 8, 8);
    pupil.translate(ex, 0.035, -0.268);
    pupilParts.push(pupil);

    const brow = new THREE.BoxGeometry(0.088, 0.022, 0.026);
    brow.rotateZ(ex < 0 ? 0.1 : -0.1);
    brow.translate(ex, 0.11, -0.252);
    hairParts.push(brow);
  }
  // Friendly bright smile arc
  const smileG = new THREE.BoxGeometry(0.11, 0.026, 0.02);
  smileG.translate(0, -0.105, -0.255);
  whiteFaceParts.push(smileG);

  // Stylized sculpted hair crown sitting neatly above the forehead (never masking eyes!)
  const hairCrown = new THREE.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.48);
  hairCrown.rotateX(-0.34);
  hairCrown.translate(0, 0.08, 0.055);
  hairParts.push(hairCrown);
  // Rear hair back-cap
  const hairBack = new THREE.SphereGeometry(0.285, 10, 8, 0, Math.PI, Math.PI * 0.25, Math.PI * 0.5);
  hairBack.translate(0, 0.02, 0.03);
  hairParts.push(hairBack);

  if (charId === 'auto_anna') {
    const stache = new THREE.BoxGeometry(0.22, 0.048, 0.05);
    stache.translate(0, -0.068, -0.262);
    hairParts.push(stache);
  }

  headGroup.add(
    new THREE.Mesh(mergeStaticGeometries(whiteFaceParts), eyeWhiteMat),
    new THREE.Mesh(mergeStaticGeometries(pupilParts), eyePupilMat),
    new THREE.Mesh(mergeStaticGeometries(hairParts), hairMat),
  );
  for (const g of whiteFaceParts) g.dispose();
  for (const g of pupilParts) g.dispose();
  for (const g of hairParts) g.dispose();

  if (charId === 'techie') {
    const hpParts: THREE.BufferGeometry[] = [];
    const band = new THREE.TorusGeometry(0.3, 0.04, 8, 16, Math.PI);
    band.translate(0, 0.08, 0);
    hpParts.push(band);
    for (const sx of [-0.29, 0.29]) {
      const cup = new THREE.CylinderGeometry(0.095, 0.095, 0.075, 10);
      cup.rotateZ(Math.PI / 2);
      cup.translate(sx, 0.02, 0);
      hpParts.push(cup);
    }
    headGroup.add(new THREE.Mesh(mergeStaticGeometries(hpParts), goldMat));
    for (const g of hpParts) g.dispose();
  } else if (charId === 'skater') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.46),
      secondaryMat,
    );
    cap.rotation.x = -0.2;
    cap.position.set(0, 0.09, 0.02);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.26), goldMat);
    brim.position.set(0, 0.14, 0.26);
    headGroup.add(cap, brim);
  }

  if (charId === 'skater' || charId === 'auto_anna') {
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.11, 0.07), assets.mat.darkMetal);
    shades.position.set(0, 0.04, -0.255);
    headGroup.add(shades);
  }

  // Articulated Capsule Arms (Upper Arm + Forearm/Hand)
  const makeArm = (x: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 0.56, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.22, 5, 8), primaryMat);
    upper.position.set(0, -0.16, 0);
    upper.castShadow = true;
    shoulder.add(upper);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.32, 0);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.18, 5, 8), primaryMat);
    lower.position.set(0, -0.13, 0);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.092, 8, 8), skinMat);
    hand.position.set(0, -0.27, 0);
    forearm.add(lower, hand);
    shoulder.add(forearm);
    return { shoulder, forearm };
  };
  const leftArmRig = makeArm(-0.44);
  const rightArmRig = makeArm(0.44);
  torsoGroup.add(leftArmRig.shoulder, rightArmRig.shoulder);

  // Articulated Capsule Legs (Thigh + Shin + Chunky Sneakers + Super Sneakers Mount)
  const makeLeg = (x: number) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.84, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.24, 5, 10), secondaryMat);
    thigh.position.set(0, -0.2, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Group();
    shin.position.set(0, -0.4, 0);
    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.22, 5, 10), secondaryMat);
    calf.position.set(0, -0.16, 0);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.22, 0.46), shoeMat);
    shoe.position.set(0, -0.35, -0.06);
    shoe.castShadow = true;
    const sneakerBoot = buildSuperSneakerBoot(assets);
    sneakerBoot.visible = false;
    shin.add(calf, shoe, sneakerBoot);
    hip.add(shin);
    return { hip, shin, sneakerBoot };
  };
  const leftLegRig = makeLeg(-0.18);
  const rightLegRig = makeLeg(0.18);
  bodyGroup.add(leftLegRig.hip, rightLegRig.hip);

  const hoverboardMount = new THREE.Group();
  hoverboardMount.add(buildHoverboardMesh(boardId, assets));
  hoverboardMount.visible = false;
  root.add(hoverboardMount);

  const { group: droneMount, rotors: droneRotors } = buildDronePack(assets);
  droneMount.visible = false;
  bodyGroup.add(droneMount);

  const contactShadow = new THREE.Mesh(assets.geo.contactShadowDisc, assets.mat.contactShadow);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    torsoGroup,
    headGroup,
    leftArm: leftArmRig.shoulder,
    rightArm: rightArmRig.shoulder,
    leftForearm: leftArmRig.forearm,
    rightForearm: rightArmRig.forearm,
    leftLeg: leftLegRig.hip,
    rightLeg: rightLegRig.hip,
    leftShin: leftLegRig.shin,
    rightShin: rightLegRig.shin,
    hoverboardMount,
    droneMount,
    droneRotors,
    sneakersLeft: leftLegRig.sneakerBoot,
    sneakersRight: rightLegRig.sneakerBoot,
    contactShadow,
  };
}

/**
 * Metro Security Inspector + Playful Bengaluru Street Dog chasing behind!
 */
export function buildChaserRig(assets: AssetRegistry): ChaserRig {
  const root = new THREE.Group();
  const inspectorBody = new THREE.Group();
  root.add(inspectorBody);

  const mkMat = (color: number, roughness: number, emissive = 0x000000, emissiveIntensity = 0) =>
    applyCurvedWorldShader(
      new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity }),
      assets.uniforms,
      { rim: true, rimScale: 1.0 },
    );

  const uniformMat = mkMat(0x1e3a8a, 0.62);
  const vestMat = mkMat(0xa3e635, 0.42, 0x4d7c0f, 0.4);
  const skinMat = mkMat(0xc27d4e, 0.66);
  const capMat = mkMat(0x1e293b, 0.5);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.36, 6, 10), uniformMat);
  torso.position.set(0, 1.24, 0);
  torso.scale.set(1.1, 1.0, 0.78);
  torso.castShadow = true;

  const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.4, 0.26, 12), vestMat);
  vest.position.set(0, 1.26, 0);
  vest.scale.set(1.06, 1, 0.78);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skinMat);
  head.position.set(0, 1.9, 0);

  // Merge cap + visor + mustache into 1 draw call
  const capG = new THREE.CylinderGeometry(0.3, 0.28, 0.16, 12);
  capG.translate(0, 2.16, 0);
  const visorG = new THREE.BoxGeometry(0.48, 0.05, 0.24);
  visorG.translate(0, 2.1, -0.28);
  const stacheG = new THREE.BoxGeometry(0.24, 0.06, 0.06);
  stacheG.translate(0, 1.82, -0.26);
  const capAndStache = new THREE.Mesh(mergeStaticGeometries([capG, visorG, stacheG]), capMat);
  capG.dispose();
  visorG.dispose();
  stacheG.dispose();
  inspectorBody.add(torso, vest, head, capAndStache);

  const makeLimb = (x: number, y: number, len: number, r: number, mat: THREE.Material) => {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 8), mat);
    m.position.set(0, -(len / 2 + r), 0);
    p.add(m);
    return p;
  };
  const leftArm = makeLimb(-0.52, 1.54, 0.38, 0.11, uniformMat);
  const rightArm = makeLimb(0.52, 1.54, 0.38, 0.11, uniformMat);
  const leftLeg = makeLimb(-0.2, 0.84, 0.48, 0.13, capMat);
  const rightLeg = makeLimb(0.2, 0.84, 0.48, 0.13, capMat);
  inspectorBody.add(leftArm, rightArm, leftLeg, rightLeg);

  const shadow = new THREE.Mesh(assets.geo.contactShadowDisc, assets.mat.contactShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  inspectorBody.add(shadow);

  // Playful Bengaluru Indie Street Dog sprinting alongside the Inspector (merged for 6 DC!)
  const dogGroup = new THREE.Group();
  dogGroup.position.set(1.05, 0, -0.45);
  const furMat = mkMat(0xd97706, 0.78);
  const bellyMat = mkMat(0xfef3c7, 0.82);
  const noseMat = mkMat(0x1a1423, 0.3);

  const dogBodyG = new THREE.CapsuleGeometry(0.22, 0.46, 5, 10);
  dogBodyG.rotateX(Math.PI / 2);
  dogBodyG.translate(0, 0.48, 0);
  const dogHeadG = new THREE.SphereGeometry(0.21, 10, 8);
  dogHeadG.translate(0, 0.66, -0.44);
  const dogBodyHead = new THREE.Mesh(mergeStaticGeometries([dogBodyG, dogHeadG]), furMat);
  dogBodyG.dispose();
  dogHeadG.dispose();

  const dogCollar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 12), assets.mat.trimRed);
  dogCollar.position.set(0, 0.56, -0.32);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.2), bellyMat);
  snout.position.set(0, 0.61, -0.62);

  const noseG = new THREE.SphereGeometry(0.045, 6, 6);
  noseG.translate(0, 0.64, -0.73);
  const earL = new THREE.BoxGeometry(0.08, 0.2, 0.12);
  earL.rotateZ(0.35);
  earL.translate(-0.17, 0.72, -0.42);
  const earR = new THREE.BoxGeometry(0.08, 0.2, 0.12);
  earR.rotateZ(-0.35);
  earR.translate(0.17, 0.72, -0.42);
  const dogDarkFeatures = new THREE.Mesh(mergeStaticGeometries([noseG, earL, earR]), noseMat);
  noseG.dispose();
  earL.dispose();
  earR.dispose();

  const dogTail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.26, 4, 6), furMat);
  dogTail.position.set(0, 0.62, 0.38);
  dogTail.rotation.x = -0.6;

  // Front & rear leg pairs merged (2 draw calls instead of 4!)
  const dogLegs: THREE.Object3D[] = [];
  for (const lz of [-0.24, 0.24]) {
    const lp = new THREE.Group();
    lp.position.set(0, 0.36, lz);
    const lG = new THREE.CapsuleGeometry(0.055, 0.22, 4, 6);
    lG.translate(-0.14, -0.16, 0);
    const rG = new THREE.CapsuleGeometry(0.055, 0.22, 4, 6);
    rG.translate(0.14, -0.16, 0);
    lp.add(new THREE.Mesh(mergeStaticGeometries([lG, rG]), furMat));
    lG.dispose();
    rG.dispose();
    dogGroup.add(lp);
    dogLegs.push(lp);
  }

  dogGroup.add(dogBodyHead, dogCollar, snout, dogDarkFeatures, dogTail);
  root.add(dogGroup);

  return { root, inspectorBody, leftArm, rightArm, leftLeg, rightLeg, dogGroup, dogTail, dogLegs };
}

/**
 * Aerodynamic Beveled Namma Metro BEML Train Rig built strictly from shared pre-merged
 * AssetRegistry geometries (5-7 draw calls per train instead of 18+!).
 */
export function buildTrainRig(
  line: 'purple' | 'green',
  isMoving: boolean,
  hasRamp: boolean,
  assets: AssetRegistry,
): THREE.Group {
  const group = new THREE.Group();
  const length = isMoving ? 18 : 16;
  const sideMat = line === 'purple' ? assets.mat.trainSidePurple : assets.mat.trainSideGreen;
  const frontMat =
    line === 'green'
      ? assets.mat.trainFrontGreen
      : isMoving
        ? assets.mat.trainFrontMajestic
        : assets.mat.trainFrontPurple;

  const bodyH = 2.74;
  // 1. Single-material train side body (1 DC instead of 6!)
  const body = new THREE.Mesh(
    isMoving ? assets.geo.trainBodyMoving : assets.geo.trainBodyStatic,
    sideMat,
  );
  body.position.set(0, bodyH / 2 + 0.2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 2. Merged front + rear BEML cab face planes (1 DC)
  const frontPlanes = new THREE.Mesh(
    isMoving ? assets.geo.trainFrontPlanesMoving : assets.geo.trainFrontPlanesStatic,
    frontMat,
  );
  group.add(frontPlanes);

  // 3. Curved aerodynamic stainless-steel roof cap (1 DC)
  const roofCap = new THREE.Mesh(
    isMoving ? assets.geo.trainRoofMoving : assets.geo.trainRoofStatic,
    assets.mat.trainRoof,
  );
  roofCap.position.set(0, bodyH + 0.19, 0);
  roofCap.receiveShadow = true;
  group.add(roofCap);

  // 4. Merged bogie + nose bevel + HVAC pods + pantograph (1 DC instead of 7!)
  const darkDetails = new THREE.Mesh(
    isMoving ? assets.geo.trainDarkDetailsMoving : assets.geo.trainDarkDetailsStatic,
    assets.mat.trainDark,
  );
  group.add(darkDetails);

  // 5. Crisp ground-projected contact shadow (1 DC)
  const shadow = new THREE.Mesh(
    isMoving ? assets.geo.trainShadowMoving : assets.geo.trainShadowStatic,
    assets.mat.contactShadow,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.025, 0);
  group.add(shadow);

  // 6. Merged twin bright LED headlights (1 DC) + volumetric beams on moving express (1 DC)
  if (!hasRamp) {
    const headlights = new THREE.Mesh(
      isMoving ? assets.geo.trainHeadlightsMoving : assets.geo.trainHeadlightsStatic,
      assets.mat.headlightEmissive,
    );
    group.add(headlights);

    if (isMoving) {
      const beams = new THREE.Mesh(assets.geo.trainHeadlightBeamsMoving, assets.mat.headlightCone);
      group.add(beams);
    }
  } else {
    // Sloped ramp + merged golden grip bars (2 DC instead of 5!)
    const rampLen = 5.4;
    const rampH = 3.05;
    const rampMesh = new THREE.Mesh(
      assets.geo.trainRamp,
      line === 'purple' ? assets.mat.rampPurple : assets.mat.rampGreen,
    );
    rampMesh.rotation.y = -Math.PI / 2;
    rampMesh.position.set(0, rampH / 2, length / 2 + rampLen / 2);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    const rampBars = new THREE.Mesh(assets.geo.trainRampBars, assets.mat.rampGripGold);
    group.add(rampMesh, rampBars);
  }

  return group;
}

export function buildObstacleRig(
  kind: Exclude<HazardKind, 'train_static' | 'train_ramp' | 'train_moving'>,
  assets: AssetRegistry,
): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'barrier_jump') {
    const board = new THREE.Mesh(assets.geo.barrierBoard, assets.mat.mindTheGap);
    board.position.set(0, 0.92, 0);
    board.castShadow = true;
    const posts = new THREE.Mesh(assets.geo.barrierPostsMerged, assets.mat.darkMetal);
    group.add(board, posts);
    return group;
  }

  if (kind === 'barricade_bbmp') {
    const panel = new THREE.Mesh(assets.geo.bbmpPanel, assets.mat.bbmpHazard);
    panel.position.set(0, 0.86, 0);
    panel.castShadow = true;
    const legs = new THREE.Mesh(assets.geo.bbmpLegsMerged, assets.mat.darkMetal);
    const beacon = new THREE.Mesh(assets.geo.bbmpBeacon, assets.mat.beaconAmber);
    beacon.position.set(0, 1.48, 0);
    group.add(panel, legs, beacon);
    return group;
  }

  if (kind === 'pillar_narrow') {
    const shaft = new THREE.Mesh(assets.geo.pillarShaft, assets.mat.pillarHazard);
    shaft.position.set(0, 2.3, 0);
    shaft.castShadow = true;
    const trim = new THREE.Mesh(assets.geo.pillarTrimMerged, assets.mat.darkMetal);
    group.add(shaft, trim);
    return group;
  }

  // Low overhead signal gantry (roll underneath — 2 DC!)
  const frame = new THREE.Mesh(assets.geo.gantryFrameMerged, assets.mat.gantrySteel);
  frame.castShadow = true;
  const beam = new THREE.Mesh(assets.geo.gantryBeam, assets.mat.bbmpHazard);
  beam.position.set(0, 1.82, 0);
  beam.castShadow = true;
  group.add(frame, beam);
  return group;
}

/**
 * Reusable pooled Power-Up rig holding all 6 classic Subway Surfers/Bengaluru
 * pickups (`kaapi`, `magnet`, `drone`, `sneakers`, `multiplier`, `mystery_box`)
 * so slots switch type with ZERO mid-run allocations.
 */
export function buildUnifiedPowerUpRig(assets: AssetRegistry): UnifiedPowerUpRig {
  const root = new THREE.Group();
  const spinGroup = new THREE.Group();
  root.add(spinGroup);

  const haloMat = applyCurvedWorldShader(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    }),
    assets.uniforms,
  );
  const haloMesh = new THREE.Mesh(assets.geo.haloTorus, haloMat);
  spinGroup.add(haloMesh);

  const glowSprite = new THREE.Sprite(assets.mat.glowGold);
  glowSprite.scale.set(2.35, 2.35, 1);
  root.add(glowSprite);

  // 1. Filter Kaapi Brass Davara-Tumbler
  const kaapi = new THREE.Group();
  const davara = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.3, 0.26, 12), assets.mat.kaapiBrass);
  davara.position.y = -0.22;
  const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.62, 12), assets.mat.kaapiBrass);
  tumbler.position.y = 0.08;
  const froth = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), assets.mat.kaapiFroth);
  froth.position.y = 0.38;
  kaapi.add(davara, tumbler, froth);

  // 2. UPI Coin Magnet
  const magnet = new THREE.Group();
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.14, 8, 16, Math.PI), assets.mat.magnetGold);
  arch.position.y = 0.04;
  magnet.add(arch);
  for (const sx of [-0.38, 0.38]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 8), assets.mat.magnetGold);
    leg.position.set(sx, -0.1, 0);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 8), assets.mat.magnetRed);
    tip.position.set(sx, -0.28, 0);
    magnet.add(leg, tip);
  }

  // 3. Bengaluru Tech Drone Jetpack
  const drone = new THREE.Group();
  drone.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), assets.mat.dronePurple));
  for (const [rx, rz] of [
    [-0.42, -0.42],
    [0.42, -0.42],
    [-0.42, 0.42],
    [0.42, 0.42],
  ]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.07), assets.mat.darkMetal);
    arm.position.set(rx * 0.6, 0.1, rz * 0.6);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10), assets.mat.droneCyan);
    disc.position.set(rx, 0.16, rz);
    drone.add(arm, disc);
  }

  // 4. Super Sneakers (chunky neon jump boots with gold springs!)
  const sneakers = new THREE.Group();
  for (const sx of [-0.26, 0.26]) {
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.44), assets.mat.sneakerGreen);
    bootUpper.position.set(sx, 0.08, 0);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.52), assets.mat.sneakerGold);
    sole.position.set(sx, -0.14, -0.04);
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.18, 8), assets.mat.sneakerGold);
    spring.position.set(sx, -0.28, -0.04);
    sneakers.add(bootUpper, sole, spring);
  }

  // 5. 2x Score Multiplier (Golden Star + 2X Twin Rings)
  const multiplier = new THREE.Group();
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), assets.mat.multiplierGold);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 16), assets.mat.dronePurple);
  ring.rotation.x = Math.PI / 3;
  multiplier.add(star, ring);

  // 6. Mystery Box Crate
  const mystery_box = new THREE.Group();
  const crate = new THREE.Mesh(assets.geo.mysteryCrate, assets.mat.mysteryBox);
  crate.rotation.set(0.25, 0.5, 0.15);
  mystery_box.add(crate);

  const variants: Record<PowerUpType, THREE.Group> = {
    kaapi,
    magnet,
    drone,
    sneakers,
    multiplier,
    mystery_box,
  };
  for (const v of Object.values(variants)) {
    v.visible = false;
    spinGroup.add(v);
  }

  const setType = (type: PowerUpType) => {
    for (const [k, v] of Object.entries(variants)) {
      v.visible = k === type;
    }
    const hex =
      type === 'kaapi'
        ? 0xf59e0b
        : type === 'drone'
          ? 0x00f5d4
          : type === 'magnet'
            ? 0xef4444
            : type === 'sneakers'
              ? 0x2dc653
              : type === 'multiplier'
                ? 0xffd60a
                : 0xc084fc;
    haloMat.color.setHex(hex);
    haloMat.emissive.setHex(hex);
    glowSprite.material =
      type === 'drone'
        ? assets.mat.glowCyan
        : type === 'magnet'
          ? assets.mat.glowRed
          : type === 'sneakers'
            ? assets.mat.glowGreen
            : type === 'mystery_box'
              ? assets.mat.glowPurple
              : assets.mat.glowGold;
  };
  setType('kaapi');

  return { root, spinGroup, haloMesh, haloMat, glowSprite, variants, setType };
}

export function buildStationRig(zone: 'elevated' | 'underground', assets: AssetRegistry): PooledStationRig {
  const root = new THREE.Group();

  const platformMat = applyCurvedWorldShader(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72 }),
    assets.uniforms,
  );
  const canopyMat = applyCurvedWorldShader(
    new THREE.MeshStandardMaterial({
      color: zone === 'underground' ? 0x1e1b4b : 0xf8fafc,
      roughness: 0.35,
      metalness: 0.25,
    }),
    assets.uniforms,
    { rim: true, rimScale: 0.5 },
  );
  const accentMat = applyCurvedWorldShader(
    new THREE.MeshStandardMaterial({
      color: 0x7b2cbf,
      emissive: 0x7b2cbf,
      emissiveIntensity: zone === 'underground' ? 1.1 : 0.3,
      roughness: 0.3,
    }),
    assets.uniforms,
  );
  const signMat = applyCurvedWorldShader(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.32,
      emissive: 0x222222,
      emissiveIntensity: 0.28,
    }),
    assets.uniforms,
  );

  const stationLength = 34;
  for (const side of [-1, 1]) {
    const px = side * 7.8;
    const platform = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, stationLength), platformMat);
    platform.position.set(px, 0.75, 0);
    platform.receiveShadow = true;
    const tactile = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.06, stationLength),
      assets.mat.trimYellow,
    );
    tactile.position.set(px - side * 2.0, 1.53, 0);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, stationLength), accentMat);
    fascia.position.set(px - side * 2.34, 1.15, 0);
    root.add(platform, tactile, fascia);

    for (let z = -12; z <= 12; z += 12) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 6.8, 8), assets.mat.gantrySteel);
      col.position.set(px + side * 0.8, 4.9, z);
      root.add(col);
    }
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.6, stationLength + 2), canopyMat);
  roof.position.set(0, 8.6, 0);
  root.add(roof);

  for (const lx of [-3.4, 3.4]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, stationLength - 4),
      assets.mat.tunnelLightStrip,
    );
    strip.position.set(lx, 8.22, 0);
    root.add(strip);
  }

  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.7, 0.36), signMat);
  signBoard.position.set(0, 6.65, stationLength / 2 - 1.2);
  root.add(signBoard);

  const configure = (station: MetroStation) => {
    const lineColor =
      station.line === 'green' ? 0x2dc653 : station.line === 'yellow' ? 0xf59e0b : 0x7b2cbf;
    accentMat.color.setHex(lineColor);
    accentMat.emissive.setHex(lineColor);
    signMat.map = assets.textures.getStationSign(station);
    signMat.needsUpdate = true;
  };

  return { root, signMat, accentMat, configure };
}

export function buildTunnelPortalRig(assets: AssetRegistry): THREE.Group {
  const group = new THREE.Group();

  const signMat = applyCurvedWorldShader(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: assets.textures.tunnelSign,
      roughness: 0.35,
      emissive: 0x1e1b4b,
      emissiveIntensity: 0.3,
    }),
    assets.uniforms,
  );

  for (const sx of [-6.9, 6.9]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.6, 9.5, 4.4), assets.mat.gantrySteel);
    wall.position.set(sx, 4.75, 0);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8.2, 0.35), assets.mat.tunnelNeonPurple);
    trim.position.set(sx - Math.sign(sx) * 1.25, 4.2, 2.22);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), assets.mat.beaconAmber);
    beacon.position.set(sx, 9.75, 1.8);
    const glow = new THREE.Sprite(assets.mat.glowGold);
    glow.position.set(sx, 9.75, 2.05);
    glow.scale.set(1.8, 1.8, 1);
    group.add(wall, trim, beacon, glow);
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(16.4, 3.2, 4.4), assets.mat.gantrySteel);
  lintel.position.set(0, 9.4, 0);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.6, 4.6), assets.mat.trainDark);
  collar.position.set(0, 7.6, 0);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.5, 0.32), signMat);
  sign.position.set(0, 9.3, 2.35);
  group.add(lintel, collar, sign);
  return group;
}

export function buildSkylineLandmark(
  variant: 'vidhana' | 'ub_city',
  assets: AssetRegistry,
): THREE.Group {
  const group = new THREE.Group();
  if (variant === 'vidhana') {
    const base = new THREE.BoxGeometry(18, 8.5, 9);
    base.translate(0, 4.25, 0);
    const upper = new THREE.BoxGeometry(12, 4.8, 7.2);
    upper.translate(0, 10.6, 0);
    const stone = new THREE.Mesh(mergeStaticGeometries([base, upper]), assets.mat.vidhanaStone);
    base.dispose();
    upper.dispose();

    const dome = new THREE.SphereGeometry(3.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(0, 12.9, 0);
    const spire = new THREE.ConeGeometry(0.55, 2.5, 8);
    spire.translate(0, 17.1, 0);
    const miniL = new THREE.SphereGeometry(1.45, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    miniL.translate(-6.8, 8.5, 0);
    const miniR = new THREE.SphereGeometry(1.45, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    miniR.translate(6.8, 8.5, 0);
    const gold = new THREE.Mesh(
      mergeStaticGeometries([dome, spire, miniL, miniR]),
      assets.mat.vidhanaGold,
    );
    dome.dispose();
    spire.dispose();
    miniL.dispose();
    miniR.dispose();

    group.add(stone, gold);
    return group;
  }

  // UB City Iconic Twin Bengaluru Glass Towers silhouette (3 DC total!)
  const t1 = new THREE.BoxGeometry(7.5, 28, 7.5);
  t1.translate(-4.6, 14, 0);
  const t2 = new THREE.BoxGeometry(6.8, 22, 6.8);
  t2.translate(4.5, 11, 0);
  const towers = new THREE.Mesh(mergeStaticGeometries([t1, t2]), assets.mat.techTower);
  t1.dispose();
  t2.dispose();

  const skyBridge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 3.8), assets.mat.trimYellow);
  skyBridge.position.set(0, 14.5, 0);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(8.1, 1.0, 8.1), assets.mat.droneCyan);
  crown.position.set(-4.6, 28.4, 0);
  group.add(towers, skyBridge, crown);
  return group;
}
