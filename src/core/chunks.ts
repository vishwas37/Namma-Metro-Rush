import type { PowerUpType } from './catalog';
import { TRAIN_ROOF_Y, type HazardKind } from './simulation';

export type DifficultyTier = 1 | 2 | 3 | 4;

export interface ChunkHazardDef {
  kind: HazardKind;
  lane: 0 | 1 | 2;
  /** Offset along chunk depth (positive = further ahead down -Z, i.e. worldZ = anchorZ - zOffset) */
  zOffset: number;
  line?: 'purple' | 'green';
}

export interface ChunkCoinLineDef {
  lane: 0 | 1 | 2;
  /** Optional endLane to form diagonal switchback sightline trails */
  endLane?: 0 | 1 | 2;
  zOffset: number;
  count: number;
  spacing: number;
  yBase: number;
  archHeight?: number;
}

export interface ChunkPowerUpAnchor {
  lane: 0 | 1 | 2;
  zOffset: number;
  y: number;
  /** Optional preferred pool; otherwise weighted random */
  pool?: PowerUpType[];
  chance: number;
}

export interface LevelChunk {
  id: string;
  name: string;
  tier: DifficultyTier;
  length: number;
  hazards: ChunkHazardDef[];
  coinLines: ChunkCoinLineDef[];
  powerUps?: ChunkPowerUpAnchor[];
}

const ROOF_COIN_Y = TRAIN_ROOF_Y + 0.92;
const GROUND_COIN_Y = 1.08;

/**
 * 24 handcrafted, Subway Surfers-grade 3-lane set-pieces across 4 speed tiers.
 * Every chunk guarantees at least one clean escape route (clear lane, jumpable barrier,
 * rollable gantry, or climbable train ramp/roof) with coins acting as sightlines.
 */
