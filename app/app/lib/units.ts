/**
 * PRF unit conversion at the mock↔live boundary.
 *
 * The entire UI works in ×100 fixed-point ("fp": 2 decimals, FP_SCALE=100n) —
 * see mock-store.ts and every `Number(x) / 100` in the screens. On-chain, PRF is
 * a standard 18-decimal ERC20. AppContext and the live hooks convert here so the
 * pixel-perfect UI never has to know which mode it's in.
 *
 *   fp value  = on-chain wei / 10^(18-2) = wei / 10^16
 *   wei value = fp value * 10^16
 */

export const PRF_DECIMALS = 18n;
export const FP_DECIMALS = 2n;

/** 10^(18-2): wei per one ×100 fixed-point unit. */
export const WEI_PER_FP = 10n ** (PRF_DECIMALS - FP_DECIMALS); // 1e16

/** On-chain wei → ×100 fixed-point (truncates beyond 2 decimals). */
export function weiToFp(wei: bigint): bigint {
  return wei / WEI_PER_FP;
}

/** ×100 fixed-point → on-chain wei (exact; fp is the coarser unit). */
export function fpToWei(fp: bigint): bigint {
  return fp * WEI_PER_FP;
}
