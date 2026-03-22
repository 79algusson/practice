import type { MatterState, Molecule } from '../types/index';

export function getMatterState(tempC: number, substance: string): MatterState {
  if (substance === 'water') {
    if (tempC < 0) return 'solid';
    if (tempC <= 100) return 'liquid';
    return 'gas';
  }
  if (substance === 'nitrogen') {
    if (tempC < -210) return 'solid';
    if (tempC <= -196) return 'liquid';
    return 'gas';
  }
  if (substance === 'co2') {
    if (tempC < -78) return 'solid';
    if (tempC <= -57) return 'liquid';
    return 'gas';
  }
  return 'gas';
}

export function getStateColor(state: MatterState): string {
  switch (state) {
    case 'solid': return '#7ab8d4';
    case 'liquid': return '#00c8ff';
    case 'gas': return '#00ff9d';
    case 'plasma': return '#b347ff';
  }
}

export function createMolecules(
  count: number,
  width: number,
  height: number,
  state: MatterState,
  color: string,
): Molecule[] {
  const speedMap: Record<MatterState, number> = {
    solid: 0.3,
    liquid: 1.5,
    gas: 4.0,
    plasma: 8.0,
  };
  const baseSpeed = speedMap[state];

  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = baseSpeed * (0.7 + Math.random() * 0.6);
    return {
      id: i,
      x: Math.random() * (width - 20) + 10,
      y: Math.random() * (height - 20) + 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 5 + Math.random() * 2,
      color,
      trail: [],
    };
  });
}

export function updateMolecules(
  molecules: Molecule[],
  width: number,
  height: number,
  state: MatterState,
  targetSpeed: number,
): Molecule[] {
  return molecules.map((mol) => {
    let { x, y, vx, vy, trail } = mol;

    const currentSpeed = Math.sqrt(vx * vx + vy * vy);
    if (currentSpeed > 0) {
      const factor = 1 + (targetSpeed - currentSpeed) / currentSpeed * 0.05;
      vx *= factor;
      vy *= factor;
    } else {
      const angle = Math.random() * Math.PI * 2;
      vx = Math.cos(angle) * targetSpeed;
      vy = Math.sin(angle) * targetSpeed;
    }

    if (state === 'solid') {
      vx *= 0.98;
      vy *= 0.98;
      const maxDisp = 3;
      if (Math.abs(vx) > maxDisp) vx = Math.sign(vx) * maxDisp;
      if (Math.abs(vy) > maxDisp) vy = Math.sign(vy) * maxDisp;
    }

    x += vx;
    y += vy;

    if (x - mol.radius < 0) { x = mol.radius; vx = Math.abs(vx); }
    if (x + mol.radius > width) { x = width - mol.radius; vx = -Math.abs(vx); }
    if (y - mol.radius < 0) { y = mol.radius; vy = Math.abs(vy); }
    if (y + mol.radius > height) { y = height - mol.radius; vy = -Math.abs(vy); }

    if (state === 'gas' || state === 'plasma') {
      trail = [{ x, y }, ...trail.slice(0, 5)];
    } else {
      trail = [];
    }

    return { ...mol, x, y, vx, vy, trail };
  });
}

export function getSpeedForTemp(tempC: number): number {
  return Math.sqrt((tempC + 273.15) / 300) * 2.5;
}

export function calculateCharlesVolume(
  initialVolume: number,
  initialTempK: number,
  newTempK: number,
): number {
  return initialVolume * newTempK / initialTempK;
}
