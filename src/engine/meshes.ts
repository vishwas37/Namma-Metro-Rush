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
import type { TextureLibrary } from './textures';

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
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  hoverboardMount: THREE.Group;
  droneMount: THREE.Group;
  droneRotors: THREE.Object3D[];
  contactShadow: THREE.Mesh;
}

export function buildHoverboardMesh(skinId: HoverboardId): THREE.Group {
  const def = HOVERBOARDS.find((h) => h.id === skinId) ?? HOVERBOARDS[0];
  const group = new THREE.Group();

  const primaryMat = new THREE.MeshStandardMaterial({
    color: def.primaryColor,
    roughness: 0.35,
    metalness: 0.25,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: def.secondaryColor,
    roughness: 0.3,
    metalness: 0.2,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1423,
    roughness: 0.72,
    metalness: 0.2,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: def.glowColor,
    emissive: def.glowColor,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.16, 2.38), primaryMat);
  deck.position.set(0, 0.26, 0);
  deck.castShadow = true;
  group.add(deck);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.36, 0.68), secondaryMat);
  nose.position.set(0, 0.43, -0.95);
  group.add(nose);

  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12), glowMat);
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, 0.44, -1.3);
  group.add(lamp);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.11, 0.36), secondaryMat);
  spoiler.position.set(0, 0.47, 0.96);
  group.add(spoiler);

  for (const sx of [-0.56, 0.56]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 2.08), darkMat);
    rail.position.set(sx, 0.26, 0);
    group.add(rail);
  }

  for (const sx of [-0.34, 0.34]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.18, 12), darkMat);
    pod.position.set(sx, 0.12, 0.62);
    group.add(pod);

    const flame = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.04, 0.22, 10), glowMat);
    flame.position.set(sx, 0.04, 0.62);
    group.add(flame);
  }

  const frontPad = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.45), glowMat);
  frontPad.position.set(0, 0.15, -0.75);
  group.add(frontPad);

  return group;
}

export function buildDronePack(): { group: THREE.Group; rotors: THREE.Object3D[] } {
  const group = new THREE.Group();
  const rotors: THREE.Object3D[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7b2cbf, roughness: 0.32, metalness: 0.45 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.28, metalness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1423, roughness: 0.6, metalness: 0.3 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x00f5d4,
    emissive: 0x00f5d4,
    emissiveIntensity: 1.6,
  });

  const core = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.55, 0.38), bodyMat);
  core.position.set(0, 1.38, 0.44);
  group.add(core);

  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), accentMat);
  badge.position.set(0, 1.42, 0.64);
  group.add(badge);

  for (const [ax, az] of [
    [-0.78, 0.65],
    [0.78, 0.65],
    [-0.72, 0.22],
    [0.72, 0.22],
  ]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.08), darkMat);
    strut.position.set(ax * 0.52, 1.68, az);
    group.add(strut);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10), accentMat);
    motor.position.set(ax, 1.72, az);
    group.add(motor);

    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(ax, 1.82, az);
    bladeGroup.add(
      new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.03, 0.09), glowMat),
      new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.66), glowMat),
    );
    group.add(bladeGroup);
    rotors.push(bladeGroup);
  }

  return { group, rotors };
}

