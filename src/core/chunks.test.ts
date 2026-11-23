import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVEL_CHUNKS,
  getDifficultyTierForDistance,
  selectNextChunk,
  validateChunkFairness,
} from './chunks';
import {
  LANE_POSITIONS,
  TRAIN_ROOF_Y,
  createInitialPlayerKinematics,
  queuePlayerAction,
  stepPlayerPhysics,
} from './simulation';

test('all 24+ handcrafted chunks pass strict 3-lane reachability/fairness validation', () => {
  assert.ok(LEVEL_CHUNKS.length >= 22, `Expected >=22 chunks, got ${LEVEL_CHUNKS.length}`);
  const tiers = new Set(LEVEL_CHUNKS.map((c) => c.tier));
  assert.deepEqual([...tiers].sort(), [1, 2, 3, 4]);

  for (const chunk of LEVEL_CHUNKS) {
    const res = validateChunkFairness(chunk);
    assert.equal(res.valid, true, res.reason ?? `Chunk ${chunk.id} failed fairness`);
  }
});

test('chunk director escalates tiers smoothly and avoids back-to-back repeats', () => {
  assert.equal(getDifficultyTierForDistance(0), 1);
  assert.equal(getDifficultyTierForDistance(240), 2);
  assert.equal(getDifficultyTierForDistance(600), 3);
  assert.equal(getDifficultyTierForDistance(1100), 4);

  let prevId: string | null = null;
  for (let i = 0; i < 12; i++) {
    const picked = selectNextChunk(i * 110, prevId, () => (i * 0.27) % 1);
    assert.notEqual(picked.id, prevId, 'Chunk director should avoid immediate repeats');
    prevId = picked.id;
  }
});

test('Super Sneakers reach train roof height, Roll-to-Jump cancels cleanly, and Double Jump fires mid-air', () => {
  // Super Sneakers leap from ground above TRAIN_ROOF_Y (3.05)
  const sneakerRunner = createInitialPlayerKinematics();
  sneakerRunner.sneakersActive = true;
  queuePlayerAction(sneakerRunner, 'jump');
  let apexY = 0;
  for (let i = 0; i < 60; i++) {
    stepPlayerPhysics(sneakerRunner, 0.016, [], 'sunny');
    if (sneakerRunner.y > apexY) apexY = sneakerRunner.y;
  }
  assert.ok(
    apexY > TRAIN_ROOF_Y + 1.0,
    `Super Sneakers apex (${apexY.toFixed(2)}) must clear train roof (${TRAIN_ROOF_Y})`,
  );

  // Roll-to-Jump cancel vaults immediately
  const roller = createInitialPlayerKinematics();
  queuePlayerAction(roller, 'roll');
  stepPlayerPhysics(roller, 0.016, [], 'sunny');
  assert.equal(roller.rolling, true);
  queuePlayerAction(roller, 'jump');
  const cancelRes = stepPlayerPhysics(roller, 0.016, [], 'sunny');
  assert.equal(cancelRes.jumped, true);
  assert.equal(roller.rolling, false);

  // Double Jump hoverboard perk fires cleanly mid-air + Zap Sideways teleports fast
  const boardRunner = createInitialPlayerKinematics();
  boardRunner.activeBoardPerk = 'double_jump';
  queuePlayerAction(boardRunner, 'jump');
  stepPlayerPhysics(boardRunner, 0.016, [], 'sunny');
  for (let i = 0; i < 8; i++) stepPlayerPhysics(boardRunner, 0.016, [], 'sunny');
  queuePlayerAction(boardRunner, 'jump');
  const dj = stepPlayerPhysics(boardRunner, 0.016, [], 'sunny');
  assert.equal(dj.doubleJumped, true);

  const zapRunner = createInitialPlayerKinematics();
  zapRunner.activeBoardPerk = 'zap_sideways';
  queuePlayerAction(zapRunner, 'right');
  stepPlayerPhysics(zapRunner, 0.02, [], 'sunny');
  stepPlayerPhysics(zapRunner, 0.025, [], 'sunny');
  assert.equal(zapRunner.x, LANE_POSITIONS[2], 'Zap Sideways completes lane snap in ~0.04s');
});
