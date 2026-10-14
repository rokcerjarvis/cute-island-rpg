import { describe, expect, it } from 'vitest';
import { createWorldMap, isSolid, MAP_COLUMNS, MAP_ROWS, tileAt, TILE_SIZE } from '../src/data/world';
import { resolveMovement, WALK_SPEED } from '../src/systems/movement';
import { ExplorationTracker, type TileEnteredEvent } from '../src/systems/ExplorationTracker';

describe('walking input', () => {
  const idle = { up: false, down: false, left: false, right: false };
  it.each([
    ['up', 0, -WALK_SPEED], ['down', 0, WALK_SPEED], ['left', -WALK_SPEED, 0], ['right', WALK_SPEED, 0],
  ] as const)('moves %s at fixed speed', (direction, x, y) => {
    expect(resolveMovement({ ...idle, [direction]: true })).toEqual({ x, y, facing: direction });
  });
  it('stops on release and cancels opposite inputs', () => {
    expect(resolveMovement(idle)).toEqual({ x: 0, y: 0 });
    expect(resolveMovement({ ...idle, up: true, down: true })).toEqual({ x: 0, y: 0 });
  });
  it('never moves diagonally', () => {
    expect(resolveMovement({ ...idle, up: true, right: true })).toEqual({ x: 0, y: -WALK_SPEED, facing: 'up' });
  });
});

describe('map and exploration boundary', () => {
  const map = createWorldMap();
  it('has complete tiles, a walkable spawn and rejects outside coordinates', () => {
    expect(map.tiles).toHaveLength(MAP_COLUMNS * MAP_ROWS);
    expect(isSolid(tileAt(map, map.spawn.x, map.spawn.y)!.kind)).toBe(false);
    expect(tileAt(map, -1, 0)).toBeUndefined();
    expect(tileAt(map, map.width, 0)).toBeUndefined();
    expect(tileAt(map, 0, map.height)).toBeUndefined();
  });
  it('defines water, trees, rocks and tents as obstacles', () => {
    for (const kind of ['water', 'tree', 'rock', 'tent'] as const) expect(isSolid(kind)).toBe(true);
    for (const kind of ['path', 'grass', 'ground'] as const) expect(isSolid(kind)).toBe(false);
  });
  it('keeps all walkable tiles reachable from the camp', () => {
    const start = tileAt(map, map.spawn.x, map.spawn.y)!;
    const visited = new Set<number>();
    const queue = [start.row * MAP_COLUMNS + start.column];
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      if (visited.has(id)) continue;
      visited.add(id);
      const tile = map.tiles[id];
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const next = tileAt(map, (tile.column + dx + 0.5) * TILE_SIZE, (tile.row + dy + 0.5) * TILE_SIZE);
        if (next && !isSolid(next.kind) && !visited.has(next.row * MAP_COLUMNS + next.column)) queue.push(next.row * MAP_COLUMNS + next.column);
      }
    }
    expect(visited.size).toBe(map.tiles.filter(tile => !isSolid(tile.kind)).length);
  });
  it('emits once per tile entry, only marks grass eligible and allows reentry', () => {
    const events: TileEnteredEvent[] = [];
    const tracker = new ExplorationTracker(map, event => events.push(event));
    const grass = map.tiles.find(tile => tile.kind === 'grass')!;
    const x = (grass.column + 0.5) * TILE_SIZE;
    const y = (grass.row + 0.5) * TILE_SIZE;
    tracker.update(map.spawn.x, map.spawn.y);
    tracker.update(map.spawn.x + 1, map.spawn.y);
    tracker.update(x, y);
    tracker.update(x + 1, y);
    tracker.update(map.spawn.x, map.spawn.y);
    tracker.update(x, y);
    expect(events.map(event => event.encounterEligible)).toEqual([false, true, false, true]);
  });
});