export const LEVEL_CHUNKS: LevelChunk[] = [
  // ======================== TIER 1: STARTER RHYTHM (6 chunks) ========================
  {
    id: 't1_starter_hop_roll',
    name: 'Starter Rhythm Hop & Roll',
    tier: 1,
    length: 44,
    hazards: [
      { kind: 'barrier_jump', lane: 1, zOffset: 10 },
      { kind: 'gantry_low', lane: 1, zOffset: 26 },
      { kind: 'barricade_bbmp', lane: 0, zOffset: 18 },
    ],
    coinLines: [
      { lane: 1, zOffset: 6, count: 5, spacing: 2.1, yBase: GROUND_COIN_Y, archHeight: 2.1 },
      { lane: 1, zOffset: 22, count: 5, spacing: 2.2, yBase: 0.72 },
      { lane: 2, zOffset: 12, count: 5, spacing: 2.8, yBase: GROUND_COIN_Y },
    ],
    powerUps: [{ lane: 2, zOffset: 30, y: 1.35, chance: 0.25 }],
  },
  {
    id: 't1_diagonal_switchback',
    name: 'Indiranagar Switchback',
    tier: 1,
    length: 44,
    hazards: [
      { kind: 'barricade_bbmp', lane: 0, zOffset: 10 },
      { kind: 'barricade_bbmp', lane: 2, zOffset: 10 },
      { kind: 'barrier_jump', lane: 1, zOffset: 24 },
      { kind: 'gantry_low', lane: 0, zOffset: 32 },
    ],
    coinLines: [
      { lane: 1, endLane: 2, zOffset: 8, count: 7, spacing: 2.5, yBase: GROUND_COIN_Y },
      { lane: 2, endLane: 0, zOffset: 25, count: 6, spacing: 2.5, yBase: GROUND_COIN_Y },
    ],
    powerUps: [{ lane: 0, zOffset: 38, y: 1.35, chance: 0.22 }],
  },
  {
    id: 't1_first_ramp_intro',
    name: 'First Ramp Roof Run',
    tier: 1,
    length: 48,
    hazards: [
      { kind: 'train_ramp', lane: 1, zOffset: 20, line: 'purple' },
      { kind: 'barrier_jump', lane: 0, zOffset: 14 },
      { kind: 'gantry_low', lane: 2, zOffset: 28 },
    ],
    coinLines: [
      { lane: 1, zOffset: 9, count: 3, spacing: 2.1, yBase: 1.4, archHeight: 0.9 },
      { lane: 1, zOffset: 15, count: 6, spacing: 2.7, yBase: ROOF_COIN_Y },
      { lane: 2, zOffset: 10, count: 5, spacing: 2.8, yBase: GROUND_COIN_Y },
    ],
    powerUps: [
      { lane: 1, zOffset: 26, y: ROOF_COIN_Y + 0.35, pool: ['sneakers', 'magnet', 'kaapi'], chance: 0.34 },
    ],
  },
  {
    id: 't1_bbmp_slalom',
    name: 'BBMP Roadwork Slalom',
    tier: 1,
    length: 46,
    hazards: [
      { kind: 'barricade_bbmp', lane: 1, zOffset: 8 },
      { kind: 'barrier_jump', lane: 0, zOffset: 18 },
      { kind: 'barricade_bbmp', lane: 2, zOffset: 26 },
      { kind: 'gantry_low', lane: 1, zOffset: 35 },
    ],
    coinLines: [
      { lane: 2, endLane: 1, zOffset: 6, count: 5, spacing: 2.4, yBase: GROUND_COIN_Y },
      { lane: 1, endLane: 0, zOffset: 20, count: 6, spacing: 2.5, yBase: GROUND_COIN_Y },
      { lane: 1, zOffset: 32, count: 4, spacing: 2.2, yBase: 0.72 },
    ],
    powerUps: [{ lane: 0, zOffset: 34, y: 1.35, chance: 0.24 }],
  },
  {
    id: 't1_side_train_corridor',
    name: 'MG Road Side Train Corridor',
    tier: 1,
    length: 46,
    hazards: [
      { kind: 'train_static', lane: 0, zOffset: 20, line: 'green' },
      { kind: 'barrier_jump', lane: 1, zOffset: 16 },
      { kind: 'gantry_low', lane: 2, zOffset: 28 },
    ],
    coinLines: [
      { lane: 1, zOffset: 12, count: 5, spacing: 2.0, yBase: GROUND_COIN_Y, archHeight: 2.15 },
      { lane: 2, zOffset: 12, count: 6, spacing: 2.6, yBase: GROUND_COIN_Y },
    ],
    powerUps: [{ lane: 1, zOffset: 34, y: 1.35, chance: 0.25 }],
  },
  {
    id: 't1_pillar_and_arc',
    name: 'Viaduct Pillar Weave',
    tier: 1,
    length: 44,
    hazards: [
      { kind: 'pillar_narrow', lane: 1, zOffset: 10 },
      { kind: 'pillar_narrow', lane: 0, zOffset: 22 },
      { kind: 'pillar_narrow', lane: 2, zOffset: 22 },
      { kind: 'barrier_jump', lane: 1, zOffset: 33 },
    ],
    coinLines: [
      { lane: 0, endLane: 1, zOffset: 7, count: 6, spacing: 2.6, yBase: GROUND_COIN_Y },
      { lane: 1, zOffset: 29, count: 5, spacing: 2.0, yBase: GROUND_COIN_Y, archHeight: 2.1 },
    ],
    powerUps: [{ lane: 1, zOffset: 22, y: 1.35, pool: ['multiplier', 'magnet'], chance: 0.28 }],
  },

  // ======================== TIER 2: ROOF PARKOUR (6 chunks) ========================
  {
    id: 't2_double_roof_gap',
    name: 'Roof-to-Roof Gap Jump',
    tier: 2,
    length: 62,
    hazards: [
      { kind: 'train_ramp', lane: 1, zOffset: 18, line: 'purple' },
      { kind: 'train_static', lane: 1, zOffset: 44, line: 'purple' },
      { kind: 'barricade_bbmp', lane: 0, zOffset: 22 },
      { kind: 'gantry_low', lane: 2, zOffset: 36 },
    ],
    coinLines: [
      { lane: 1, zOffset: 13, count: 5, spacing: 2.6, yBase: ROOF_COIN_Y },
      { lane: 1, zOffset: 28, count: 4, spacing: 2.3, yBase: ROOF_COIN_Y, archHeight: 1.8 },
      { lane: 1, zOffset: 39, count: 5, spacing: 2.6, yBase: ROOF_COIN_Y },
    ],
    powerUps: [
      { lane: 1, zOffset: 48, y: ROOF_COIN_Y + 0.35, pool: ['mystery_box', 'drone', 'kaapi'], chance: 0.42 },
    ],
  },
  {
    id: 't2_diagonal_roof_hop',
    name: 'Adjacent Train Roof Parkour',
    tier: 2,
    length: 60,
    hazards: [
      { kind: 'train_ramp', lane: 0, zOffset: 18, line: 'green' },
      { kind: 'train_static', lane: 1, zOffset: 36, line: 'purple' },
      { kind: 'train_static', lane: 2, zOffset: 48, line: 'green' },
      { kind: 'barrier_jump', lane: 2, zOffset: 16 },
    ],
    coinLines: [
      { lane: 0, zOffset: 14, count: 4, spacing: 2.5, yBase: ROOF_COIN_Y },
      { lane: 0, endLane: 1, zOffset: 24, count: 4, spacing: 2.5, yBase: ROOF_COIN_Y + 0.6 },
      { lane: 1, endLane: 2, zOffset: 36, count: 5, spacing: 2.5, yBase: ROOF_COIN_Y + 0.4 },
    ],
    powerUps: [
      { lane: 2, zOffset: 50, y: ROOF_COIN_Y + 0.35, pool: ['mystery_box', 'multiplier', 'sneakers'], chance: 0.45 },
    ],
  },
  {
    id: 't2_twin_ramps_choice',
    name: 'Twin Purple & Green Ramps',
    tier: 2,
    length: 54,
    hazards: [
      { kind: 'train_ramp', lane: 0, zOffset: 20, line: 'purple' },
      { kind: 'train_ramp', lane: 2, zOffset: 20, line: 'green' },
      { kind: 'gantry_low', lane: 1, zOffset: 16 },
      { kind: 'barrier_jump', lane: 1, zOffset: 32 },
    ],
    coinLines: [
      { lane: 0, zOffset: 15, count: 5, spacing: 2.6, yBase: ROOF_COIN_Y },
      { lane: 2, zOffset: 15, count: 5, spacing: 2.6, yBase: ROOF_COIN_Y },
      { lane: 1, zOffset: 14, count: 4, spacing: 2.2, yBase: 0.72 },
    ],
    powerUps: [
      { lane: 0, zOffset: 27, y: ROOF_COIN_Y + 0.35, pool: ['kaapi', 'drone'], chance: 0.35 },
      { lane: 2, zOffset: 27, y: ROOF_COIN_Y + 0.35, pool: ['sneakers', 'magnet'], chance: 0.35 },
    ],
  },
  {
    id: 't2_pillar_tunnel_zigzag',
    name: 'Majestic Pillar Zigzag',
    tier: 2,
    length: 52,
    hazards: [
      { kind: 'pillar_narrow', lane: 0, zOffset: 10 },
      { kind: 'pillar_narrow', lane: 2, zOffset: 10 },
      { kind: 'pillar_narrow', lane: 1, zOffset: 22 },
      { kind: 'gantry_low', lane: 0, zOffset: 34 },
      { kind: 'barrier_jump', lane: 2, zOffset: 34 },
      { kind: 'pillar_narrow', lane: 1, zOffset: 42 },
    ],
    coinLines: [
      { lane: 1, endLane: 2, zOffset: 8, count: 6, spacing: 2.4, yBase: GROUND_COIN_Y },
      { lane: 2, endLane: 0, zOffset: 24, count: 6, spacing: 2.6, yBase: GROUND_COIN_Y },
    ],
    powerUps: [{ lane: 0, zOffset: 44, y: 1.35, chance: 0.3 }],
  },
  {
    id: 't2_barrier_to_ramp_combo',
    name: 'Vault Into Ramp Launch',
    tier: 2,
    length: 56,
    hazards: [
      { kind: 'barrier_jump', lane: 1, zOffset: 10 },
      { kind: 'train_ramp', lane: 1, zOffset: 30, line: 'green' },
      { kind: 'train_static', lane: 2, zOffset: 26, line: 'purple' },
      { kind: 'barricade_bbmp', lane: 0, zOffset: 34 },
    ],
    coinLines: [
      { lane: 1, zOffset: 6, count: 5, spacing: 2.0, yBase: GROUND_COIN_Y, archHeight: 2.1 },
      { lane: 1, zOffset: 24, count: 6, spacing: 2.6, yBase: ROOF_COIN_Y },
      { lane: 0, zOffset: 12, count: 6, spacing: 2.8, yBase: GROUND_COIN_Y },
    ],
    powerUps: [
      { lane: 1, zOffset: 36, y: ROOF_COIN_Y + 0.35, pool: ['sneakers', 'multiplier'], chance: 0.36 },
    ],
  },
  {
    id: 't2_rooftop_mystery_sprint',
    name: 'Rooftop Mystery Sprint',
    tier: 2,
    length: 58,
    hazards: [
      { kind: 'train_ramp', lane: 2, zOffset: 18, line: 'purple' },
      { kind: 'train_static', lane: 2, zOffset: 40, line: 'purple' },
      { kind: 'train_static', lane: 0, zOffset: 28, line: 'green' },
      { kind: 'gantry_low', lane: 1, zOffset: 24 },
      { kind: 'barricade_bbmp', lane: 1, zOffset: 42 },
    ],
    coinLines: [
      { lane: 2, zOffset: 13, count: 5, spacing: 2.6, yBase: ROOF_COIN_Y },
      { lane: 2, zOffset: 33, count: 6, spacing: 2.6, yBase: ROOF_COIN_Y },
      { lane: 1, zOffset: 20, count: 5, spacing: 2.2, yBase: 0.72 },
    ],
    powerUps: [
      { lane: 2, zOffset: 46, y: ROOF_COIN_Y + 0.35, pool: ['mystery_box'], chance: 0.5 },
    ],
  },

  // ======================== TIER 3: MOVING TRAIN EXPRESS (6 chunks) ========================
  {
    id: 't3_express_center_dodge',
    name: 'Center Express Rush',
    tier: 3,
    length: 56,
    hazards: [
      { kind: 'train_moving', lane: 1, zOffset: 34, line: 'purple' },
      { kind: 'barrier_jump', lane: 0, zOffset: 18 },
      { kind: 'gantry_low', lane: 2, zOffset: 26 },
    ],
    coinLines: [
      { lane: 0, zOffset: 14, count: 5, spacing: 2.1, yBase: GROUND_COIN_Y, archHeight: 2.1 },
      { lane: 2, zOffset: 21, count: 5, spacing: 2.3, yBase: 0.72 },
    ],
    powerUps: [{ lane: 0, zOffset: 38, y: 1.35, pool: ['kaapi', 'magnet', 'multiplier'], chance: 0.3 }],
  },
  {
    id: 't3_double_express_stagger',
    name: 'Whitefield Twin Express',
    tier: 3,
    length: 62,
    hazards: [
      { kind: 'train_moving', lane: 0, zOffset: 28, line: 'purple' },
      { kind: 'train_moving', lane: 2, zOffset: 48, line: 'green' },
      { kind: 'barricade_bbmp', lane: 1, zOffset: 22 },
      { kind: 'gantry_low', lane: 1, zOffset: 42 },
    ],
    coinLines: [
      { lane: 1, zOffset: 18, count: 5, spacing: 2.1, yBase: GROUND_COIN_Y, archHeight: 2.15 },
      { lane: 1, zOffset: 38, count: 5, spacing: 2.2, yBase: 0.72 },
    ],
    powerUps: [{ lane: 1, zOffset: 54, y: 1.35, chance: 0.32 }],
  },
  {
    id: 't3_ramp_over_express',
    name: 'High Ground Over Express',
    tier: 3,
    length: 62,
    hazards: [
      { kind: 'train_ramp', lane: 0, zOffset: 20, line: 'purple' },
      { kind: 'train_static', lane: 0, zOffset: 44, line: 'purple' },
      { kind: 'train_moving', lane: 1, zOffset: 36, line: 'green' },
      { kind: 'barrier_jump', lane: 2, zOffset: 28 },
    ],
    coinLines: [
      { lane: 0, zOffset: 15, count: 5, spacing: 2.6, yBase: ROOF_COIN_Y },
      { lane: 0, zOffset: 38, count: 5, spacing: 2.6, yBase: ROOF_COIN_Y },
      { lane: 2, zOffset: 24, count: 5, spacing: 2.1, yBase: GROUND_COIN_Y, archHeight: 2.0 },
    ],
    powerUps: [
      { lane: 0, zOffset: 48, y: ROOF_COIN_Y + 0.35, pool: ['drone', 'mystery_box', 'kaapi'], chance: 0.42 },
    ],
  },
  {
    id: 't3_gantry_express_split',
    name: 'Low Signal & Express Split',
    tier: 3,
    length: 58,
    hazards: [
      { kind: 'train_moving', lane: 2, zOffset: 32, line: 'green' },
      { kind: 'train_static', lane: 0, zOffset: 26, line: 'purple' },
      { kind: 'gantry_low', lane: 1, zOffset: 16 },
      { kind: 'barrier_jump', lane: 1, zOffset: 36 },
    ],
    coinLines: [
      { lane: 1, zOffset: 13, count: 4, spacing: 2.2, yBase: 0.72 },
      { lane: 1, zOffset: 32, count: 5, spacing: 2.0, yBase: GROUND_COIN_Y, archHeight: 2.15 },
    ],
    powerUps: [{ lane: 1, zOffset: 46, y: 1.35, pool: ['sneakers', 'multiplier'], chance: 0.32 }],
  },
  {
    id: 't3_pillar_express_corridor',
    name: 'Silk Board Express Corridor',
    tier: 3,
    length: 60,
    hazards: [
      { kind: 'train_moving', lane: 0, zOffset: 34, line: 'purple' },
      { kind: 'pillar_narrow', lane: 1, zOffset: 14 },
      { kind: 'pillar_narrow', lane: 2, zOffset: 28 },
      { kind: 'pillar_narrow', lane: 1, zOffset: 42 },
    ],
    coinLines: [
      { lane: 2, endLane: 1, zOffset: 12, count: 6, spacing: 2.6, yBase: GROUND_COIN_Y },
      { lane: 1, endLane: 2, zOffset: 30, count: 6, spacing: 2.6, yBase: GROUND_COIN_Y },
    ],
    powerUps: [{ lane: 2, zOffset: 48, y: 1.35, chance: 0.28 }],
  },
  {
    id: 't3_staggered_zigzag_express',
    name: 'Staggered Metro Zigzag',
    tier: 3,
    length: 64,
    hazards: [
      { kind: 'train_moving', lane: 2, zOffset: 28, line: 'purple' },
      { kind: 'train_ramp', lane: 1, zOffset: 38, line: 'green' },
      { kind: 'barricade_bbmp', lane: 0, zOffset: 20 },
      { kind: 'gantry_low', lane: 0, zOffset: 44 },
    ],
    coinLines: [
      { lane: 0, endLane: 1, zOffset: 10, count: 6, spacing: 2.6, yBase: GROUND_COIN_Y },
      { lane: 1, zOffset: 33, count: 6, spacing: 2.6, yBase: ROOF_COIN_Y },
    ],
    powerUps: [
      { lane: 1, zOffset: 45, y: ROOF_COIN_Y + 0.35, pool: ['kaapi', 'magnet', 'sneakers'], chance: 0.38 },
    ],
  },

  // ======================== TIER 4: HIGH-SPEED GAUNTLET (6 chunks) ========================
  {
    id: 't4_canyon_parkour_chain',
    name: 'Namma Canyon Parkour Chain',
    tier: 4,
    length: 68,
    hazards: [
      { kind: 'train_ramp', lane: 0, zOffset: 18, line: 'purple' },
      { kind: 'train_static', lane: 1, zOffset: 36, line: 'green' },
      { kind: 'train_static', lane: 0, zOffset: 54, line: 'purple' },
      { kind: 'train_moving', lane: 2, zOffset: 44, line: 'purple' },
      { kind: 'gantry_low', lane: 1, zOffset: 14 },
    ],
    coinLines: [
      { lane: 0, zOffset: 14, count: 4, spacing: 2.5, yBase: ROOF_COIN_Y },
      { lane: 0, endLane: 1, zOffset: 25, count: 4, spacing: 2.5, yBase: ROOF_COIN_Y + 0.5 },
      { lane: 1, endLane: 0, zOffset: 40, count: 5, spacing: 2.6, yBase: ROOF_COIN_Y + 0.5 },
    ],
    powerUps: [
      { lane: 0, zOffset: 58, y: ROOF_COIN_Y + 0.35, pool: ['mystery_box', 'drone'], chance: 0.5 },
    ],
  },
  {
    id: 't4_switchback_gantry_express',
    name: 'Hyper Switchback Express',
    tier: 4,
    length: 64,
    hazards: [
      { kind: 'train_moving', lane: 1, zOffset: 36, line: 'green' },
      { kind: 'gantry_low', lane: 0, zOffset: 14 },
      { kind: 'barrier_jump', lane: 2, zOffset: 14 },
      { kind: 'barrier_jump', lane: 0, zOffset: 34 },
      { kind: 'gantry_low', lane: 2, zOffset: 34 },
      { kind: 'pillar_narrow', lane: 0, zOffset: 52 },
      { kind: 'pillar_narrow', lane: 2, zOffset: 52 },
    ],
    coinLines: [
      { lane: 0, zOffset: 11, count: 4, spacing: 2.2, yBase: 0.72 },
      { lane: 0, endLane: 2, zOffset: 24, count: 5, spacing: 2.4, yBase: GROUND_COIN_Y },
      { lane: 2, endLane: 1, zOffset: 42, count: 5, spacing: 2.5, yBase: GROUND_COIN_Y },
    ],
    powerUps: [{ lane: 1, zOffset: 54, y: 1.35, pool: ['kaapi', 'multiplier'], chance: 0.38 }],
  },
  {
    id: 't4_twin_moving_roof_escape',
    name: 'Twin Express Roof Escape',
    tier: 4,
    length: 66,
    hazards: [
      { kind: 'train_ramp', lane: 1, zOffset: 18, line: 'purple' },
      { kind: 'train_static', lane: 1, zOffset: 44, line: 'green' },
      { kind: 'train_moving', lane: 0, zOffset: 34, line: 'purple' },
      { kind: 'train_moving', lane: 2, zOffset: 56, line: 'green' },
    ],
    coinLines: [
      { lane: 1, zOffset: 14, count: 5, spacing: 2.5, yBase: ROOF_COIN_Y },
      { lane: 1, zOffset: 29, count: 4, spacing: 2.2, yBase: ROOF_COIN_Y, archHeight: 1.85 },
      { lane: 1, zOffset: 40, count: 6, spacing: 2.5, yBase: ROOF_COIN_Y },
    ],
    powerUps: [
      { lane: 1, zOffset: 50, y: ROOF_COIN_Y + 0.35, pool: ['mystery_box', 'kaapi', 'sneakers'], chance: 0.48 },
    ],
  },
  {
    id: 't4_pillar_slalom_to_ramp',
    name: 'Pillar Slalom Into Ramp',
    tier: 4,
    length: 64,
    hazards: [
      { kind: 'pillar_narrow', lane: 1, zOffset: 10 },
      { kind: 'pillar_narrow', lane: 0, zOffset: 20 },
      { kind: 'pillar_narrow', lane: 2, zOffset: 20 },
      { kind: 'train_ramp', lane: 2, zOffset: 38, line: 'green' },
      { kind: 'train_moving', lane: 0, zOffset: 44, line: 'purple' },
      { kind: 'gantry_low', lane: 1, zOffset: 42 },
    ],
    coinLines: [
      { lane: 0, endLane: 1, zOffset: 8, count: 5, spacing: 2.4, yBase: GROUND_COIN_Y },
      { lane: 1, endLane: 2, zOffset: 22, count: 5, spacing: 2.3, yBase: GROUND_COIN_Y },
      { lane: 2, zOffset: 34, count: 6, spacing: 2.6, yBase: ROOF_COIN_Y },
    ],
    powerUps: [
      { lane: 2, zOffset: 46, y: ROOF_COIN_Y + 0.35, pool: ['drone', 'multiplier'], chance: 0.4 },
    ],
  },
  {
    id: 't4_speed_canyon_ribbon',
    name: 'Bengaluru Speed Canyon',
    tier: 4,
    length: 62,
    hazards: [
      { kind: 'train_static', lane: 0, zOffset: 24, line: 'purple' },
      { kind: 'train_static', lane: 2, zOffset: 24, line: 'green' },
      { kind: 'barrier_jump', lane: 1, zOffset: 14 },
      { kind: 'gantry_low', lane: 1, zOffset: 28 },
      { kind: 'barricade_bbmp', lane: 1, zOffset: 42 },
      { kind: 'train_moving', lane: 0, zOffset: 54, line: 'green' },
    ],
    coinLines: [
      { lane: 1, zOffset: 10, count: 5, spacing: 2.0, yBase: GROUND_COIN_Y, archHeight: 2.1 },
      { lane: 1, zOffset: 24, count: 5, spacing: 2.1, yBase: 0.72 },
      { lane: 1, zOffset: 38, count: 5, spacing: 2.0, yBase: GROUND_COIN_Y, archHeight: 2.15 },
    ],
    powerUps: [{ lane: 2, zOffset: 52, y: 1.35, pool: ['kaapi', 'magnet'], chance: 0.36 }],
  },
  {
    id: 't4_grand_mystery_gauntlet',
    name: 'Grand Metro Gauntlet',
    tier: 4,
    length: 68,
    hazards: [
      { kind: 'train_ramp', lane: 2, zOffset: 18, line: 'green' },
      { kind: 'train_static', lane: 2, zOffset: 44, line: 'purple' },
      { kind: 'train_static', lane: 0, zOffset: 32, line: 'purple' },
      { kind: 'train_moving', lane: 1, zOffset: 50, line: 'green' },
      { kind: 'barrier_jump', lane: 1, zOffset: 14 },
    ],
    coinLines: [
      { lane: 2, zOffset: 13, count: 5, spacing: 2.6, yBase: ROOF_COIN_Y },
      { lane: 2, zOffset: 29, count: 4, spacing: 2.2, yBase: ROOF_COIN_Y, archHeight: 1.8 },
      { lane: 2, zOffset: 40, count: 6, spacing: 2.5, yBase: ROOF_COIN_Y },
    ],
    powerUps: [
      { lane: 2, zOffset: 50, y: ROOF_COIN_Y + 0.35, pool: ['mystery_box'], chance: 0.58 },
    ],
  },
];

