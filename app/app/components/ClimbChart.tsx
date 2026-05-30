"use client";

// ============================================================
// proof.bet — Limbo climb chart (the play field)
// SVG rocket curve with dynamic vmax, live sample trail, gridlines,
// dashed target line, glowing tip. Ported verbatim from limbo.jsx.
// Shared by the Limbo screen and the marketing LandingDemo.
// ============================================================

import { useEffect, useRef } from "react";

const fmt = (n: number, d = 2): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

interface Sample {
  t: number;
  v: number;
}
interface ChartPaths {
  line: string;
  area: string;
  tip?: [number, number];
}

// linear y so a single round's curve reads like a rocket; vmax dynamic per round.
const vmaxFor = (target: number, crash: number) =>
  Math.max(1.5, Math.max(target || 1, crash || 1) * 1.32);
const yFrac = (v: number, vmax: number) =>
  Math.max(0, Math.min(1, (v - 1) / (vmax - 1)));

// synth a smooth ease-out curve 1→crash (used when rAF is throttled / settled cold)
function synthSamples(crash: number, n = 46): Sample[] {
  const arr: Sample[] = [];
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const e = 1 - Math.pow(1 - p, 2.6);
    arr.push({ t: p, v: 1 + (crash - 1) * e });
  }
  return arr;
}

function buildPaths(samples: Sample[], vmax: number): ChartPaths {
  if (!samples.length) return { line: "", area: "" };
  const totalT = samples[samples.length - 1].t || 1;
  const pts = samples.map((s) => {
    const x = (s.t / totalT) * 100;
    const y = 100 - yFrac(s.v, vmax) * 100;
    return [x, y] as [number, number];
  });
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(" ");
  const last = pts[pts.length - 1];
  const area =
    `M${pts[0][0].toFixed(2)} 100 ` +
    pts.map((p) => `L${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ") +
    ` L${last[0].toFixed(2)} 100 Z`;
  return { line, area, tip: last };
}

export interface ClimbChartProps {
  playing: boolean;
  settled: boolean;
  val: number;
  target: number;
  crash: number;
  win: boolean;
}

export function ClimbChart({ playing, settled, val, target, crash, win }: ClimbChartProps) {
  const samplesRef = useRef<Sample[]>([]);
  const startRef = useRef(0);

  // reset sample trail at the start of each reveal
  useEffect(() => {
    if (playing) {
      samplesRef.current = [];
      startRef.current = performance.now();
    }
  }, [playing]);

  const vmax = vmaxFor(target, settled ? crash : Math.max(target, crash || 1));

  // collect live samples during the climb
  if (playing) {
    const t = (performance.now() - startRef.current) / 1000;
    const arr = samplesRef.current;
    if (!arr.length || t - arr[arr.length - 1].t > 0.012) arr.push({ t, v: val });
    if (arr.length > 360) arr.shift();
  }

  let samples = samplesRef.current;
  if (settled && samples.length < 8) samples = synthSamples(crash);
  if (settled && samples.length >= 8)
    samples = [...samples, { t: samples[samples.length - 1].t + 0.001, v: crash }];

  const { line, area, tip } = buildPaths(samples, vmax);
  const tgtY = 100 - yFrac(target, vmax) * 100;
  const beat = (playing && val >= target) || (settled && win);
  const stroke = beat ? "var(--acc)" : settled ? "var(--loss)" : "var(--ink-mut)";

  // multiplier gridlines
  const grid = [0.25, 0.5, 0.75].map((f) => ({
    y: 100 - f * 100,
    v: 1 + f * (vmax - 1),
  }));

  return (
    <div className="stage-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="climb-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={beat ? "rgba(95,227,192,0.22)" : "rgba(154,157,164,0.10)"}
            />
            <stop offset="100%" stopColor="rgba(95,227,192,0)" />
          </linearGradient>
        </defs>
        {grid.map((g, i) => (
          <line
            key={i}
            x1="0"
            x2="100"
            y1={g.y}
            y2={g.y}
            stroke="var(--line)"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* target line */}
        <line
          x1="0"
          x2="100"
          y1={tgtY}
          y2={tgtY}
          stroke={beat ? "var(--acc-line)" : "var(--line-3)"}
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        {(playing || settled) && (
          <>
            <path d={area} fill="url(#climb-fill)" />
            <path
              d={line}
              fill="none"
              stroke={stroke}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {/* gridline value labels (HTML overlay, crisp) */}
      <div className="chart-labels">
        {grid.map((g, i) => (
          <span key={i} className="chart-label mono" style={{ top: `${g.y}%` }}>
            {fmt(g.v, g.v < 10 ? 2 : 0)}×
          </span>
        ))}
      </div>
      {/* target flag */}
      <div className={`chart-target${beat ? " beat" : ""}`} style={{ top: `${tgtY}%` }}>
        <span className="mono">target {fmt(target)}×</span>
      </div>
      {/* glowing tip */}
      {(playing || settled) && tip && (
        <div
          className={`chart-tip${beat ? " beat" : ""}${settled ? " settled" : ""}`}
          style={{ left: `${tip[0]}%`, top: `${tip[1]}%` }}
        />
      )}
    </div>
  );
}
