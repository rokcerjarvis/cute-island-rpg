import type { CreatureInstance } from '../entities/CreatureInstance';
import { entityDefinitions } from '../data/encounters';
import { skills } from '../data/skills';
import { expForLevel, EXPERIENCE_CONFIG } from '../systems/ExperienceSystem';
import { CATEGORY_NAMES, EFFECT_DESCRIPTIONS } from './ViewModels';
export function statusView(member: CreatureInstance) {
  const definition = entityDefinitions[member.creatureId];
  const maxLevel = member.level >= EXPERIENCE_CONFIG.maxLevel;
  const start = expForLevel(member.level), next = expForLevel(member.level + 1);
  const evolution = definition.evolution;
  return {
    instanceId: member.instanceId, name: definition.name, level: member.level, attribute: definition.attribute,
    currentHp: member.currentHp, maxHp: member.maxHp, attack: member.attack, speed: member.speed, currentExp: member.currentExp,
    fainted: member.currentHp <= 0 || member.status === 'FAINTED', maxLevel,
    neededExp: maxLevel ? 0 : Math.max(0, next - member.currentExp),
    expRatio: maxLevel ? 1 : Math.max(0, Math.min(1, (member.currentExp - start) / (next - start))),
    evolution: evolution ? `Lv.${evolution.level} → ${entityDefinitions[evolution.targetCreatureId].name}` : '無',
    pureCute: definition.attribute === 'PURE_CUTE',
    // Identity row reserved for M9; never infer starter identity from slot or instance id.
    skills: member.knownSkills.slice(0, 4).filter(id => skills[id]).map(id => {
      const skill = skills[id];
      return { id, name: skill.name, category: skill.category, label: `${skill.name} · ${CATEGORY_NAMES[skill.category]} · ${skill.power > 0 ? `P${skill.power} / ${skill.accuracy}%` : EFFECT_DESCRIPTIONS[skill.effect] || '特殊技'}` };
    }),
  };
}
export function adjacentMember(index: number, direction: number, count: number): number { return count > 0 ? ((index + direction) % count + count) % count : 0; }