export function getDifficultyTierForDistance(distanceMeters: number): DifficultyTier {
  if (distanceMeters < 180) return 1;
  if (distanceMeters < 480) return 2;
  if (distanceMeters < 920) return 3;
  return 4;
}

/**
 * Picks a handcrafted chunk appropriate for the current distance & tier,
 * avoiding back-to-back repeats and mixing in earlier tiers for rhythmic variety.
 */
export function selectNextChunk(
  distanceMeters: number,
  lastChunkId: string | null,
  rng: () => number = Math.random,
): LevelChunk {
  const maxTier = getDifficultyTierForDistance(distanceMeters);
  // 70% from current tier, 30% from any unlocked tier for pacing breathers
  const useCurrentTier = maxTier === 1 || rng() < 0.72;
  let candidates = LEVEL_CHUNKS.filter((c) =>
    useCurrentTier ? c.tier === maxTier : c.tier <= maxTier,
  );
  if (lastChunkId && candidates.length > 1) {
    candidates = candidates.filter((c) => c.id !== lastChunkId);
  }
  const idx = Math.floor(Math.min(0.999999, Math.max(0, rng())) * candidates.length);
  return candidates[idx] ?? LEVEL_CHUNKS[0];
}

/**
 * Fairness validator: ensures no Z slice across a chunk ever blocks all 3 lanes
 * with unavoidable solid ground walls (every Z slice must have at least 1 clear,
 * jumpable, rollable, or ramp-climbable lane).
 */
