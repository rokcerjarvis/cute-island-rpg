export const TILE_SIZE = 32;
export const MAP_COLUMNS = 40;
export const MAP_ROWS = 28;
export type TileKind = 'ground' | 'path' | 'grass' | 'water' | 'tree' | 'rock' | 'tent';
export interface WorldTile { column: number; row: number; kind: TileKind; regionId: string }
export interface WorldMap { width: number; height: number; tiles: WorldTile[]; spawn: { x: number; y: number } }
export const isSolid = (kind: TileKind): boolean => ['water', 'tree', 'rock', 'tent'].includes(kind);

export function createWorldMap(): WorldMap {
  const tiles: WorldTile[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let column = 0; column < MAP_COLUMNS; column++) {
      let kind: TileKind = 'ground';
      let regionId = column < 10 ? 'camp' : column < 22 ? 'meadow' : row < 14 ? 'forest' : 'deep-forest';
      if (column >= 11 && column <= 19 && row >= 5 && row <= 10) { kind = 'water'; regionId = 'pond'; }
      else if ((column >= 11 && column <= 20 && row >= 16 && row <= 22) || (column >= 25 && column <= 36 && row >= 6 && row <= 22)) kind = 'grass';
      if (row === 13 || row === 14 || (column === 7 && row >= 10 && row <= 19)) kind = 'path';
      if (column >= 23 && row !== 13 && row !== 14 && (row === 3 || row === 24 || column === 23 || column === 38 || (column % 5 === 0 && row % 5 === 0))) kind = 'tree';
      if ((row === 3 || row === 24) && (column === 27 || column === 34 || column === 39)) kind = 'path';
      if ((column === 4 && row === 9) || (column === 5 && row === 9)) kind = 'tent';
      if ((column === 9 && row === 18) || (column === 18 && row === 24) || (column === 31 && row === 18)) kind = 'rock';
      if (kind === 'grass' && column >= 28 && column <= 29 && row >= 19 && row <= 20) regionId = 'special-cute-grass';
      if (column === 34 && row >= 14 && row <= 22) kind = 'path';
      if (column >= 34 && column <= 36 && row >= 21 && row <= 22) { kind = 'path'; regionId = 'boss-area'; }
      tiles.push({ column, row, kind, regionId });
    }
  }
  return { width: MAP_COLUMNS * TILE_SIZE, height: MAP_ROWS * TILE_SIZE, tiles, spawn: { x: 7.5 * TILE_SIZE, y: 12.5 * TILE_SIZE } };
}

export function tileAt(map: WorldMap, x: number, y: number): WorldTile | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.tiles[Math.floor(y / TILE_SIZE) * MAP_COLUMNS + Math.floor(x / TILE_SIZE)];
}
