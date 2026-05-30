/**
 * Generate the FROZEN Plinko multiplier tables (Phase-0 seam artifact).
 *
 * Runs the float formula ONCE and freezes the result to:
 *   - src/tables/plinko-tables.json  — ×100 integer tables (canonical numbers)
 *   - src/tables/plinko-edges.json   — per-table house edge (display only)
 *
 * The contract's Solidity table is generated FROM plinko-tables.json by the
 * /contracts track and proven equal by the golden vectors. Re-run only with a
 * deliberate, reviewed change — drifting these numbers breaks "✓ matches".
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLINKO_ROW_RANGE, RISK_KEYS } from "../src/types.js";
import {
  computePlinkoTableX100,
  computePlinkoEdge,
} from "../src/fairness/plinko-formula.js";

const here = dirname(fileURLToPath(import.meta.url));
const tablesDir = join(here, "..", "src", "tables");
mkdirSync(tablesDir, { recursive: true });

const tables: Record<string, Record<string, number[]>> = {};
const edges: Record<string, Record<string, number>> = {};

for (const rows of PLINKO_ROW_RANGE) {
  tables[rows] = {};
  edges[rows] = {};
  for (const risk of RISK_KEYS) {
    tables[rows][risk] = computePlinkoTableX100(rows, risk);
    edges[rows][risk] = Number(computePlinkoEdge(rows, risk).toFixed(6));
  }
}

writeFileSync(
  join(tablesDir, "plinko-tables.json"),
  JSON.stringify(tables, null, 2) + "\n",
);
writeFileSync(
  join(tablesDir, "plinko-edges.json"),
  JSON.stringify(edges, null, 2) + "\n",
);

const count = PLINKO_ROW_RANGE.length * RISK_KEYS.length;
const maxX100 = Math.max(
  ...PLINKO_ROW_RANGE.flatMap((r) =>
    RISK_KEYS.map((k) => Math.max(...tables[r]![k]!)),
  ),
);
console.log(
  `✓ Froze ${count} Plinko tables (rows ${PLINKO_ROW_RANGE[0]}..${PLINKO_ROW_RANGE.at(-1)} × ${RISK_KEYS.join("/")}).`,
);
console.log(`  max multiplier×100 = ${maxX100} (fits uint32: ${maxX100 < 2 ** 32}).`);
