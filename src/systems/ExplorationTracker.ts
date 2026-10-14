import { tileAt, TILE_SIZE, type WorldMap, type WorldTile } from '../data/world';

export interface TileEnteredEvent {
  tile: WorldTile;
  encounterEligible: boolean;
  stepId: number;
}

// One event per tile entry. The initial observation is step 0.
export class ExplorationTracker {
  private previousKey = '';
  private stepId = -1;
  constructor(private readonly map: WorldMap, private readonly onEntered: (event: TileEnteredEvent) => void) {}
  update(x: number, y: number): void {
    const tile = tileAt(this.map, x, y);
    if (!tile) return;
    const key = `${Math.floor(x / TILE_SIZE)},${Math.floor(y / TILE_SIZE)}`;
    if (key === this.previousKey) return;
    this.previousKey = key;
    this.onEntered({ tile, encounterEligible: tile.kind === 'grass', stepId: ++this.stepId });
  }
}
