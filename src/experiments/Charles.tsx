import { useState, useEffect, useRef, useCallback } from 'react';
import type { Molecule } from '../types/index';
import {
  createMolecules,
  updateMolecules,
  getSpeedForTemp,
  calculateCharlesVolume,
} from '../utils/physics';
import MoleculeCanvas from '../components/MoleculeCanvas';
import GeminiVisualizer from '../components/GeminiVisualizer';
import styles from './Charles.module.css';

const INITIAL_TEMP_K = 273;
const INITIAL_VOLUME = 10;
const MOLECULE_COUNT = 22;
const CANVAS_W = 480;
const CANVAS_H = 320;
const MOLECULE_COLOR = '#00ff9d';

const TABLE_TEMPS = [100, 150, 200, 273, 350, 450, 600, 800];

interface Props {
  onRequestApiKey: () => void;
}

export default function CharlesExperiment({ onRequestApiKey }: Props) {
  const [tempK, setTempK] = useState(INITIAL_TEMP_K);
  const [molecules, setMolecules] = useState<Molecule[]>(() =>
    createMolecules(MOLECULE_COUNT, CANVAS_W, CANVAS_H, 'gas', MOLECULE_COLOR),
  );
  const rafRef = useRef<number | null>(null);
  const moleculesRef = useRef<Molecule[]>(molecules);
  const impulseHistoryRef = useRef<number[]>([]);
  const [instantPressure, setInstantPressure] = useState(1.0);

  const tempC = tempK - 273;
  const volume = calculateCharlesVolume(INITIAL_VOLUME, INITIAL_TEMP_K, tempK);
  const vOverT = volume / tempK;
  const expansion = ((volume - INITIAL_VOLUME) / INITIAL_VOLUME) * 100;
  const containerScale = Math.sqrt(volume / INITIAL_VOLUME);

  const targetSpeed = getSpeedForTemp(tempC);

  const animate = useCallback(() => {
    const { molecules: next, wallImpulse } = updateMolecules(
      moleculesRef.current, CANVAS_W, CANVAS_H, 'gas', targetSpeed,
    );
    moleculesRef.current = next;
    setMolecules(next);

    const hist = impulseHistoryRef.current;
    hist.push(wallImpulse);
    if (hist.length > 60) hist.shift();

    if (hist.length >= 10) {
      const longAvg = hist.reduce((a, b) => a + b, 0) / hist.length;
      const shortAvg = hist.slice(-6).reduce((a, b) => a + b, 0) / 6;
      if (longAvg > 0) setInstantPressure(shortAvg / longAvg);
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [targetSpeed]);

  useEffect(() => {
    impulseHistoryRef.current = [];
    setInstantPressure(1.0);
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  const sliderPct = ((tempK - 100) / (800 - 100)) * 100;

  const badgeClass =
    tempK > INITIAL_TEMP_K + 30
      ? styles.badgeHot
      : tempK < INITIAL_TEMP_K - 30
      ? styles.badgeCold
      : styles.badgeNeutral;

  const badgeText =
    tempK > INITIAL_TEMP_K + 30
      ? '가열 — 팽창'
      : tempK < INITIAL_TEMP_K - 30
      ? '냉각 — 수축'
      : '기준 상태';

  const geminiPrompt = `Scientific visualization of Charles's Law: gas in a balloon at ${tempK}K (${tempC}°C). Volume is ${volume.toFixed(2)}L — ${expansion >= 0 ? `${expansion.toFixed(1)}% expanded from baseline` : `${Math.abs(expansion).toFixed(1)}% contracted from baseline`}. Show ${tempK > 400 ? 'large expanded' : tempK < 200 ? 'small contracted' : 'normal'} balloon. Include thermometer showing ${tempK}K. Style: educational physics, dark background, green glowing particles.`;

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

  const linePoints = [minT, maxT].map((t) => {
    const v = calculateCharlesVolume(INITIAL_VOLUME, INITIAL_TEMP_K, t);
    const { px, py } = toPx(t, v);
    return `${px},${py}`;
  }).join(' ');

  const { px: dotX, py: dotY } = toPx(tempK, volume);

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
            <div className={styles.cardTitle}>팽창률</div>
            <div className={styles.cardValue}>
              {expansion >= 0 ? '+' : ''}{expansion.toFixed(1)}%
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
            온도가 2배가 되면 부피도 2배가 된다.
          </p>
        </div>

        {/* Data table */}
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>온도 (K)</th>
              <th>부피 (L)</th>
              <th>V/T</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_TEMPS.map((t) => {
              const v = calculateCharlesVolume(INITIAL_VOLUME, INITIAL_TEMP_K, t);
              const active = Math.abs(t - tempK) <= 30;
              return (
                <tr key={t} className={active ? styles.tableRowActive : undefined}>
                  <td>{t}</td>
                  <td>{v.toFixed(2)}</td>
                  <td>{(v / t).toFixed(4)}</td>
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
          <h3 className={styles.simTitle}>기체 팽창/수축 시뮬레이션</h3>
          <span className={`${styles.badge} ${badgeClass}`}>{badgeText}</span>
        </div>

        <div className={styles.canvasWrapper}>
          <MoleculeCanvas
            molecules={molecules}
            state="gas"
            width={CANVAS_W}
            height={CANVAS_H}
            containerScale={containerScale}
            pressure={instantPressure}
          />
        </div>

        {/* V-T Graph */}
        <div className={styles.graphWrapper}>
          <div className={styles.graphTitle}>V-T 그래프 (등압 과정)</div>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className={styles.graph}>
            {/* Axes */}
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + plotH} stroke="rgba(0,200,255,0.3)" strokeWidth={1} />
            <line x1={pad.l} y1={pad.t + plotH} x2={pad.l + plotW} y2={pad.t + plotH} stroke="rgba(0,200,255,0.3)" strokeWidth={1} />

            {/* Grid */}
            {[200, 400, 600, 800].map((t) => {
              const gx = pad.l + ((t - minT) / (maxT - minT)) * plotW;
              return (
                <g key={t}>
                  <line x1={gx} y1={pad.t} x2={gx} y2={pad.t + plotH} stroke="rgba(0,200,255,0.07)" strokeWidth={1} />
                  <text x={gx} y={pad.t + plotH + 16} textAnchor="middle" fill="rgba(0,200,255,0.5)" fontSize={9} fontFamily="Space Mono">
                    {t}K
                  </text>
                </g>
              );
            })}

            {/* Volume axis labels */}
            {[minV, (minV + maxV) / 2, maxV].map((v) => {
              const gy = pad.t + plotH - ((v - minV) / (maxV - minV)) * plotH;
              return (
                <text key={v} x={pad.l - 4} y={gy + 4} textAnchor="end" fill="rgba(0,200,255,0.5)" fontSize={9} fontFamily="Space Mono">
                  {v.toFixed(1)}
                </text>
              );
            })}

            {/* Axis labels */}
            <text x={pad.l + plotW / 2} y={svgH} textAnchor="middle" fill="rgba(0,200,255,0.5)" fontSize={9} fontFamily="Space Mono">온도 (K)</text>
            <text x={10} y={pad.t + plotH / 2} textAnchor="middle" fill="rgba(0,200,255,0.5)" fontSize={9} fontFamily="Space Mono" transform={`rotate(-90, 10, ${pad.t + plotH / 2})`}>부피 (L)</text>

            {/* Trend line */}
            <polyline points={linePoints} fill="none" stroke="var(--accent-green)" strokeWidth={2} opacity={0.7} />

            {/* Current point */}
            <circle cx={dotX} cy={dotY} r={10} fill="none" stroke="var(--accent-orange)" strokeWidth={1.5} opacity={0.5} />
            <circle cx={dotX} cy={dotY} r={5} fill="var(--accent-orange)" />
          </svg>
        </div>

        {/* Absolute zero info */}
        <div className={styles.absZeroBox}>
          <div className={styles.absZeroTitle}>절대영도와 샤를의 법칙</div>
          샤를의 법칙 그래프를 0으로 외삽하면{' '}
          <span className={styles.absZeroHighlight}>-273.15°C (0 K)</span>에서 부피가 0이 된다.
          이것이 <span className={styles.absZeroHighlight}>절대영도</span>다.
          실제로는 기체가 그 전에 액체·고체로 상변이하지만, 이상 기체 모델에서 이 외삽은
          열역학적 온도의 영점을 정의한다.
        </div>
      </section>
    </div>
  );
}
