import type { RuntimeGameState } from '../state/RuntimeGameState';
export function advancePlayTime(state: RuntimeGameState, deltaMs: number, playing: boolean): void {
  if (playing && Number.isFinite(deltaMs) && deltaMs > 0) state.playTimeSeconds += Math.min(deltaMs, 250) / 1000;
}