export function validateChunkFairness(chunk: LevelChunk): { valid: boolean; reason?: string } {
  if (chunk.length < 30) {
    return { valid: false, reason: `Chunk ${chunk.id} length too short` };
  }

  // Check Z slices every 2 units along chunk depth
  for (let z = 0; z <= chunk.length; z += 2) {
    const blockedLanes = new Set<number>();
    let hasRampAccess = false;
    for (const h of chunk.hazards) {
      if (h.kind === 'train_ramp') {
        const front = h.zOffset - 8 - 5.4;
        const back = h.zOffset + 8;
        if (z >= front && z <= back) {
          hasRampAccess = true;
        }
        continue;
      }
      if (h.kind === 'train_static' || h.kind === 'train_moving') {
        const halfLen = h.kind === 'train_moving' ? 9 : 8;
        if (z >= h.zOffset - halfLen && z <= h.zOffset + halfLen) {
          blockedLanes.add(h.lane);
        }
      } else if (h.kind === 'pillar_narrow') {
        if (Math.abs(z - h.zOffset) <= 1.2) {
          blockedLanes.add(h.lane);
        }
      }
      // barrier_jump, barricade_bbmp, and gantry_low are ALWAYS dodgeable via jump or roll!
    }
    if (blockedLanes.size >= 3 && !hasRampAccess) {
      return {
        valid: false,
        reason: `Chunk ${chunk.id} blocks all 3 lanes with unavoidable solids at zOffset=${z}`,
      };
    }
  }

  return { valid: true };
}
