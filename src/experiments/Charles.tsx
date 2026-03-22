import { useState, useEffect, useRef, useCallback } from 'react';
import type { Molecule } from '../types/index';
import {
  createMoleculesInCircle,
  updateMoleculesInBalloon,
  getSpeedForTemp,
  calculateCharlesVolume,
} from '../utils/physics';
import MoleculeCanvas from '../components/MoleculeCanvas';
import GeminiVisualizer from '../components/GeminiVisualizer';
import styles from './Charles.module.css';

const INITIAL_TEMP_K = 273;
const INITIAL_VOLUME = 10;
const MOLECULE_COUNT = 10;
const CANVAS_W = 480;
const CANVAS_H = 400;
const BALLOON_CX = CANVAS_W / 2;
const BALLOON_CY = CANVAS_H / 2;
const BALLOON_BASE_RADIUS = 100; // px at INITIAL_TEMP_K
const MOLECULE_COLOR = '#00ff9d';

const TABLE_TEMPS = [100, 150, 200, 273, 350, 450, 600, 800];

interface CollisionFlash { x: number; y: number; age: number; }

interface Props {
  onRequestApiKey: () => void;
}

export default function CharlesExperiment({ onRequestApiKey }: Props) {
  const [tempK, setTempK] = useState(INITIAL_TEMP_K);

  const balloonRadius = BALLOON_BASE_RADIUS * Math.sqrt(tempK / INITIAL_TEMP_K);
  const volume = calculateCharlesVolume(INITIAL_VOLUME, INITIAL_TEMP_K, tempK);
  const vOverT = volume / tempK;
  const tempC = tempK - 273;

  const targetSpeed = getSpeedForTemp(tempC);

  // Refs so animate never needs to be re-created
  const balloonRadiusRef = useRef(balloonRadius);
  const targetSpeedRef = useRef(targetSpeed);
  balloonRadiusRef.current = balloonRadius;
  targetSpeedRef.current = targetSpeed;

  // Molecule state via ref + state
  const moleculesRef = useRef<Molecule[]>(
    createMoleculesInCircle(MOLECULE_COUNT, BALLOON_CX, BALLOON_CY, BALLOON_BASE_RADIUS, MOLECULE_COLOR),
  );
  const [molecules, setMolecules] = useState<Molecule[]>(moleculesRef.current);

  // Collision flash
  const collisionFlashesRef = useRef<CollisionFlash[]>([]);
  const [collisionFlashes, setCollisionFlashes] = useState<CollisionFlash[]>([]);

  // Collision count tracking (rolling 60-frame window ≈ 1 s)
  const collisionHistoryRef = useRef<number[]>([]);
  const [collisionsPerSec, setCollisionsPerSec] = useState(0);

  // Pressure (instantaneous)
  const impulseHistoryRef = useRef<number[]>([]);
  const [instantPressure, setInstantPressure] = useState(1.0);

  const rafRef = useRef<number | null>(null);

  const animate = useCallback(() => {
    const { molecules: next, wallCollisions, collisionPoints } = updateMoleculesInBalloon(
      moleculesRef.current,
      BALLOON_CX,
      BALLOON_CY,
      balloonRadiusRef.current,
      targetSpeedRef.current,
    );
    moleculesRef.current = next;
    setMolecules(next);

    // Collision flashes
    collisionFlashesRef.current = [
      ...collisionFlashesRef.current
        .map(f => ({ ...f, age: f.age + 0.13 }))
        .filter(f => f.age < 1),
      ...collisionPoints.map(p => ({ ...p, age: 0 })),
    ];
    setCollisionFlashes([...collisionFlashesRef.current]);

    // Collision count per second
    const hist = collisionHistoryRef.current;
    hist.push(wallCollisions);
    if (hist.length > 60) hist.shift();
    setCollisionsPerSec(hist.reduce((a, b) => a + b, 0));

    // Instantaneous pressure
    const ihist = impulseHistoryRef.current;
    ihist.push(wallCollisions);
    if (ihist.length > 60) ihist.shift();
    if (ihist.length >= 10) {
      const long = ihist.reduce((a, b) => a + b, 0) / ihist.length;
      const short = ihist.slice(-6).reduce((a, b) => a + b, 0) / 6;
      if (long > 0) setInstantPressure(short / long);
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [animate]);

  const sliderPct = ((tempK - 100) / (800 - 100)) * 100;

  const badgeClass =
    tempK > INITIAL_TEMP_K + 30 ? styles.badgeHot
    : tempK < INITIAL_TEMP_K - 30 ? styles.badgeCold
    : styles.badgeNeutral;

  const badgeText =
    tempK > INITIAL_TEMP_K + 30 ? '가열 — 팽창'
    : tempK < INITIAL_TEMP_K - 30 ? '냉각 — 수축'
    : '기준 상태';

  const geminiPrompt = `Scientific visualization of Charles's Law: gas in a balloon at ${tempK}K (${tempC}°C). Volume is ${volume.toFixed(2)}L. Show ${tempK > 400 ? 'large expanded' : tempK < 200 ? 'small contracted' : 'normal'} balloon. Style: educational physics, dark background, green glowing particles.`;

  // SVG graph helpers
  const minT = 100; const maxT = 800;
  const minV = calculateCharlesVolume(INITIAL_VOLUME, INITIAL_TEMP_K, minT);
  const maxV = calculateCharlesVolume(INITIAL_VOLUME, INITIAL_TEMP_K, maxT);
  const svgW = 300; const svgH = 160;
  const pad = { l: 40, r: 10, t: 10, b: 30 };
  const plotW = svgW - pad.l - pad.r;
  const plotH = svgH - pad.t - pad.b;

  function toPx(t: number, v: number) {
    const px = pad.l + ((t - minT) / (maxT - minT)) * plotW;
    const py = pad.t + plotH - ((v - minV) / (maxV - minV)) * plotH;
    return { px, py };
  }

  const linePoints = [minT, maxT].map(t => {
    const v = calculateCharlesVolume(INITIAL_VOLUME, INITIAL_TEMP_K, t);
    const { px, py } = toPx(t, v);
    return `${px},${py}`;
  }).join(' ');

  const { px: dotX, py: dotY } = toPx(tempK, volume);

  // Theoretical collision rate (constant in Charles's Law)
  // For display in table; all rows show similar values to demonstrate constant pressure
  function theoreticalCollisions(t: number): number {
    const s = getSpeedForTemp(t - 273);
    const r = BALLOON_BASE_RADIUS * Math.sqrt(t / INITIAL_TEMP_K);
    // expected collisions per frame ≈ N * s / (π * r), ×60 for per-second estimate
    return Math.round(MOLECULE_COUNT * s / (Math.PI * r) * 60);
  }

  return (
    <div className={styles.layout}>
      {/* ── Left control panel ── */}
      <aside className={styles.controlPanel}>
        {/* Temperature slider */}
        <div className={styles.sliderSection}>
          <div className={styles.sliderLabel}>
            <span className={styles.sliderTitle}>온도 (조작 변인)</span>
            <span className={styles.sliderValue}>{tempK} K</span>
          </div>
          <div className={styles.sliderCelsius}>{tempC}°C</div>
          <input
            type="range"
            min={100}
            max={800}
            step={5}
            value={tempK}
            onChange={(e) => setTempK(Number(e.target.value))}
            className={styles.slider}
            style={{ '--slider-pct': `${sliderPct}%` } as React.CSSProperties}
          />
        </div>

        {/* Result cards */}
        <div className={styles.cardGrid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>부피 (결과 변인)</div>
            <div className={styles.cardValue} style={{ color: 'var(--accent-green)' }}>
              {volume.toFixed(2)} L
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>V/T (일정값)</div>
            <div className={styles.cardValue} style={{ color: 'var(--accent-cyan)' }}>
              {vOverT.toFixed(4)}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>충돌 횟수/초</div>
            <div className={styles.cardValue} style={{ color: 'var(--accent-orange)' }}>
              {collisionsPerSec}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>압력 (통제 변인)</div>
            <div className={styles.cardValue} style={{ color: 'var(--text-dim)' }}>1 atm</div>
            <div className={styles.cardNote}>고정</div>
          </div>
        </div>

        {/* Formula box */}
        <div className={styles.formulaBox}>
          <div className={styles.formulaMain}>V₁/T₁ = V₂/T₂</div>
          <div className={styles.formulaCalc}>
            {INITIAL_VOLUME}/{INITIAL_TEMP_K} = {volume.toFixed(2)}/{tempK}
            <br />
            {(INITIAL_VOLUME / INITIAL_TEMP_K).toFixed(4)} ≈ {(volume / tempK).toFixed(4)}
          </div>
          <p className={styles.formulaDesc}>
            압력이 일정할 때, 기체의 부피는{' '}
            <span className={styles.formulaHighlight}>절대온도(K)</span>에 비례한다.
          </p>
        </div>

        {/* Data table */}
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>온도 (K)</th>
              <th>부피 (L)</th>
              <th>V/T</th>
              <th>충돌 (회/초)</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_TEMPS.map((t) => {
              const v = calculateCharlesVolume(INITIAL_VOLUME, INITIAL_TEMP_K, t);
              const active = Math.abs(t - tempK) <= 30;
              const collEst = theoreticalCollisions(t);
              return (
                <tr key={t} className={active ? styles.tableRowActive : undefined}>
                  <td>{t}</td>
                  <td>{v.toFixed(2)}</td>
                  <td>{(v / t).toFixed(4)}</td>
                  <td>{active ? collisionsPerSec : `~${collEst}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Gemini visualizer */}
        <GeminiVisualizer
          prompt={geminiPrompt}
          label="AI 실험 시각화 (Gemini)"
          onRequestApiKey={onRequestApiKey}
        />
      </aside>

      {/* ── Right simulation panel ── */}
      <section className={styles.simPanel}>
        <div className={styles.simHeader}>
          <h3 className={styles.simTitle}>풍선 팽창/수축 시뮬레이션</h3>
          <span className={`${styles.badge} ${badgeClass}`}>{badgeText}</span>
        </div>

        <div className={styles.canvasWrapper}>
          <MoleculeCanvas
            molecules={molecules}
            state="gas"
            width={CANVAS_W}
            height={CANVAS_H}
            balloonRadius={balloonRadius}
            balloonCx={BALLOON_CX}
            balloonCy={BALLOON_CY}
            collisionFlashes={collisionFlashes}
            pressure={instantPressure}
          />
        </div>

        {/* V-T Graph */}
        <div className={styles.graphWrapper}>
          <div className={styles.graphTitle}>V-T 그래프 (등압 과정)</div>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className={styles.graph}>
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + plotH} stroke="rgba(0,200,255,0.3)" strokeWidth={1} />
            <line x1={pad.l} y1={pad.t + plotH} x2={pad.l + plotW} y2={pad.t + plotH} stroke="rgba(0,200,255,0.3)" strokeWidth={1} />
            {[200, 400, 600, 800].map((t) => {
              const gx = pad.l + ((t - minT) / (maxT - minT)) * plotW;
              return (
                <g key={t}>
                  <line x1={gx} y1={pad.t} x2={gx} y2={pad.t + plotH} stroke="rgba(0,200,255,0.07)" strokeWidth={1} />
                  <text x={gx} y={pad.t + plotH + 16} textAnchor="middle" fill="rgba(0,200,255,0.5)" fontSize={9} fontFamily="Space Mono">{t}K</text>
                </g>
              );
            })}
            {[minV, (minV + maxV) / 2, maxV].map((v) => {
              const gy = pad.t + plotH - ((v - minV) / (maxV - minV)) * plotH;
              return (
                <text key={v} x={pad.l - 4} y={gy + 4} textAnchor="end" fill="rgba(0,200,255,0.5)" fontSize={9} fontFamily="Space Mono">{v.toFixed(1)}</text>
              );
            })}
            <text x={pad.l + plotW / 2} y={svgH} textAnchor="middle" fill="rgba(0,200,255,0.5)" fontSize={9} fontFamily="Space Mono">온도 (K)</text>
            <text x={10} y={pad.t + plotH / 2} textAnchor="middle" fill="rgba(0,200,255,0.5)" fontSize={9} fontFamily="Space Mono" transform={`rotate(-90, 10, ${pad.t + plotH / 2})`}>부피 (L)</text>
            <polyline points={linePoints} fill="none" stroke="var(--accent-green)" strokeWidth={2} opacity={0.7} />
            <circle cx={dotX} cy={dotY} r={10} fill="none" stroke="var(--accent-orange)" strokeWidth={1.5} opacity={0.5} />
            <circle cx={dotX} cy={dotY} r={5} fill="var(--accent-orange)" />
          </svg>
        </div>

        {/* Absolute zero info */}
        <div className={styles.absZeroBox}>
          <div className={styles.absZeroTitle}>충돌 횟수와 압력의 관계</div>
          온도가 올라가면 입자 속도가 빨라지지만 풍선도 커진다. 두 효과가 상쇄되어{' '}
          <span className={styles.absZeroHighlight}>벽면 충돌 횟수(= 압력)는 일정</span>하게 유지된다.
          이것이 샤를의 법칙이 등압(等壓) 과정인 이유다.
        </div>
      </section>
    </div>
  );
}
