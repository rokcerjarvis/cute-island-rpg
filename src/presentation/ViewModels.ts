import type { BattleEntity } from '../entities/BattleEntity';
import type { SkillDefinition } from '../data/skills';
import { creatureVisual, ATTRIBUTE_KEYS } from './AssetManifest';
export const THEME = { ink: 0x213d35, panel: 0x29483e, border: 0xa0ae85, normal: 0x92b77b, warning: 0xe0bf73, danger: 0xd58575, text: '#fff0d0', muted: '#b9c8ab' } as const;
export function hpView(current: number, max: number) {
  const ratio = max > 0 && Number.isFinite(current) && Number.isFinite(max) ? Math.max(0, Math.min(1, current / max)) : 0;
  return { ratio, color: ratio > 0.5 ? THEME.normal : ratio >= 0.2 ? THEME.warning : THEME.danger };
}
export function hudView(entity: BattleEntity, isBoss = false) {
  return { name: entity.definition.name, level: entity.level, attributeKey: ATTRIBUTE_KEYS[entity.definition.attribute], ...creatureVisual(entity.definition.id), hp: hpView(entity.hp, entity.maxHp), capturable: entity.definition.kind === 'CUTE_CREATURE' && entity.definition.capturable && !isBoss, isBoss };
}
export const CATEGORY_NAMES = { STABLE: '穩定', HEAVY: '重擊', QUICK: '快速', SPECIAL: '特殊' } as const;
export const EFFECT_DESCRIPTIONS: Record<SkillDefinition['effect'], string> = { NONE: '', DAMAGE_REDUCTION_50: '受到傷害 -50%', HEAL_20_PERCENT: '回復 Max HP 20%', NEXT_ATTACK_DAMAGE_REDUCTION_20: '對手下一次傷害 -20%', NEXT_ACTION_SPEED_REDUCTION_30: '對手下次出手速度 -30%', DAMAGE_REDUCTION_70: '受到傷害 -70%' };
export function skillView(skill: SkillDefinition) { return { name: skill.name, power: skill.power, accuracy: skill.accuracy, category: CATEGORY_NAMES[skill.category], detail: `${skill.name} · 威力 ${skill.power} · 命中 ${skill.accuracy}%${EFFECT_DESCRIPTIONS[skill.effect] ? ` · ${EFFECT_DESCRIPTIONS[skill.effect]}` : ''}` }; }
export function skillMenu(ids: string[], skills: Record<string, SkillDefinition>) { return ids.slice(0, 4).filter(id => skills[id]).map(id => ({ id, ...skillView(skills[id]) })); }
export function moveFocus(index: number, key: string, count: number, columns = 2): number { if (!count) return 0; const delta = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : key === 'ArrowDown' ? columns : key === 'ArrowUp' ? -columns : 0; return (index + delta + count) % count; }
export type VisualEvent =
  | { type: 'ACTION'; side: 'player' | 'enemy'; skillId: string; hit: boolean; actorHp: number; targetHp: number; actorAfterHp: number; targetAfterHp: number }
  | { type: 'CUTE'; side: 'player' | 'enemy'; event: 'SLEEP' | 'CHARM' | 'FART' | 'CUTE_POSE'; hp: number }
  | { type: 'SLEEP'; side: 'player' | 'enemy' }
  | { type: 'CAPTURE'; success: boolean; item?: 'SNACK' | 'LUXURY' | 'BRIBE' };
export const PRESENTATION_TIMING = { message: 400, encounter: 240, intro: 260, title: 260, attack: 180, hit: 150, cute: 260, capture: 800, evolution: 1600 } as const;
export class PresentationLock {
  locked = false;
  begin(): boolean { if (this.locked) return false; this.locked = true; return true; }
  end(): void { this.locked = false; }
}
