import type { RuntimeGameState } from '../state/RuntimeGameState';
import { createBattleEntry, type BattleEntryPayload, type WorldReturnState } from '../entities/BattleEntity';
import { entityDefinitions } from '../data/encounters';
import { DexSystem } from './DexSystem';
import { requestAutoSave } from '../state/StateChanges';
export const BOSS_ZONE = { left: 34 * 32, top: 21 * 32, width: 3 * 32, height: 2 * 32 } as const;
export function inBossZone(x: number, y: number): boolean {
  return x >= BOSS_ZONE.left && x < BOSS_ZONE.left + BOSS_ZONE.width && y >= BOSS_ZONE.top && y < BOSS_ZONE.top + BOSS_ZONE.height;
}
export class BossSystem {
  shouldTrigger(state: RuntimeGameState, x: number, y: number): boolean { return !state.bossDefeated && !state.battle && inBossZone(x, y); }
  entry(world: WorldReturnState, debugHp?: number): BattleEntryPayload {
    const entry = createBattleEntry(entityDefinitions.MON_003, 11, { ...world, zoneId: 'BOSS_AREA' });
    entry.isBoss = true;
    entry.messages = ['巨型森林怪出現了！'];
    if (debugHp !== undefined && Number.isFinite(debugHp)) entry.enemy.hp = Math.max(1, Math.min(entry.enemy.maxHp, Math.floor(debugHp)));
    return entry;
  }
  recordResult(state: RuntimeGameState, outcome: string): void { if (outcome === 'VICTORY') { state.bossDefeated = true; state.firstAreaComplete = true; requestAutoSave(state); } }
}
export function completionSummary(state: RuntimeGameState): string[] {
  const owned = [...state.party, ...state.reserveStorage];
  const dex = new DexSystem(state.dex);
  return ['營地好像變得熱鬧一點了。', '第一區開拓完成！', `小可愛圖鑑：${dex.countSeen()} / 7 · 已同行：${dex.countCaptured()}`, `已同行種類 ${state.capturedSpeciesIds.length} / 5（含初始同伴）`, `目前最高等級 Lv.${Math.max(...owned.map(member => member.level))}`, `Party ${state.party.length} / 5 · Reserve ${state.reserveStorage.length}`];
}
export function shouldUpgradeCamp(state: RuntimeGameState): boolean { return state.bossDefeated; }
