import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "worker", "index.js");
const destination = resolve(projectRoot, "dist", "server", "index.js");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
