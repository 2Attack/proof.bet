"use client";

// ============================================================
// proof.bet — spring physics (no linear tweens, ever)
// A tiny rAF spring integrator + React hooks.
// Ported 1:1 from design/project/src/motion.jsx (visual layer only).
// ============================================================

import { useState, useEffect, useRef } from "react";

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

interface SpringState {
  x: number;
  v: number;
}

// physical spring step (semi-implicit Euler)
function springStep(
  state: SpringState,
  target: number,
  cfg: SpringConfig,
  dt: number
): SpringState {
  const { stiffness, damping, mass } = cfg;
  const fSpring = -stiffness * (state.x - target);
  const fDamp = -damping * state.v;
  const a = (fSpring + fDamp) / mass;
  const v = state.v + a * dt;
  const x = state.x + v * dt;
  return { x, v };
}

export const SPRING = {
  gentle: { stiffness: 90, damping: 18, mass: 1 },
  default: { stiffness: 170, damping: 22, mass: 1 },
  snappy: { stiffness: 260, damping: 26, mass: 1 },
  climb: { stiffness: 38, damping: 14, mass: 1.1 }, // the money-shot
  slow: { stiffness: 22, damping: 12, mass: 1.3 },
} satisfies Record<string, SpringConfig>;

export type SpringName = keyof typeof SPRING;

function resolveCfg(cfg: SpringName | SpringConfig): SpringConfig {
  return typeof cfg === "string" ? SPRING[cfg] ?? SPRING.default : cfg;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface SpringValueOpts {
  from?: number;
  onRest?: () => void;
}

// Animate a numeric value toward `target` with spring physics.
// Returns the live value. onRest fires once when settled.
export function useSpringValue(
  target: number,
  cfgName: SpringName | SpringConfig = "default",
  opts: SpringValueOpts = {}
): number {
  const cfg = resolveCfg(cfgName);
  const fromInit = opts.from != null ? opts.from : target;
  const [val, setVal] = useState(fromInit);
  const state = useRef<SpringState>({ x: fromInit, v: 0 });
  const raf = useRef(0);
  const last = useRef(0);
  const restedRef = useRef(false);
  const onRestRef = useRef(opts.onRest);
  onRestRef.current = opts.onRest;

  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = prefersReducedMotion();
  }, []);

  useEffect(() => {
    if (reduce.current) {
      state.current = { x: target, v: 0 };
      setVal(target);
      onRestRef.current?.();
      return;
    }
    restedRef.current = false;
    cancelAnimationFrame(raf.current);
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last.current) / 1000, 0.032);
      last.current = now;
      // sub-step for stability
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        state.current = springStep(state.current, target, cfg, dt / steps);
      }
      setVal(state.current.x);
      const settled =
        Math.abs(state.current.x - target) < 0.0006 * (Math.abs(target) || 1) &&
        Math.abs(state.current.v) < 0.0008 * (Math.abs(target) || 1);
      if (settled) {
        state.current.x = target;
        state.current.v = 0;
        setVal(target);
        if (!restedRef.current) {
          restedRef.current = true;
          onRestRef.current?.();
        }
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, cfgName]);

  return val;
}

// One-shot spring "tween" used to drive the climbing result number.
// Plays from `from`→`to` when `play` flips true. Reports [value, done].
export function useClimb(
  from: number,
  to: number,
  play: boolean,
  cfgName: SpringName | SpringConfig = "climb"
): [number, boolean] {
  const cfg = typeof cfgName === "object" ? cfgName : SPRING[cfgName] ?? SPRING.climb;
  const [val, setVal] = useState(from);
  const [done, setDone] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!play) {
      setVal(from);
      setDone(false);
      return;
    }
    if (prefersReducedMotion()) {
      setVal(to);
      setDone(true);
      return;
    }
    let st: SpringState = { x: from, v: 0 };
    let last = performance.now();
    setDone(false);
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      for (let i = 0; i < 3; i++) st = springStep(st, to, cfg, dt / 3);
      setVal(st.x);
      const settled = Math.abs(st.x - to) < 0.002 && Math.abs(st.v) < 0.01;
      if (settled) {
        setVal(to);
        setDone(true);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, from, to]);

  return [val, done];
}
