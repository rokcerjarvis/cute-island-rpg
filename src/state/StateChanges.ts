import type { RuntimeGameState } from './RuntimeGameState';
/** Request a checkpoint; storage is called only once all battle choices are complete. */
export function requestAutoSave(state: RuntimeGameState): void { state.isDirty = true; state.pendingAutoSave = true; }
