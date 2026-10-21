import { existsSync } from "node:fs";

const required = ["dist/index.html", "dist/templates/alpha/01-first-party-daily.csv"];
const missing = required.filter(path => !existsSync(path));
if (missing.length) {
  console.error(`Build verification failed; missing: ${missing.join(", ")}`);
  process.exit(1);
}
