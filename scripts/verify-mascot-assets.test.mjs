import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyMascotAssets } from "./verify-mascot-assets.mjs";

const sourceMascotDir = path.resolve("public", "mascot");
const temporaryRoots = [];

async function createAssetRoot() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "mascot-verifier-test-"));
  temporaryRoots.push(rootDir);
  const mascotDir = path.join(rootDir, "public", "mascot");
  await mkdir(mascotDir, { recursive: true });
  await cp(sourceMascotDir, mascotDir, { recursive: true });
  return { rootDir, mascotDir };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

describe("verifyMascotAssets", () => {
  it("decodes every required GIF and PNG", async () => {
    const { rootDir } = await createAssetRoot();

    await expect(verifyMascotAssets(rootDir)).resolves.toBeUndefined();
  });

  it("rejects a header-only GIF89a file", async () => {
    const { rootDir, mascotDir } = await createAssetRoot();
    await writeFile(path.join(mascotDir, "react.gif"), "GIF89a", "ascii");

    await expect(verifyMascotAssets(rootDir)).rejects.toThrow(/react\.gif/);
  });

  it("rejects a signature-only PNG file", async () => {
    const { rootDir, mascotDir } = await createAssetRoot();
    await writeFile(path.join(mascotDir, "celebrate.png"), Buffer.from("89504e470d0a1a0a", "hex"));

    await expect(verifyMascotAssets(rootDir)).rejects.toThrow(/celebrate\.png/);
  });

  it("rejects a truncated PNG whose metadata is still readable", async () => {
    const { rootDir, mascotDir } = await createAssetRoot();
    const pngPath = path.join(mascotDir, "idle.png");
    const validPng = await readFile(pngPath);
    await writeFile(pngPath, validPng.subarray(0, Math.floor(validPng.length * 0.9)));

    await expect(verifyMascotAssets(rootDir)).rejects.toThrow(/idle\.png/);
  });
});
