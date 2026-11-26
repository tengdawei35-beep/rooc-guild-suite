import { buildSensitivityReport } from "../src/lib/ro3-combat-simulator/sensitivity-harness";

const report = buildSensitivityReport();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
