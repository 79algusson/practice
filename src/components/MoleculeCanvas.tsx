import { useEffect, useRef } from 'react';
import type { Molecule, MatterState } from '../types/index';

interface Props {
  molecules: Molecule[];
  state: MatterState;
  width: number;
  height: number;
  containerScale?: number;
}

export default function MoleculeCanvas({
  molecules,
  state,
  width,
  height,
  containerScale = 1.0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // 1. Background grid
    ctx.strokeStyle = 'rgba(0,200,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // 2. Compressed container
    if (containerScale < 0.95) {
      const cw = width * containerScale;
      const ch = height * containerScale;
      const cx = (width - cw) / 2;
      const cy = (height - ch) / 2;
      ctx.strokeStyle = '#ff7b00';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, ch);
      ctx.setLineDash([]);
    }

    // 3. Trails (gas/plasma only)
    if (state === 'gas' || state === 'plasma') {
      for (const mol of molecules) {
        for (let i = 0; i < mol.trail.length; i++) {
          const alpha = (1 - i / mol.trail.length) * 0.3;
          ctx.beginPath();
          ctx.arc(mol.trail[i].x, mol.trail[i].y, mol.radius * (1 - i / mol.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = mol.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();
        }
      }
    }

    // 4. Bonds (solid state)
    if (state === 'solid') {
      ctx.lineWidth = 1;
      for (let i = 0; i < molecules.length; i++) {
        for (let j = i + 1; j < molecules.length; j++) {
          const dx = molecules[i].x - molecules[j].x;
          const dy = molecules[i].y - molecules[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 40) {
            ctx.strokeStyle = `rgba(122,184,212,${0.3 * (1 - dist / 40)})`;
            ctx.beginPath();
            ctx.moveTo(molecules[i].x, molecules[i].y);
            ctx.lineTo(molecules[j].x, molecules[j].y);
            ctx.stroke();
          }
        }
      }
    }

    // 5. Molecule cores
    for (const mol of molecules) {
      const grad = ctx.createRadialGradient(mol.x, mol.y, 0, mol.x, mol.y, mol.radius);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, mol.color);
      ctx.beginPath();
      ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 6. State label
    const stateLabel: Record<MatterState, string> = {
      solid: 'SOLID',
      liquid: 'LIQUID',
      gas: 'GAS',
      plasma: 'PLASMA',
    };
    ctx.font = '13px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(0,200,255,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(stateLabel[state], width - 10, height - 10);
  }, [molecules, state, width, height, containerScale]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', borderRadius: 8 }}
    />
  );
}