export function buildRunnerRig(
  charId: CharacterId,
  boardId: HoverboardId,
  textures: TextureLibrary,
): RunnerRig {
  const def = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const primaryMat = new THREE.MeshStandardMaterial({ color: def.primaryColor, roughness: 0.62, metalness: 0.08 });
  const secondaryMat = new THREE.MeshStandardMaterial({ color: def.secondaryColor, roughness: 0.72, metalness: 0.1 });
  const skinMat = new THREE.MeshStandardMaterial({ color: def.skinColor, roughness: 0.68, metalness: 0.02 });
  const hairMat = new THREE.MeshStandardMaterial({ color: def.hairColor, roughness: 0.8, metalness: 0.05 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: def.shoeColor, roughness: 0.35, metalness: 0.15 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.25, metalness: 0.65 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.76, 0.4), primaryMat);
  torso.position.set(0, 1.15, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);

  if (charId === 'techie') {
    const lanyard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.04), goldMat);
    lanyard.position.set(0, 1.24, -0.21);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), whiteMat);
    badge.position.set(0, 1.02, -0.22);
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.64, 0.28), secondaryMat);
    backpack.position.set(0, 1.18, 0.3);
    backpack.castShadow = true;
    bodyGroup.add(lanyard, badge, backpack);
  } else if (charId === 'skater') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.42), secondaryMat);
    stripe.position.set(0, 1.22, 0);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.24), goldMat);
    pack.position.set(0, 1.18, 0.28);
    bodyGroup.add(stripe, pack);
  } else if (charId === 'auto_anna') {
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.44), goldMat);
    scarf.position.set(0, 1.48, 0);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.42), secondaryMat);
    belt.position.set(0, 0.82, 0);
    bodyGroup.add(scarf, belt);
  } else {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.54, 0.44), secondaryMat);
    apron.position.set(0, 1.0, 0);
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.44), goldMat);
    sash.position.set(0.16, 1.18, 0);
    bodyGroup.add(apron, sash);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.48), skinMat);
  head.position.set(0, 1.82, 0);
  head.castShadow = true;
  bodyGroup.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1423, roughness: 0.25 });
  for (const ex of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.04), eyeMat);
    eye.position.set(ex, 1.85, -0.24);
    bodyGroup.add(eye);
  }

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.2, 0.52), hairMat);
  hairTop.position.set(0, 2.08, 0.02);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.14), hairMat);
  hairBack.position.set(0, 1.9, 0.22);
  bodyGroup.add(hairTop, hairBack);

  if (charId === 'techie') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 16, Math.PI), goldMat);
    band.position.set(0, 1.92, 0);
    bodyGroup.add(band);
    for (const sx of [-0.28, 0.28]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), goldMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(sx, 1.84, 0);
      bodyGroup.add(cup);
    }
  } else if (charId === 'skater') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.54), secondaryMat);
    cap.position.set(0, 2.1, 0);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.26), goldMat);
    brim.position.set(0, 2.04, 0.32);
    bodyGroup.add(cap, brim);
  }

  if (charId === 'skater' || charId === 'auto_anna') {
    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.12, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.7 }),
    );
    shades.position.set(0, 1.86, -0.24);
    bodyGroup.add(shades);
  }

  if (charId === 'auto_anna') {
    const stache = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), hairMat);
    stache.position.set(0, 1.72, -0.25);
    bodyGroup.add(stache);
  }

  const makeArm = (x: number) => {
    const p = new THREE.Group();
    p.position.set(x, 1.44, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.56, 0.2), primaryMat);
    upper.position.set(0, -0.24, 0);
    upper.castShadow = true;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), skinMat);
    hand.position.set(0, -0.56, 0);
    p.add(upper, hand);
    return p;
  };
  const leftArm = makeArm(-0.46);
  const rightArm = makeArm(0.46);
  bodyGroup.add(leftArm, rightArm);

  const makeLeg = (x: number) => {
    const p = new THREE.Group();
    p.position.set(x, 0.78, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.56, 0.26), secondaryMat);
    leg.position.set(0, -0.28, 0);
    leg.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.22, 0.44), shoeMat);
    shoe.position.set(0, -0.66, -0.06);
    shoe.castShadow = true;
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.06, 0.46), whiteMat);
    sole.position.set(0, -0.75, -0.06);
    p.add(leg, shoe, sole);
    return p;
  };
  const leftLeg = makeLeg(-0.18);
  const rightLeg = makeLeg(0.18);
  bodyGroup.add(leftLeg, rightLeg);

  const hoverboardMount = new THREE.Group();
  hoverboardMount.add(buildHoverboardMesh(boardId));
  hoverboardMount.visible = false;
  root.add(hoverboardMount);

  const { group: droneMount, rotors: droneRotors } = buildDronePack();
  droneMount.visible = false;
  bodyGroup.add(droneMount);

  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.76, 18),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    hoverboardMount,
    droneMount,
    droneRotors,
    contactShadow,
  };
}

