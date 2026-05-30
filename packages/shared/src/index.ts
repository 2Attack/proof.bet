/**
 * @proofbet/shared — the single source of truth across /contracts and /app.
 *
 * Framework-agnostic on purpose: ABIs, addresses, domain types, and the frozen
 * provably-fair engine. React/wagmi hooks live in /app, never here.
 */

export * from "./types.js";
export * from "./addresses.js";
export * as fairness from "./fairness/index.js";
