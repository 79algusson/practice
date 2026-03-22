import { useEffect, useRef } from 'react';
import type { Molecule, MatterState } from '../types/index';

interface CollisionFlash {
  x: number;
  y: number;
  age: number; // 0 = new, 1 = gone
}

interface Props {
  molecules: Molecule[];
  state: MatterState;
  width: number;
  height: number;
  // Balloon mode
  balloonRadius?: number;
  balloonCx?: number;
  balloonCy?: number;
  collisionFlashes?: CollisionFlash[];
  pressure?: number;
  // Legacy rectangular mode
  containerScale?: number;
}

export default function MoleculeCanvas({
  molecules,
  state,
  width,
  height,
  balloonRadius,
  balloonCx,
  balloonCy,
  collisionFlashes = [],
  pressure = 1.0,
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

    if (balloonRadius && balloonCx !== undefined && balloonCy !== undefined) {
      // ── Balloon mode ──
      const cx = balloonCx;
      const cy = balloonCy;
      const r = balloonRadius;

      // Balloon fill
      const fillGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      fillGrad.addColorStop(0, 'rgba(0, 255, 157, 0.13)');
      fillGrad.addColorStop(0.65, 'rgba(0, 255, 157, 0.06)');
      fillGrad.addColorStop(1, 'rgba(0, 255, 157, 0.01)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Balloon border glow
      ctx.save();
      ctx.shadowColor = '#00ff9d';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(0, 255, 157, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Sheen highlight
      const shineGrad = ctx.createRadialGradient(
        cx - r * 0.38, cy - r * 0.38, 0,
        cx - r * 0.38, cy - r * 0.38, r * 0.45,
      );
      shineGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
      shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = shineGrad;
      ctx.fill();

      // Collision flashes
      for (const flash of collisionFlashes) {
        const alpha = 1 - flash.age;
        const fr = 10 * flash.age;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, Math.max(1, fr), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 210, 60, ${alpha * 0.85})`;
        ctx.fill();
        // Spark lines
        ctx.strokeStyle = `rgba(255, 180, 30, ${alpha * 0.7})`;
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) {
          const sa = (i / 5) * Math.PI * 2;
          const len = 8 * flash.age;
          ctx.beginPath();
          ctx.moveTo(flash.x + Math.cos(sa) * fr, flash.y + Math.sin(sa) * fr);
          ctx.lineTo(flash.x + Math.cos(sa) * (fr + len), flash.y + Math.sin(sa) * (fr + len));
          ctx.stroke();
        }
      }

    } else {
      // ── Legacy rectangular mode ──
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
    }

    // 2. Molecule trails
    if (state === 'gas' || state === 'plasma') {
      for (const mol of molecules) {
        for (let i = 0; i < mol.trail.length; i++) {
          const alpha = (1 - i / mol.trail.length) * 0.28;
          ctx.beginPath();
          ctx.arc(mol.trail[i].x, mol.trail[i].y, mol.radius * (1 - i / mol.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = mol.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();
        }
      }
    }

    // 3. Molecule cores
    for (const mol of molecules) {
      const grad = ctx.createRadialGradient(mol.x, mol.y, 0, mol.x, mol.y, mol.radius);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, mol.color);
      ctx.beginPath();
      ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 4. Pressure gauge (top-left)
    {
      const gx = 54, gy = 54, gr = 42;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 10, 25, 0.88)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const startAngle = Math.PI * 0.75;
      const sweepAngle = Math.PI * 1.5;

      ctx.beginPath();
      ctx.arc(gx, gy, gr - 7, startAngle, startAngle + sweepAngle);
      ctx.strokeStyle = 'rgba(0,200,255,0.13)';
      ctx.lineWidth = 4;
      ctx.stroke();

      const clampedP = Math.max(0, Math.min(2, pressure));
      const fillAngle = startAngle + (clampedP / 2) * sweepAngle;
      const gColor = clampedP > 1.25 || clampedP < 0.75 ? '#ff3860' : clampedP > 1.1 || clampedP < 0.9 ? '#ffb347' : '#00ff9d';
      ctx.beginPath();
      ctx.arc(gx, gy, gr - 7, startAngle, fillAngle);
      ctx.strokeStyle = gColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      for (let i = 0; i <= 8; i++) {
        const frac = i / 8;
        const angle = startAngle + frac * sweepAngle;
        const isMajor = i % 2 === 0;
        ctx.beginPath();
        ctx.moveTo(gx + Math.cos(angle) * (gr - (isMajor ? 13 : 9)), gy + Math.sin(angle) * (gr - (isMajor ? 13 : 9)));
        ctx.lineTo(gx + Math.cos(angle) * (gr - 2), gy + Math.sin(angle) * (gr - 2));
        ctx.strokeStyle = isMajor ? 'rgba(0,200,255,0.65)' : 'rgba(0,200,255,0.28)';
        ctx.lineWidth = isMajor ? 1.5 : 1;
        ctx.stroke();
      }

      const refAngle = startAngle + 0.5 * sweepAngle;
      ctx.beginPath();
      ctx.moveTo(gx + Math.cos(refAngle) * (gr - 15), gy + Math.sin(refAngle) * (gr - 15));
      ctx.lineTo(gx + Math.cos(refAngle) * (gr - 2), gy + Math.sin(refAngle) * (gr - 2));
      ctx.strokeStyle = '#00ff9d';
      ctx.lineWidth = 2;
      ctx.stroke();

      const needleAngle = startAngle + (clampedP / 2) * sweepAngle;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(needleAngle);
      ctx.beginPath();
      ctx.moveTo(0, 2.5);
      ctx.lineTo(gr - 13, 0);
      ctx.lineTo(0, -2.5);
      ctx.closePath();
      ctx.fillStyle = gColor;
      ctx.shadowColor = gColor;
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(gx, gy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      ctx.font = 'bold 6.5px "Space Mono", monospace';
      ctx.fillStyle = 'rgba(0,200,255,0.65)';
      ctx.textAlign = 'center';
      ctx.fillText('PRESSURE', gx, gy + gr - 11);
      ctx.font = 'bold 9px "Space Mono", monospace';
      ctx.fillStyle = gColor;
      ctx.fillText(clampedP.toFixed(2) + ' atm', gx, gy + 14);
    }

    // 5. State label
    ctx.font = '12px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(0,200,255,0.55)';
    ctx.textAlign = 'right';
    ctx.fillText('GAS', width - 10, height - 10);
  }, [molecules, state, width, height, balloonRadius, balloonCx, balloonCy, collisionFlashes, pressure, containerScale]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', borderRadius: 8 }}
    />
  );
}