export function buildChaserRig(textures: TextureLibrary): {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
} {
  const root = new THREE.Group();
  const uniformMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.65 });
  const vestMat = new THREE.MeshStandardMaterial({
    color: 0xa3e635,
    emissive: 0x4d7c0f,
    emissiveIntensity: 0.35,
    roughness: 0.45,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc27d4e, roughness: 0.68 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.84, 0.46), uniformMat);
  torso.position.set(0, 1.2, 0);
  torso.castShadow = true;
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.48), vestMat);
  vest.position.set(0, 1.24, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.48), skinMat);
  head.position.set(0, 1.9, 0);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.56), capMat);
  cap.position.set(0, 2.18, 0);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.22), capMat);
  visor.position.set(0, 2.1, -0.32);
  root.add(torso, vest, head, cap, visor);

  const limb = (x: number, y: number, h: number, mat: THREE.Material) => {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, h, 0.24), mat);
    m.position.set(0, -h / 2, 0);
    p.add(m);
    return p;
  };
  const leftArm = limb(-0.52, 1.5, 0.62, uniformMat);
  const rightArm = limb(0.52, 1.5, 0.62, uniformMat);
  const leftLeg = limb(-0.2, 0.8, 0.78, capMat);
  const rightLeg = limb(0.2, 0.8, 0.78, capMat);
  root.add(leftArm, rightArm, leftLeg, rightLeg);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 16),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  return { root, leftArm, rightArm, leftLeg, rightLeg };
}

export function buildTrainMesh(
  line: 'purple' | 'green',
  length: number,
  hasRamp: boolean,
  textures: TextureLibrary,
): THREE.Group {
  const group = new THREE.Group();
  const sideTex = line === 'purple' ? textures.trainSidePurple : textures.trainSideGreen;
  const frontTex = line === 'purple' ? textures.trainFrontPurple : textures.trainFrontGreen;
  const accentHex = line === 'purple' ? 0x7b2cbf : 0x2dc653;

  const sideMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: sideTex, roughness: 0.28, metalness: 0.42 });
  const frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: frontTex, roughness: 0.22, metalness: 0.45 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: 0.55, metalness: 0.25 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1423, roughness: 0.72, metalness: 0.2 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff9db,
    emissive: 0xffea70,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });

  const bodyW = 2.45;
  const bodyH = 2.85;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, length), [
    sideMat,
    sideMat,
    roofMat,
    darkMat,
    frontMat,
    frontMat,
  ]);
  body.position.set(0, bodyH / 2 + 0.2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const acCount = Math.max(2, Math.floor(length / 5.5));
  for (let i = 0; i < acCount; i++) {
    const zPos = -length / 2 + 2.4 + i * ((length - 4.8) / Math.max(1, acCount - 1));
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 1.9), darkMat);
    ac.position.set(0, bodyH + 0.24, zPos);
    group.add(ac);
  }

  for (const hx of [-0.74, 0.74]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.08), headlightMat);
    lamp.position.set(hx, 0.92, length / 2 + 0.03);
    group.add(lamp);
  }

  const bogie = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.26, length - 0.8), darkMat);
  bogie.position.set(0, 0.14, 0);
  group.add(bogie);

  if (hasRamp) {
    const rampLen = 5.4;
    const rampH = 3.05;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(rampLen, 0);
    shape.lineTo(0, rampH);
    shape.closePath();

    const extrude = new THREE.ExtrudeGeometry(shape, { depth: bodyW - 0.12, bevelEnabled: false });
    extrude.center();
    const rampMesh = new THREE.Mesh(
      extrude,
      new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.45, metalness: 0.2 }),
    );
    rampMesh.rotation.y = -Math.PI / 2;
    rampMesh.position.set(0, rampH / 2, length / 2 + rampLen / 2);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);

    const gripMat = new THREE.MeshStandardMaterial({
      color: 0xffd60a,
      emissive: 0xca8a04,
      emissiveIntensity: 0.3,
      roughness: 0.35,
    });
    for (let s = 0; s < 4; s++) {
      const t = (s + 0.6) / 4.2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.26, 0.08, 0.22), gripMat);
      bar.position.set(0, t * rampH + 0.08, length / 2 + (1 - t) * rampLen);
      bar.rotation.x = Math.atan2(rampH, rampLen);
      group.add(bar);
    }
  }

  return group;
}

