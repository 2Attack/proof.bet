/**
 * Re-export Plinko multiplier tables from @proofbet/shared.
 * Tables are ×100 integer fixed-point (e.g. 100 = 1.00×, 250 = 2.50×).
 * Structure: { rows: { risk: multiplier[] } }
 *
 * This indirection is needed because the tables JSON is not listed in the
 * package.json `exports` field of @proofbet/shared.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const data = require("../../../packages/shared/src/tables/plinko-tables.json") as Record<string, Record<string, number[]>>;
export default data;
