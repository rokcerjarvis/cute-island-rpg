export type Direction = 'up' | 'down' | 'left' | 'right';
export interface MovementInput { up: boolean; down: boolean; left: boolean; right: boolean }
export const WALK_SPEED = 96;

// Vertical input wins simultaneous axes: this prototype deliberately has four directions.
export function resolveMovement(input: MovementInput): { x: number; y: number; facing?: Direction } {
  const y = Number(input.down) - Number(input.up);
  const x = Number(input.right) - Number(input.left);
  if (y) return { x: 0, y: y * WALK_SPEED, facing: y > 0 ? 'down' : 'up' };
  if (x) return { x: x * WALK_SPEED, y: 0, facing: x > 0 ? 'right' : 'left' };
  return { x: 0, y: 0 };
}
