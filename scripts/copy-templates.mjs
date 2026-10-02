import { cpSync, rmSync } from "node:fs";

rmSync("dist/templates", { recursive: true, force: true });
cpSync("templates", "dist/templates", { recursive: true });
