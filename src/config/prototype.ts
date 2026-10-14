export const PROTOTYPE_PLAYER = { entityId: 'CUTE_001', level: 5 } as const;
export const BATTLE_CONFIG = {
  referenceLevel: 5, minStat: 1, minLevel: 1, maxLevel: 50,
  attackCoefficient: 0.7, powerCoefficient: 0.25, levelCoefficient: 0.3, randomMin: 0.9, randomMax: 1.1,
  advantage: 1.5, disadvantage: 0.75,
  healFraction: 0.2, aiHealThreshold: 0.9,
  braceMultiplier: 0.5, feignMultiplier: 0.3,
  nextAttackMultiplier: 0.8, nextSpeedMultiplier: 0.7,
  messageDelayMs: 220,
} as const;
