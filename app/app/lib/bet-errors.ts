/**
 * Classifying bet failures — one place so Limbo and Plinko never drift.
 *
 * A user declining the MetaMask prompt is NOT a bug: viem throws a
 * `ContractFunctionExecutionError` wrapping `TransactionExecutionError` →
 * `UserRejectedRequestError` (the provider's `code: 4001` lives on that
 * innermost error, never the top-level object). We walk the chain to spot it,
 * so a rejection reads as a calm "cancelled" while real failures (RPC down,
 * reverts, settlement timeout) still surface — and still get logged.
 *
 * Beyond rejection we sort failures into the calm, never-alarming states the
 * design gallery (`/states`) mocks up — out of gas, wrong network, bankroll
 * cap, insufficient in-play — each with a glyph, a plain-language line, and a
 * single recovery action. `placeBetLive` writes straight through the wallet
 * (no `simulateContract`), so a custom-error revert may arrive without a clean
 * decoded `errorName`. We therefore LEAD with string-matching the formatted
 * error and treat the decoded `errorName` as a bonus — detection never depends
 * on which layer the revert surfaced from.
 */

import {
  BaseError,
  ChainMismatchError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from "viem";

/** Where to send a player who lacks Sepolia ETH for gas. This is the testnet
 *  GAS faucet (tETH), NOT the app's `/faucet` (which mints PRF) — the two
 *  currencies never mix. Swap freely if a faucet goes down. */
export const SEPOLIA_GAS_FAUCET_URL =
  "https://cloud.google.com/application/web3/faucet/ethereum/sepolia";

/** The failure buckets we render distinctly. `unknown` is the catch-all. */
export type BetErrorKind =
  | "rejected"
  | "gas"
  | "network"
  | "bankroll"
  | "balance"
  | "params"
  | "unknown";

/** What the toast's single action button does. The page owns the behaviour;
 *  the classifier only names the intent. */
export type BetErrorAction =
  | "retry"
  | "faucet"
  | "switch-network"
  | "adjust"
  | "dismiss";

export interface BetErrorInfo {
  kind: BetErrorKind;
  /** Back-compat + styling: true only when the player declined the prompt. */
  cancelled: boolean;
  /** Mono glyph mirroring the design gallery (✕ ⛽ ⚡ ▣ ∅). */
  glyph: string;
  title: string;
  message: string;
  /** Single recovery action, or null when there is nothing to offer. */
  action: { label: string; intent: BetErrorAction } | null;
  /** Actionable, fixable errors stay up longer so the player can act; a bare
   *  rejection auto-dismisses fast. */
  persist: boolean;
}

/** Lowercased haystack from the whole viem error chain. `BaseError.message`
 *  already pretty-prints details + metaMessages, so matching here catches the
 *  RPC's "insufficient funds for gas", a custom error's name, etc. */
function errorText(err: unknown): string {
  if (err instanceof BaseError) {
    return `${err.shortMessage}\n${err.message}`.toLowerCase();
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m.toLowerCase() : "";
  }
  return "";
}

/** Decoded custom-error name when viem managed to ABI-decode the revert. */
function revertErrorName(err: unknown): string | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
  return reverted instanceof ContractFunctionRevertedError
    ? reverted.data?.errorName
    : undefined;
}

/** True when the failure is the player declining the wallet signature. */
export function isUserRejection(err: unknown): boolean {
  if (err instanceof BaseError) {
    return Boolean(err.walk((e) => e instanceof UserRejectedRequestError));
  }
  // Fallback for a bare provider error that escaped viem's wrapping.
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 4001
  );
}

function isWrongNetwork(err: unknown, text: string): boolean {
  if (err instanceof BaseError && err.walk((e) => e instanceof ChainMismatchError)) {
    return true;
  }
  return (
    text.includes("chain mismatch") ||
    text.includes("does not match the target chain") ||
    text.includes("chain of the connector") ||
    text.includes("wrong network")
  );
}

function isOutOfGas(err: unknown, text: string): boolean {
  if (err instanceof BaseError && err.walk((e) => e instanceof InsufficientFundsError)) {
    return true;
  }
  // The contract's own shortfalls are CUSTOM errors (InsufficientInPlay), never
  // the literal "insufficient funds" string — so that phrase means native ETH
  // for gas, the wallet's problem, not the in-play balance.
  return (
    text.includes("insufficient funds for gas") ||
    text.includes("insufficient funds for intrinsic") ||
    text.includes("insufficient funds for transfer") ||
    text.includes("gas required exceeds")
  );
}

/**
 * Sort any thrown bet failure into one calm, recoverable state. String-match
 * led (robust to undecoded reverts); decoded `errorName` is a tie-breaker.
 */
export function classifyBetError(err: unknown): BetErrorInfo {
  if (isUserRejection(err)) {
    return {
      kind: "rejected",
      cancelled: true,
      glyph: "✕",
      title: "Transaction rejected",
      message: "You declined the signature in your wallet. No bet was placed.",
      action: { label: "Try again", intent: "retry" },
      persist: false,
    };
  }

  const text = errorText(err);
  const name = revertErrorName(err);

  if (isWrongNetwork(err, text)) {
    return {
      kind: "network",
      cancelled: false,
      glyph: "⚡",
      title: "Wrong network",
      message: "This contract lives on Sepolia. Switch networks to continue.",
      action: { label: "Switch to Sepolia", intent: "switch-network" },
      persist: true,
    };
  }

  if (isOutOfGas(err, text)) {
    return {
      kind: "gas",
      cancelled: false,
      glyph: "⛽",
      title: "Not enough gas",
      message: "Your wallet lacks Sepolia ETH for gas. Grab some from a faucet.",
      action: { label: "Open faucet ↗", intent: "faucet" },
      persist: true,
    };
  }

  if (name === "BetTooLarge" || text.includes("bettoolarge")) {
    return {
      kind: "bankroll",
      cancelled: false,
      glyph: "▣",
      title: "Bankroll cap reached",
      message:
        "This bet's max payout exceeds what the house can safely cover right now. Lower your stake or target.",
      action: { label: "Adjust bet", intent: "adjust" },
      persist: true,
    };
  }

  if (name === "InsufficientInPlay" || text.includes("insufficientinplay")) {
    return {
      kind: "balance",
      cancelled: false,
      glyph: "∅",
      title: "Insufficient balance",
      message: "Your stake is larger than your in-play Proofs (PRF) balance.",
      action: { label: "Lower stake", intent: "adjust" },
      persist: true,
    };
  }

  if (
    name === "InvalidGameParams" ||
    name === "ZeroAmount" ||
    text.includes("invalidgameparams") ||
    text.includes("zeroamount")
  ) {
    return {
      kind: "params",
      cancelled: false,
      glyph: "▣",
      title: "Invalid bet",
      message: "Those bet parameters aren't valid. Adjust your stake or target.",
      action: { label: "Adjust bet", intent: "adjust" },
      persist: true,
    };
  }

  // viem's `shortMessage` is the one-liner (e.g. a revert reason); the full
  // dump goes to the console, not the player.
  const message =
    err instanceof BaseError
      ? err.shortMessage
      : "Something went wrong. Please try again.";
  return {
    kind: "unknown",
    cancelled: false,
    glyph: "✕",
    title: "Bet failed",
    message,
    action: { label: "Try again", intent: "retry" },
    persist: false,
  };
}

/**
 * A short, player-facing line for the pending toast's terminal state.
 * @deprecated Prefer {@link classifyBetError} for the full glyph/title/action.
 *   Kept so older call sites keep compiling.
 */
export function describeBetError(err: unknown): string {
  return classifyBetError(err).message;
}
