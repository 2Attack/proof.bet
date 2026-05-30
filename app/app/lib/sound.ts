// ============================================================
// proof.bet — sound engine (Web Audio, synthesized, no assets)
// Crisp marble-on-pin pegs, a soft release, and win/loss landings.
// Muted state persists; AudioContext unlocks on first gesture.
// Ported 1:1 from design/project/src/sound.jsx. SSR-safe.
// ============================================================

const KEY = "hp_sound_muted";
const VKEY = "hp_climb_voice";

type ClimbVoice = "velvet" | "glass";

interface ClimbState {
  oscs: { osc: OscillatorNode; mul: number }[];
  gain: GainNode;
  filt: BiquadFilterNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
  mode: ClimbVoice;
  baseFreq: number;
  span: number;
  filtBase: number;
  filtSpan: number;
}

interface VoiceOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  glideTo?: number | null;
  pan?: number;
}

interface NoiseOpts {
  gain?: number;
  freq?: number;
  q?: number;
  type?: BiquadFilterType;
  pan?: number;
}

export interface SoundEngine {
  readonly muted: boolean;
  readonly climbVoice: ClimbVoice;
  toggle(): boolean;
  unlock(): void;
  drop(): void;
  peg(rowIndex: number, rows: number, x?: number): void;
  land(win: boolean, multiplier?: number): void;
  ui(): void;
  setClimbVoice(v: string): void;
  limboStart(): void;
  limboTo(p: number): void;
  limboCross(): void;
  limboEnd(win: boolean, mult?: number): void;
  limboPreview(): void;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function readVoice(): ClimbVoice {
  try {
    return localStorage.getItem(VKEY) === "glass" ? "glass" : "velvet";
  } catch {
    return "velvet";
  }
}

function createEngine(): SoundEngine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let climb: ClimbState | null = null;
  let muted = readMuted();
  let climbVoice: ClimbVoice = readVoice();

  function ensure(): AudioContext | null {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  // a single enveloped oscillator voice
  function voice(freq: number, t0: number, dur: number, opts: VoiceOpts = {}) {
    const c = ctx!;
    const { type = "sine", gain = 0.2, attack = 0.004, glideTo = null, pan = 0 } = opts;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = g;
    if (c.createStereoPanner && pan) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      node = p;
    }
    o.connect(g);
    node.connect(master!);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // short filtered-noise transient (clicks, thuds)
  function noise(t0: number, dur: number, opts: NoiseOpts = {}) {
    const c = ctx!;
    const { gain = 0.15, freq = 1200, q = 0.7, type = "bandpass" } = opts;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master!);
    src.start(t0);
  }

