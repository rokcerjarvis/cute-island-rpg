export type SkillEffect = 'NONE' | 'DAMAGE_REDUCTION_50' | 'HEAL_20_PERCENT' | 'NEXT_ATTACK_DAMAGE_REDUCTION_20' | 'NEXT_ACTION_SPEED_REDUCTION_30' | 'DAMAGE_REDUCTION_70';
export interface SkillDefinition {
  id: string; name: string; category: 'STABLE' | 'HEAVY' | 'QUICK' | 'SPECIAL';
  power: number; accuracy: number; priority: number; effect: SkillEffect;
}
export const skills: Record<string, SkillDefinition> = Object.fromEntries([
  { id: 'SKILL_001', name: '舔一口', category: 'STABLE', power: 20, accuracy: 100, priority: 0, effect: 'NONE' },
  { id: 'SKILL_002', name: '戳鼻子', category: 'STABLE', power: 24, accuracy: 100, priority: 0, effect: 'NONE' },
  { id: 'SKILL_003', name: '頭頂', category: 'STABLE', power: 28, accuracy: 95, priority: 0, effect: 'NONE' },
  { id: 'SKILL_004', name: '慢慢揍', category: 'STABLE', power: 32, accuracy: 90, priority: 0, effect: 'NONE' },
  { id: 'SKILL_005', name: '超大聲嚇人', category: 'HEAVY', power: 45, accuracy: 80, priority: 0, effect: 'NONE' },
  { id: 'SKILL_006', name: '狠狠揍', category: 'HEAVY', power: 50, accuracy: 75, priority: 0, effect: 'NONE' },
  { id: 'SKILL_007', name: '呀哈飛踢', category: 'HEAVY', power: 55, accuracy: 70, priority: 0, effect: 'NONE' },
  { id: 'SKILL_008', name: '偷偷打一下', category: 'QUICK', power: 14, accuracy: 100, priority: 1, effect: 'NONE' },
  { id: 'SKILL_009', name: '突然踢一下', category: 'QUICK', power: 18, accuracy: 95, priority: 1, effect: 'NONE' },
  { id: 'SKILL_010', name: '縮成一團', category: 'SPECIAL', power: 0, accuracy: 100, priority: 0, effect: 'DAMAGE_REDUCTION_50' },
  { id: 'SKILL_011', name: '嗚啦', category: 'SPECIAL', power: 0, accuracy: 100, priority: 0, effect: 'HEAL_20_PERCENT' },
  { id: 'SKILL_012', name: '瞪著看', category: 'SPECIAL', power: 0, accuracy: 90, priority: 0, effect: 'NEXT_ATTACK_DAMAGE_REDUCTION_20' },
  { id: 'SKILL_013', name: '原地亂叫', category: 'SPECIAL', power: 0, accuracy: 85, priority: 0, effect: 'NEXT_ACTION_SPEED_REDUCTION_30' },
  { id: 'SKILL_014', name: '裝死', category: 'SPECIAL', power: 0, accuracy: 80, priority: 1, effect: 'DAMAGE_REDUCTION_70' },
].map(skill => [skill.id, skill as SkillDefinition]));
