export type MatterState = 'solid' | 'liquid' | 'gas' | 'plasma';

export interface Molecule {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  trail: { x: number; y: number }[];
}