export function buildObstacleMesh(
  kind: Exclude<HazardKind, 'train_static' | 'train_ramp' | 'train_moving'>,
  textures: TextureLibrary,
): THREE.Group {
  const group = new THREE.Group();
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.65 });

  if (kind === 'barrier_jump') {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.85, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.mindTheGap, roughness: 0.42 }),
    );
    board.position.set(0, 0.92, 0);
    board.castShadow = true;
    group.add(board);

    const capMat = new THREE.MeshStandardMaterial({ color: 0xffd60a, emissive: 0xfacc15, emissiveIntensity: 0.8 });
    for (const px of [-1.06, 1.06]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.4, 10), darkMetal);
      post.position.set(px, 0.7, 0);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), capMat);
      cap.position.set(px, 1.42, 0);
      group.add(post, cap);
    }
    return group;
  }

  if (kind === 'barricade_bbmp') {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.98, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.bbmpHazard, roughness: 0.5 }),
    );
    panel.position.set(0, 0.86, 0);
    panel.castShadow = true;
    group.add(panel);

    for (const lx of [-0.95, 0.95]) {
      const legF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), darkMetal);
      legF.position.set(lx, 0.55, 0.24);
      legF.rotation.x = -0.32;
      const legB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), darkMetal);
      legB.position.set(lx, 0.55, -0.24);
      legB.rotation.x = 0.32;
      group.add(legF, legB);
    }

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.26, 10),
      new THREE.MeshStandardMaterial({ color: 0xff9f1c, emissive: 0xff6b00, emissiveIntensity: 1.8 }),
    );
    beacon.position.set(0, 1.48, 0);
    group.add(beacon);
    return group;
  }

  // Low overhead signal gantry (roll underneath)
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.55 });
  for (const px of [-1.25, 1.25]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.2, 0.28), pillarMat);
    pillar.position.set(px, 1.6, 0);
    pillar.castShadow = true;
    group.add(pillar);
  }
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, 0.95, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.bbmpHazard, roughness: 0.45 }),
  );
  beam.position.set(0, 1.82, 0);
  beam.castShadow = true;
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.24, 0.32), darkMetal);
  topRail.position.set(0, 2.55, 0);
  const redLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 }),
  );
  redLight.position.set(-0.65, 2.55, 0.12);
  const greenLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x2dc653, emissive: 0x2dc653, emissiveIntensity: 1.6 }),
  );
  greenLight.position.set(0.65, 2.55, 0.12);
  group.add(beam, topRail, redLight, greenLight);
  return group;
}

export function buildTokenMesh(): THREE.Group {
  const group = new THREE.Group();
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0xffd60a,
    emissive: 0xd97706,
    emissiveIntensity: 0.55,
    roughness: 0.22,
    metalness: 0.72,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x7b2cbf,
    emissive: 0x7b2cbf,
    emissiveIntensity: 0.65,
    roughness: 0.28,
    metalness: 0.35,
  });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 12), outerMat);
  rim.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 12), coreMat);
  core.rotation.x = Math.PI / 2;
  group.add(rim, core);
  return group;
}

