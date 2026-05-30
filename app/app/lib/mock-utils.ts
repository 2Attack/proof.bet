/**
 * Utilities shared by the mock adapter.
 */

import type { Hex } from "viem";

/** Generate a cryptographically-ish random hex string of n bytes. */
export function randHex(bytes: number): Hex {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return ("0x" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("")) as Hex;
}

/** Simulate VRF + oracle latency with a fake 3-step narrative. */
export function fakeVRFLatency(): Promise<bigint> {
  return new Promise((resolve) => {
    // Realistic latency: 3-8 seconds in mock mode
    const total = 3000 + Math.random() * 5000;
    setTimeout(() => resolve(BigInt("0x" + randHex(32).slice(2))), total);
  });
}

/** Simulates a wallet signature + broadcast latency. */
export function fakeTxLatency(): Promise<Hex> {
  return new Promise((resolve) => {
    const sign = 800 + Math.random() * 400;
    const confirm = 1200 + Math.random() * 800;
    setTimeout(() => resolve(randHex(32) as Hex), sign + confirm);
  });
}

/** fmt: format bigint in ×100 FP as human number string. */
export function fmtPRF(n: bigint, decimals = 2): string {
  const whole = n / 100n;
  const frac = n % 100n;
  if (decimals === 0) return whole.toLocaleString("en-US");
  const fracStr = frac.toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${fracStr}`;
}
