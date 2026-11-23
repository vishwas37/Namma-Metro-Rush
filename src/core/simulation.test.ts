import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANE_POSITIONS,
  TRACK_TILE_WORLD_LENGTH,
  TRAIN_ROOF_Y,
  WEATHER_CYCLE_DISTANCE,
  ZONE_DISTANCE_INTERVAL,
  applyRunToProfile,
  classifySwipeGesture,
  computeCameraFraming,
  computeTrackUvOffsetDelta,
  createInitialPlayerKinematics,
  evaluateHazardInteraction,
  getEffectiveMultiplier,
  getNextUpcomingStation,
  getPowerUpDuration,
  getWeatherForDistance,
  getWeatherPhysicsProfile,
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

test('swipe classifier uses 40px threshold, rejects jitter, and resolves all 4 directions cleanly', () => {
  assert.equal(classifySwipeGesture(10, 8), 'none');
  assert.equal(classifySwipeGesture(28, 5), 'none');
  assert.equal(classifySwipeGesture(-46, 10), 'left');
  assert.equal(classifySwipeGesture(48, -12), 'right');
  assert.equal(classifySwipeGesture(6, -44), 'jump');
  assert.equal(classifySwipeGesture(-5, 45), 'roll');
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

test('hazard collisions prevent train tunneling/pass-through and support shield, side stumble, and close calls', () => {
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

  // Fast moving train crossing Z=0 in a single frame must NEVER tunnel through the player
  const fastTrain: HazardCollider = {
    id: 2,
    kind: 'train_moving',
    lane: 1,
    prevZStart: -1.4,
    prevZEnd: -19.4,
    zStart: 1.2,
    zEnd: -16.8,
    height: TRAIN_ROOF_Y,
  };
  assert.equal(
    evaluateHazardInteraction(
      { playerX: 0, playerY: 0, playerRolling: false, invincible: false, hoverboardActive: false, chaserClose: false },
      fastTrain,
    ),
    'crash',
  );
  assert.equal(
    evaluateHazardInteraction(
      { playerX: 0, playerY: 0, playerRolling: false, invincible: false, hoverboardActive: true, chaserClose: false },
      fastTrain,
    ),
    'shield_break',
  );

  // Glancing side brush against the middle of a train triggers side stumble (never ghosting)
  const sideTrain: HazardCollider = {
    id: 3,
    kind: 'train_static',
    lane: 1,
    prevZStart: 3.5,
    prevZEnd: -12.5,
    zStart: 5.0,
    zEnd: -11.0,
    height: TRAIN_ROOF_Y,
  };
  assert.equal(
    evaluateHazardInteraction(
      { playerX: 1.35, playerY: 0, playerRolling: false, invincible: false, hoverboardActive: false, chaserClose: false },
      sideTrain,
    ),
    'stumble',
  );
});

test('zone transitions, weather cycling, slippery Heavy Monsoon floor, shop unlocks, and mission multipliers work end-to-end', () => {
  assert.equal(getZoneForDistance(0), 'elevated');
  assert.equal(getZoneForDistance(ZONE_DISTANCE_INTERVAL + 5), 'underground');

  // Weather cycles cleanly: Sunny -> Light Rain -> Heavy Monsoon -> Sunny
  assert.equal(getWeatherForDistance(0, 'elevated'), 'sunny');
  assert.equal(getWeatherForDistance(WEATHER_CYCLE_DISTANCE + 10, 'elevated'), 'light_rain');
  assert.equal(getWeatherForDistance(WEATHER_CYCLE_DISTANCE * 2 + 10, 'elevated'), 'heavy_monsoon');
  assert.equal(getWeatherForDistance(WEATHER_CYCLE_DISTANCE * 3 + 10, 'elevated'), 'sunny');
  assert.equal(getWeatherForDistance(WEATHER_CYCLE_DISTANCE * 2 + 10, 'underground'), 'sunny');

  assert.equal(getWeatherPhysicsProfile('sunny').slippery, false);
  assert.equal(getWeatherPhysicsProfile('light_rain').slippery, false);
  assert.equal(getWeatherPhysicsProfile('heavy_monsoon').slippery, true);

  // Heavy Monsoon produces a slightly slippery wet-rail slide vs crisp Sunny traction
  const sunnyRunner = createInitialPlayerKinematics();
  const monsoonRunner = createInitialPlayerKinematics();
  queuePlayerAction(sunnyRunner, 'right');
  queuePlayerAction(monsoonRunner, 'right');

  stepPlayerPhysics(sunnyRunner, 0.04, [], 'sunny');
  stepPlayerPhysics(monsoonRunner, 0.04, [], 'heavy_monsoon');
  assert.ok(
    monsoonRunner.x < sunnyRunner.x,
    'Heavy Monsoon wet floor should have lower initial lateral grip than Sunny',
  );

  // Monsoon runner experiences a subtle wet overshoot past target lane before settling cleanly
  let maxX = monsoonRunner.x;
  for (let i = 0; i < 60; i++) {
    stepPlayerPhysics(monsoonRunner, 0.016, [], 'heavy_monsoon');
    if (monsoonRunner.x > maxX) maxX = monsoonRunner.x;
  }
  assert.ok(
    maxX > LANE_POSITIONS[2] + 0.04 && maxX <= 3.55,
    'Heavy Monsoon should create a controlled slippery overshoot within viaduct bounds',
  );
  assert.ok(
    Math.abs(monsoonRunner.x - LANE_POSITIONS[2]) < 0.05,
    'Heavy Monsoon runner should settle cleanly back onto the target lane',
  );

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

test('entering MG Road never announces MG Road as next station and track UV scrolls 1:1 with world units', () => {
  const afterIndiranagar = getNextUpcomingStation('indiranagar', 'elevated');
  assert.equal(afterIndiranagar.id, 'mg_road');

  const afterMgRoad = getNextUpcomingStation('mg_road', 'elevated');
  assert.notEqual(afterMgRoad.id, 'mg_road', 'Entering MG Road must never announce MG Road as next station');
  assert.equal(afterMgRoad.id, 'jayanagar');

  const enteringTunnel = getNextUpcomingStation('mg_road', 'underground', 0);
  assert.equal(enteringTunnel.id, 'majestic');

  // Track UV scroll delta matches 1 full repeat per TRACK_TILE_WORLD_LENGTH (20m)
  assert.equal(computeTrackUvOffsetDelta(TRACK_TILE_WORLD_LENGTH), 1);
  assert.ok(Math.abs(computeTrackUvOffsetDelta(1) - 0.05) < 1e-9);
});