export function buildPowerUpMesh(type: PowerUpType): THREE.Group {
  const group = new THREE.Group();
  const haloHex = type === 'kaapi' ? 0xf59e0b : type === 'drone' ? 0x00f5d4 : 0xef4444;
  group.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.06, 8, 20),
      new THREE.MeshStandardMaterial({ color: haloHex, emissive: haloHex, emissiveIntensity: 1.6 }),
    ),
  );

  if (type === 'kaapi') {
    const brass = new THREE.MeshStandardMaterial({
      color: 0xf5b700,
      emissive: 0x92400e,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.85,
    });
    const davara = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.3, 0.26, 14), brass);
    davara.position.y = -0.22;
    const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.62, 14), brass);
    tumbler.position.y = 0.08;
    const froth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.08, 14),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.8 }),
    );
    froth.position.y = 0.38;
    group.add(davara, tumbler, froth);
    return group;
  }

  if (type === 'drone') {
    const podMat = new THREE.MeshStandardMaterial({ color: 0x7b2cbf, roughness: 0.28, metalness: 0.45 });
    const armMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0xffd60a, emissive: 0xfacc15, emissiveIntensity: 1.2 });
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), podMat));
    for (const [rx, rz] of [
      [-0.42, -0.42],
      [0.42, -0.42],
      [-0.42, 0.42],
      [0.42, 0.42],
    ]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.07), armMat);
      arm.position.set(rx * 0.6, 0.1, rz * 0.6);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10), rotorMat);
      disc.position.set(rx, 0.16, rz);
      group.add(arm, disc);
    }
    return group;
  }

  const dosaMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    emissive: 0x854d0e,
    emissiveIntensity: 0.35,
    roughness: 0.52,
  });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.14, 10, 18, Math.PI), dosaMat);
  arch.position.y = 0.04;
  group.add(arch);
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.5,
  });
  for (const sx of [-0.38, 0.38]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 10), dosaMat);
    leg.position.set(sx, -0.1, 0);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 10), tipMat);
    tip.position.set(sx, -0.28, 0);
    group.add(leg, tip);
  }
  return group;
}

export function buildTabebuiaTree(): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const pink1 = new THREE.MeshStandardMaterial({ color: 0xff70a6, roughness: 0.72 });
  const pink2 = new THREE.MeshStandardMaterial({ color: 0xff99c2, roughness: 0.68 });
  const pink3 = new THREE.MeshStandardMaterial({ color: 0xff4d8d, roughness: 0.75 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 3.8, 8), trunkMat);
  trunk.position.y = 1.9;
  group.add(trunk);

  const puffs: Array<[number, number, number, number, THREE.Material]> = [
    [0, 4.4, 0, 1.95, pink1],
    [-1.25, 3.7, 0.5, 1.35, pink2],
    [1.2, 3.85, -0.4, 1.45, pink3],
    [0.15, 5.2, 0.45, 1.25, pink2],
  ];
  for (const [x, y, z, r, mat] of puffs) {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), mat);
    puff.position.set(x, y, z);
    group.add(puff);
  }
  return group;
}

export function buildSkylineBuilding(
  variant: 'tech' | 'vidhana' | 'apartment',
  textures: TextureLibrary,
): THREE.Group {
  const group = new THREE.Group();
  if (variant === 'vidhana') {
    const stone = new THREE.MeshStandardMaterial({ color: 0xe6dcc8, roughness: 0.78 });
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xd4a359, roughness: 0.35, metalness: 0.45 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 9), stone);
    base.position.y = 4;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(11, 4.5, 7), stone);
    upper.position.y = 10.2;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 12.4;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 8), domeMat);
    spire.position.y = 16.4;
    group.add(base, upper, dome, spire);
    for (const sx of [-6.4, 6.4]) {
      const mini = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      mini.position.set(sx, 8.1, 0);
      group.add(mini);
    }
    return group;
  }

  if (variant === 'tech') {
    const h = 24;
    const glass = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.techFacade,
      roughness: 0.25,
      metalness: 0.55,
    });
    const trim = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(9.5, h, 9.5), glass);
    tower.position.y = h / 2;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(10.1, 0.9, 10.1), trim);
    crown.position.y = h + 0.45;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.2, 8), trim);
    antenna.position.y = h + 2.6;
    group.add(tower, crown, antenna);
    return group;
  }

  const h = 15;
  const wall = new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.82 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.7 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(8, h, 8), wall);
  block.position.y = h / 2;
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.1, 8.5), roof);
  parapet.position.y = h + 0.5;
  group.add(block, parapet);
  return group;
}

