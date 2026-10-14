export const CREATURE_IDS = ['CUTE_001', 'CUTE_002', 'CUTE_003', 'CUTE_004', 'CUTE_005', 'EVO_001', 'EVO_002', 'MON_001', 'MON_002', 'MON_003'] as const;
export const TEXTURES = { fallback: 'asset-fallback', player: 'player-overworld', ball: 'capture-ball', grass: 'grass', forestGrass: 'forest-grass', specialGrass: 'special-grass', forestGround: 'forest-ground', forestTree: 'forest-tree', fire: 'campfire', crate: 'crate', cabin: 'cabin', stall: 'stall', background: 'battle-background', title: 'title-background', sparkle: 'pixel-sparkle' } as const;
export interface CreatureVisual { battleSpriteKey: string; worldSpriteKey: string; portraitKey: string }
export function creatureVisual(id: string): CreatureVisual {
  const key = CREATURE_IDS.some(value => value === id) ? `creature-${id.toLowerCase()}` : TEXTURES.fallback;
  return { battleSpriteKey: key, worldSpriteKey: key, portraitKey: key };
}
export function playerFrame(direction: string, frame: number): string { return `player-${direction}-${frame}`; }
export const ATTRIBUTE_KEYS = { WATER: 'attribute-water', FIRE: 'attribute-fire', EARTH: 'attribute-earth', WIND: 'attribute-wind', PURE_CUTE: 'attribute-pure-cute' } as const;
export const AssetManifest = [
  ...CREATURE_IDS.map(id => ({ key: creatureVisual(id).battleSpriteKey, path: `/assets/creatures/${id.startsWith('MON') ? 'monsters' : id.startsWith('EVO') ? 'evolutions' : 'cute'}/${id.toLowerCase()}.png` })),
  ...Object.entries(ATTRIBUTE_KEYS).map(([id, key]) => ({ key, path: `/assets/ui/attributes/${id.toLowerCase()}.png` })),
  ...Object.entries(TEXTURES).filter(([id]) => id !== 'player' && id !== 'grass').map(([id, key]) => ({ key, path: `/assets/${id === 'background' || id === 'title' ? 'battle/backgrounds' : id === 'ball' || id === 'fallback' || id === 'sparkle' ? 'ui/icons' : ['fire', 'crate', 'cabin', 'stall'].includes(id) ? 'world/objects' : 'world/tiles'}/${key}.png` })),
];
export const PLAYER_ASSET = { key: TEXTURES.player, path: '/assets/characters/player/player-overworld.png', frameWidth: 28, frameHeight: 28 };
export function availableTexture(key: string, exists: (key: string) => boolean): string { return exists(key) ? key : TEXTURES.fallback; }
