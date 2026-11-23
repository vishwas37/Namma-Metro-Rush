import type { PlayerProfile } from '../core/catalog';
import type { RunSummary } from '../core/simulation';
import { Canvas2DRunnerEngine } from './Canvas2DRunnerEngine';
import {
  MetroRunnerEngine,
  acquireWebGL2Context,
  type HudState,
  type RunnerEngine,
} from './MetroRunnerEngine';
import { SoundEngine } from './sound';

/**
 * Boots the full Three.js WebGL2 3D runner when a clean WebGL2 context can be
 * acquired, and silently falls back to the 2.5D perspective Canvas2D engine when
 * WebGL2 is unavailable (e.g. Linux Mesa/llvmpipe BindToCurrentSequence failures)
 * — ensuring zero THREE.WebGLRenderer console errors and 100% playable graphics.
 */
export function createRunnerEngine(
  container: HTMLElement,
  profile: PlayerProfile,
  sound: SoundEngine,
  onHud: (hud: HudState) => void,
  onRunEnd: (summary: RunSummary) => void,
): RunnerEngine {
  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const force2D = params?.get('renderer') === '2d';

  if (!force2D) {
    const webgl = acquireWebGL2Context(profile.quality === 'high');
    if (webgl) {
      try {
        return new MetroRunnerEngine(container, profile, sound, onHud, onRunEnd, webgl);
      } catch {
        // Clear any partially attached canvas before initializing Canvas2D fallback
        container.innerHTML = '';
      }
    }
  }

  return new Canvas2DRunnerEngine(container, profile, sound, onHud, onRunEnd);
}