export function buildStationStructure(station: MetroStation, textures: TextureLibrary): THREE.Group {
  const group = new THREE.Group();
  const lineColor = station.line === 'green' ? 0x2dc653 : station.line === 'yellow' ? 0xf59e0b : 0x7b2cbf;

  const platformMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 });
  const tactileMat = new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.5 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: station.zone === 'underground' ? 0x1e1b4b : 0xf8fafc,
    roughness: 0.35,
    metalness: 0.25,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: lineColor,
    emissive: lineColor,
    emissiveIntensity: station.zone === 'underground' ? 0.95 : 0.25,
    roughness: 0.3,
  });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.4 });

  const stationLength = 34;
  for (const side of [-1, 1]) {
    const px = side * 7.8;
    const platform = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, stationLength), platformMat);
    platform.position.set(px, 0.75, 0);
    platform.receiveShadow = true;
    const tactile = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, stationLength), tactileMat);
    tactile.position.set(px - side * 2.0, 1.53, 0);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, stationLength), accentMat);
    fascia.position.set(px - side * 2.34, 1.15, 0);
    group.add(platform, tactile, fascia);

    for (let z = -12; z <= 12; z += 8) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 6.8, 10), pillarMat);
      col.position.set(px + side * 0.8, 4.9, z);
      group.add(col);
    }
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.6, stationLength + 2), canopyMat);
  roof.position.set(0, 8.6, 0);
  group.add(roof);

  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.5,
  });
  for (const lx of [-3.4, 3.4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, stationLength - 4), lightMat);
    strip.position.set(lx, 8.22, 0);
    group.add(strip);
  }

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 2.7, 0.36),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.getStationSign(station),
      roughness: 0.35,
      emissive: 0x222222,
      emissiveIntensity: 0.25,
    }),
  );
  signBoard.position.set(0, 6.65, stationLength / 2 - 1.2);
  group.add(signBoard);
  return group;
}

export function buildTunnelPortal(textures: TextureLibrary): THREE.Group {
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.82 });
  const darkInner = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const neonPurple = new THREE.MeshStandardMaterial({
    color: 0x9333ea,
    emissive: 0x7b2cbf,
    emissiveIntensity: 1.8,
  });
  const warningAmber = new THREE.MeshStandardMaterial({
    color: 0xffd60a,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.0,
  });

  for (const sx of [-6.9, 6.9]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.6, 9.5, 4.4), concrete);
    wall.position.set(sx, 4.75, 0);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8.2, 0.35), neonPurple);
    trim.position.set(sx - Math.sign(sx) * 1.25, 4.2, 2.22);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), warningAmber);
    beacon.position.set(sx, 9.75, 1.8);
    beacon.name = 'portal_beacon';
    group.add(wall, trim, beacon);
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(16.4, 3.2, 4.4), concrete);
  lintel.position.set(0, 9.4, 0);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.6, 4.6), darkInner);
  collar.position.set(0, 7.6, 0);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 2.5, 0.32),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.tunnelSign,
      roughness: 0.35,
      emissive: 0x1e1b4b,
      emissiveIntensity: 0.25,
    }),
  );
  sign.position.set(0, 9.3, 2.35);
  group.add(lintel, collar, sign);
  return group;
}
