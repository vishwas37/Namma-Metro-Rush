import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAIN_ROOF_Y,
  ZONE_DISTANCE_INTERVAL,
  applyRunToProfile,
  classifySwipeGesture,
  computeCameraFraming,
  createInitialPlayerKinematics,
  evaluateHazardInteraction,
  getEffectiveMultiplier,
  getPowerUpDuration,
  getWeatherForDistance,
  getZoneForDistance,
  purchaseOrSelectCharacter,
  purchaseOrSelectHoverboard,
  purchaseUpgrade,
  queuePlayerAction,
  resolveSupportHeight,
  stepPlayerPhysics,
  type HazardCollider,
  type SupportBox,
} from './simulation';
import { createDefaultProfile } from './catalog';

test('mobile portrait vs desktop camera framing widens FOV and pulls camera back on portrait', () => {
  const mobile = computeCameraFraming(390, 844);
  const desktop = computeCameraFraming(1440, 900);
  assert.ok(mobile.fov > desktop.fov, 'Portrait mobile needs wider FOV so all 3 lanes stay visible');
  assert.ok(mobile.chaseZ > desktop.chaseZ, 'Portrait mobile pulls chase camera back');
  assert.ok(mobile.lobbyRadius > desktop.lobbyRadius, 'Portrait lobby pulls back to frame runner + train');
});

test('mid-touch swipe classifier resolves all 4 directions and ignores tiny jitter', () => {
  assert.equal(classifySwipeGesture(10, 8), 'none');
  assert.equal(classifySwipeGesture(-42, 10), 'left');
  assert.equal(classifySwipeGesture(48, -12), 'right');
  assert.equal(classifySwipeGesture(6, -38), 'jump');
  assert.equal(classifySwipeGesture(-5, 35), 'roll');
});

test('lane switching, jump buffering, fast-fall slam, and ramp roof running work seamlessly', () => {
  const p = createInitialPlayerKinematics();
  queuePlayerAction(p, 'right');
  const sw = stepPlayerPhysics(p, 0.016, []);
  assert.equal(sw.switchedLane, 1);
  assert.equal(p.lane, 2);

  queuePlayerAction(p, 'jump');
  const jp = stepPlayerPhysics(p, 0.016, []);
  assert.equal(jp.jumped, true);

  for (let i = 0; i < 4; i++) stepPlayerPhysics(p, 0.016, []);
  queuePlayerAction(p, 'roll');
  const slam = stepPlayerPhysics(p, 0.016, []);
  assert.equal(slam.slammed, true);

  let landed = false;
  for (let i = 0; i < 20; i++) {
    if (stepPlayerPhysics(p, 0.016, []).landed) {
      landed = true;
      break;
    }
  }
  assert.equal(landed, true);
  assert.equal(p.rolling, true);

  const supports: SupportBox[] = [
    {
      lane: 1,
      zStart: 4,
      zEnd: -12,
      topY: TRAIN_ROOF_Y,
      isRamp: true,
      rampStartZ: 10,
      rampEndZ: 4,
    },
  ];
  assert.ok(Math.abs(resolveSupportHeight(0, 1.5, supports, 7) - TRAIN_ROOF_Y * 0.5) < 0.05);
  assert.equal(resolveSupportHeight(0, TRAIN_ROOF_Y, supports, 0), TRAIN_ROOF_Y);
});

test('hazard collisions support gantry roll-under, hoverboard shield, side stumble, and close calls', () => {
  const gantry: HazardCollider = {
    id: 1,
    kind: 'gantry_low',
    lane: 1,
    zStart: 0.3,
    zEnd: -0.3,
    height: 3.3,
    clearanceBottomY: 1.3,
  };
  assert.equal(
    evaluateHazardInteraction(
      { playerX: 0, playerY: 0, playerRolling: true, invincible: false, hoverboardActive: false, chaserClose: false },
      gantry,
    ),
    'close_call',
  );
  assert.equal(
    evaluateHazardInteraction(
      { playerX: 0, playerY: 0, playerRolling: false, invincible: false, hoverboardActive: false, chaserClose: false },
      gantry,
    ),
    'crash',
  );

  const train: HazardCollider = {
    id: 2,
    kind: 'train_moving',
    lane: 1,
    zStart: 1.5,
    zEnd: -12,
    height: TRAIN_ROOF_Y,
  };
  assert.equal(
    evaluateHazardInteraction(
      { playerX: 0, playerY: 0, playerRolling: false, invincible: false, hoverboardActive: true, chaserClose: false },
      train,
    ),
    'shield_break',
  );
});

test('zone transitions, weather cycling, shop unlocks, and mission multipliers work end-to-end', () => {
  assert.equal(getZoneForDistance(0), 'elevated');
  assert.equal(getZoneForDistance(ZONE_DISTANCE_INTERVAL + 5), 'underground');
  assert.equal(getWeatherForDistance(300, 'elevated'), 'blossom');
  assert.equal(getWeatherForDistance(560, 'elevated'), 'drizzle');

  let profile = createDefaultProfile();
  profile.tokens = 500;
  profile = purchaseOrSelectCharacter(profile, 'skater').profile;
  profile = purchaseOrSelectHoverboard(profile, 'bmtc_volvo').profile;
  const durBefore = getPowerUpDuration(profile, 'kaapi');
  profile = purchaseUpgrade(profile, 'kaapi').profile;
  assert.ok(getPowerUpDuration(profile, 'kaapi') > durBefore);

  const res = applyRunToProfile(profile, {
    score: 5200,
    distance: 780,
    tokensCollected: 45,
    stationsPassed: 3,
    kaapiUsed: 1,
    closeCalls: 4,
  });
  assert.equal(getEffectiveMultiplier(res.profile), 2);
  assert.ok(res.bonusTokens > 0);
});
