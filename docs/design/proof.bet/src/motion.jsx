// ============================================================
// HOUSEPROOF — spring physics (no linear tweens, ever)
// A tiny rAF spring integrator + React hooks.
// ============================================================
const { useState, useEffect, useRef, useCallback } = React;

// physical spring step (semi-implicit Euler)
function springStep(state, target, cfg, dt) {
  const { stiffness, damping, mass } = cfg;
  const fSpring = -stiffness * (state.x - target);
  const fDamp = -damping * state.v;
  const a = (fSpring + fDamp) / mass;
  const v = state.v + a * dt;
  const x = state.x + v * dt;
  return { x, v };
}

const SPRING = {
  gentle:  { stiffness: 90,  damping: 18, mass: 1 },
  default: { stiffness: 170, damping: 22, mass: 1 },
  snappy:  { stiffness: 260, damping: 26, mass: 1 },
  climb:   { stiffness: 38,  damping: 14, mass: 1.1 }, // the money-shot
  slow:    { stiffness: 22,  damping: 12, mass: 1.3 },
};

// Animate a numeric value toward `target` with spring physics.
// Returns the live value. onRest fires once when settled.
function useSpringValue(target, cfgName = 'default', opts = {}) {
  const cfg = typeof cfgName === 'string' ? (SPRING[cfgName] || SPRING.default) : cfgName;
  const [val, setVal] = useState(opts.from != null ? opts.from : target);
  const state = useRef({ x: opts.from != null ? opts.from : target, v: 0 });
  const raf = useRef(0);
  const last = useRef(0);
  const restedRef = useRef(false);
  const onRest = opts.onRest;

  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (reduce.current) {
      state.current = { x: target, v: 0 };
      setVal(target);
      if (onRest) onRest();
      return;
    }
    restedRef.current = false;
    cancelAnimationFrame(raf.current);
    last.current = performance.now();
    const tick = (now) => {
      let dt = Math.min((now - last.current) / 1000, 0.032);
      last.current = now;
      // sub-step for stability
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        state.current = springStep(state.current, target, cfg, dt / steps);
      }
      setVal(state.current.x);
      const settled = Math.abs(state.current.x - target) < 0.0006 * (Math.abs(target) || 1) &&
                      Math.abs(state.current.v) < 0.0008 * (Math.abs(target) || 1);
      if (settled) {
        state.current.x = target; state.current.v = 0;
        setVal(target);
        if (!restedRef.current && onRest) { restedRef.current = true; onRest(); }
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  // eslint-disable-next-line
  }, [target, cfgName]);

  return val;
}

// One-shot spring "tween" used to drive the climbing result number.
// Plays from `from`→`to` when `play` flips true. Reports value + done.
function useClimb(from, to, play, cfgName = 'climb') {
  const cfg = typeof cfgName === 'object' ? cfgName : (SPRING[cfgName] || SPRING.climb);
  const [val, setVal] = useState(from);
  const [done, setDone] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!play) { setVal(from); setDone(false); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(to); setDone(true); return; }
    let st = { x: from, v: 0 };
    let last = performance.now();
    setDone(false);
    const tick = (now) => {
      let dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      for (let i = 0; i < 3; i++) st = springStep(st, to, cfg, dt / 3);
      setVal(st.x);
      const settled = Math.abs(st.x - to) < 0.002 && Math.abs(st.v) < 0.01;
      if (settled) { setVal(to); setDone(true); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  // eslint-disable-next-line
  }, [play, from, to]);

  return [val, done];
}

Object.assign(window, { useSpringValue, useClimb, SPRING });
