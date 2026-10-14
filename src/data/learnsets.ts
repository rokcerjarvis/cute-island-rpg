const LEVELS = [1, 4, 8, 12, 16, 22, 30, 40];
const CUTE_SKILLS: Record<string, string[]> = {
  CUTE_001: ['001', '003', '010', '011', '002', '012', '005', '006'],
  CUTE_002: ['002', '008', '012', '013', '003', '009', '005', '006'],
  CUTE_003: ['004', '009', '014', '007', '006', '008', '005', '003'],
  CUTE_004: ['001', '004', '010', '006', '003', '011', '005', '014'],
  CUTE_005: ['002', '008', '011', '003', '012', '013', '005', '006'],
};
export const learnsets: Record<string, { level: number; skillId: string }[]> = Object.fromEntries(Object.entries(CUTE_SKILLS).map(([id, ids]) => [id, ids.map((skill, index) => ({ level: LEVELS[index], skillId: `SKILL_${skill}` }))]));
learnsets.MON_001 = [{ level: 1, skillId: 'SKILL_001' }, { level: 4, skillId: 'SKILL_003' }];
learnsets.MON_002 = [{ level: 1, skillId: 'SKILL_004' }, { level: 4, skillId: 'SKILL_005' }, { level: 8, skillId: 'SKILL_006' }];
learnsets.MON_003 = ['SKILL_001', 'SKILL_003', 'SKILL_005', 'SKILL_010'].map(skillId => ({ level: 1, skillId }));
export const baseExperience: Record<string, number> = { CUTE_001: 10, CUTE_002: 10, CUTE_003: 12, CUTE_004: 11, CUTE_005: 15, MON_001: 12, MON_002: 18, MON_003: 40 };
