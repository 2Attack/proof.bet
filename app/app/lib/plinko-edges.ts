/**
 * Re-export Plinko house-edge data from @proofbet/shared.
 * Structure: { rows: { risk: edge_fraction } }
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const data = require("../../../packages/shared/src/tables/plinko-edges.json") as Record<string, Record<string, number>>;
export default data;