  // stop the sustained limbo climb tone (fade out)
  function stopClimb(immediate: boolean) {
    if (!climb || !ctx) return;
    const t = ctx.currentTime;
    const { oscs, gain, lfo } = climb;
    const rel = immediate ? 0.04 : 0.6; // velvety release tail
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + rel);
      oscs.forEach(({ osc }) => osc.stop(t + rel + 0.05));
      if (lfo) lfo.stop(t + rel + 0.05);
    } catch {
      /* node already stopped */
    }
    climb = null;
  }

  const engine: SoundEngine = {
    get muted() {
      return muted;
    },
    get climbVoice() {
      return climbVoice;
    },

    toggle() {
      muted = !muted;
      try {
        localStorage.setItem(KEY, muted ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
      if (muted) stopClimb(true);
      else ensure();
      return muted;
    },

    unlock() {
      if (!muted) ensure();
    },

    // ball released
    drop() {
      if (muted || !ensure()) return;
      const t = ctx!.currentTime;
      voice(420, t, 0.12, { type: "sine", gain: 0.16, glideTo: 180 });
      noise(t, 0.06, { gain: 0.06, freq: 2600, q: 0.5, type: "highpass" });
    },

    // peg bounce — pitch climbs as the ball descends; pan follows x (0..1)
    peg(rowIndex, rows, x) {
      if (muted || !ensure()) return;
      const t = ctx!.currentTime;
      const prog = rows > 1 ? rowIndex / (rows - 1) : 0;
      const semis = Math.round(prog * 14) + (Math.random() < 0.5 ? 0 : 2);
      const freq = 320 * Math.pow(2, semis / 12) * (0.985 + Math.random() * 0.03);
      const pan = typeof x === "number" ? (x - 0.5) * 1.4 : 0;
      voice(freq, t, 0.07, { type: "triangle", gain: 0.12, attack: 0.002, pan });
      noise(t, 0.02, { gain: 0.04, freq: freq * 3, q: 1.2, pan });
    },

    // ball settled into a slot
    land(win, multiplier) {
      if (muted || !ensure()) return;
      const t = ctx!.currentTime;
      if (win) {
        const big = (multiplier || 1) >= 5;
        const root = big ? 523.25 : 392; // C5 vs G4
        const steps = big ? [0, 4, 7, 12] : [0, 4, 7];
        steps.forEach((s, i) => {
          voice(root * Math.pow(2, s / 12), t + i * 0.06, 0.5, {
            type: "triangle",
            gain: 0.14,
            attack: 0.006,
          });
        });
        noise(t, 0.04, { gain: 0.05, freq: 5000, q: 0.4, type: "highpass" });
      } else {
        voice(150, t, 0.34, { type: "sine", gain: 0.18, glideTo: 70 });
        noise(t, 0.12, { gain: 0.07, freq: 220, q: 0.6, type: "lowpass" });
      }
    },

    // small UI tick (risk / rows / buttons)
    ui() {
      if (muted || !ensure()) return;
      noise(ctx!.currentTime, 0.02, { gain: 0.05, freq: 2200, q: 1.0 });
    },

    // ---- Limbo (crash-style climb) ----
    setClimbVoice(v) {
      climbVoice = v === "glass" || v === "velvet" ? v : "velvet";
      try {
        localStorage.setItem(VKEY, climbVoice);
      } catch {
        /* storage unavailable */
      }
    },

    // start the rising swell — two velvety variants
    limboStart() {
      if (muted || !ensure()) {
        stopClimb(true);
        return;
      }
      stopClimb(true);
      const c = ctx!;
      const t = c.currentTime;
      const filt = c.createBiquadFilter();
      filt.type = "lowpass";
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t);

      if (climbVoice === "glass") {
        // singing, glassy: pure sine harmonics + soft vibrato
        filt.frequency.setValueAtTime(900, t);
        filt.Q.value = 0.4;
        gain.gain.exponentialRampToValueAtTime(0.07, t + 0.45);
        const lfo = c.createOscillator();
        const lfoGain = c.createGain();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(4.6, t);
        lfoGain.gain.setValueAtTime(2.5, t);
        lfo.connect(lfoGain);
        const layers = [
          { mul: 1, g: 1.0 },
          { mul: 2, g: 0.32 },
          { mul: 3, g: 0.12 },
          { mul: 0.5, g: 0.4 },
        ];
        const oscs = layers.map(({ mul, g }) => {
          const osc = c.createOscillator();
          const og = c.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(165 * mul, t);
          lfoGain.connect(osc.detune);
          og.gain.value = g;
          osc.connect(og);
          og.connect(filt);
          osc.start(t);
          return { osc, mul };
        });
        filt.connect(gain);
        gain.connect(master!);
        lfo.start(t);
        climb = {
          oscs,
          gain,
          filt,
          lfo,
          lfoGain,
          mode: "glass",
          baseFreq: 165,
          span: 2.3,
          filtBase: 900,
          filtSpan: 2200,
        };
        voice(247, t, 0.45, { type: "sine", gain: 0.09, glideTo: 494, attack: 0.05 });
      } else {
        // velvet: warm detuned triangle unison + soft sub
        filt.frequency.setValueAtTime(520, t);
        filt.Q.value = 0.6;
        gain.gain.exponentialRampToValueAtTime(0.075, t + 0.35);
        const layers = [
          { mul: 0.5, detune: 0, type: "sine" as OscillatorType, g: 0.55 },
          { mul: 1, detune: -5, type: "triangle" as OscillatorType, g: 1.0 },
          { mul: 1, detune: 6, type: "triangle" as OscillatorType, g: 0.85 },
          { mul: 1.5, detune: 0, type: "triangle" as OscillatorType, g: 0.3 },
        ];
        const oscs = layers.map(({ mul, detune, type, g }) => {
          const osc = c.createOscillator();
          const og = c.createGain();
          osc.type = type;
          osc.detune.value = detune;
          osc.frequency.setValueAtTime(150 * mul, t);
          og.gain.value = g;
          osc.connect(og);
          og.connect(filt);
          osc.start(t);
          return { osc, mul };
        });
        filt.connect(gain);
        gain.connect(master!);
        climb = {
          oscs,
          gain,
          filt,
          mode: "velvet",
          baseFreq: 150,
          span: 2.4,
          filtBase: 520,
          filtSpan: 1700,
        };
        voice(220, t, 0.4, { type: "sine", gain: 0.1, glideTo: 480, attack: 0.04 });
      }
    },

    // ramp the tone with climb progress (0..1)
    limboTo(p) {
      if (!climb || !ctx) return;
      const t = ctx.currentTime;
      const prog = Math.max(0, Math.min(1, p));
      const base = climb.baseFreq * Math.pow(2, prog * climb.span);
      climb.oscs.forEach(({ osc, mul }) =>
        osc.frequency.setTargetAtTime(base * mul, t, climb!.mode === "glass" ? 0.09 : 0.08)
      );
      climb.filt.frequency.setTargetAtTime(
        climb.filtBase + prog * climb.filtSpan,
        t,
        climb.mode === "glass" ? 0.12 : 0.1
      );
      // glass: vibrato widens as tension builds
      if (climb.lfoGain) climb.lfoGain.gain.setTargetAtTime(2.5 + prog * 9, t, 0.15);
    },

    // ping the instant the climb crosses the target — soft bell
    limboCross() {
      if (muted || !ensure()) return;
      const t = ctx!.currentTime;
      voice(1046.5, t, 0.5, { type: "sine", gain: 0.08, attack: 0.008 });
      voice(1568, t, 0.38, { type: "sine", gain: 0.04, attack: 0.008 });
    },

    // resolve: bright on win, deflating drop on loss
    limboEnd(win, mult) {
      if (muted) {
        stopClimb(true);
        return;
      }
      if (!ensure()) return;
      const t = ctx!.currentTime;
      stopClimb(false);
      if (win) {
        const big = (mult || 1) >= 10;
        const root = big ? 659.25 : 523.25; // E5 vs C5
        const steps = big ? [0, 4, 7, 12] : [0, 4, 7];
        steps.forEach((s, i) =>
          voice(root * Math.pow(2, s / 12), t + 0.05 + i * 0.07, 0.5, {
            type: "triangle",
            gain: 0.13,
            attack: 0.006,
          })
        );
        noise(t + 0.05, 0.05, { gain: 0.05, freq: 6000, q: 0.4, type: "highpass" });
      } else {
        voice(196, t, 0.6, { type: "sine", gain: 0.13, glideTo: 73, attack: 0.03 });
        voice(98, t, 0.6, { type: "triangle", gain: 0.06, glideTo: 49, attack: 0.03 });
      }
    },

    // play a short self-contained swell (used by the engine for previews)
    limboPreview() {
      if (muted || !ensure()) return;
      this.unlock();
      this.limboStart();
      const steps = [0.15, 0.35, 0.55, 0.78, 1.0];
      steps.forEach((p, i) => setTimeout(() => this.limboTo(p), 120 + i * 150));
      setTimeout(() => this.limboCross(), 120 + steps.length * 150 + 40);
      setTimeout(() => this.limboEnd(true, 8), 120 + steps.length * 150 + 220);
    },
  };

  return engine;
}

// No-op engine for SSR / environments without Web Audio.
const noopEngine: SoundEngine = {
  muted: true,
  climbVoice: "velvet",
  toggle: () => true,
  unlock: () => {},
  drop: () => {},
  peg: () => {},
  land: () => {},
  ui: () => {},
  setClimbVoice: () => {},
  limboStart: () => {},
  limboTo: () => {},
  limboCross: () => {},
  limboEnd: () => {},
  limboPreview: () => {},
};

let singleton: SoundEngine | null = null;

/** Returns the singleton sound engine. Safe to call on the server (returns a no-op). */
export function getSound(): SoundEngine {
  if (typeof window === "undefined") return noopEngine;
  if (!singleton) singleton = createEngine();
  return singleton;
}
