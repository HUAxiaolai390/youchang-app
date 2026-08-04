import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyBackgroundMusic } from "./verify-audio-asset.mjs";

const temporaryRoots = [];

async function createAudioRoot() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "youchang-audio-test-"));
  temporaryRoots.push(rootDir);
  const audioDir = path.join(rootDir, "public", "audio");
  await mkdir(audioDir, { recursive: true });
  await cp(path.resolve("public", "audio", "background.mp3"), path.join(audioDir, "background.mp3"));
  return { rootDir, audioPath: path.join(audioDir, "background.mp3") };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("verifyBackgroundMusic", () => {
  it("accepts the extracted MP3", async () => {
    const { rootDir } = await createAudioRoot();
    await expect(verifyBackgroundMusic(rootDir)).resolves.toBeUndefined();
  });

  it("rejects a header-only fake", async () => {
    const { rootDir, audioPath } = await createAudioRoot();
    await writeFile(audioPath, "ID3", "ascii");
    await expect(verifyBackgroundMusic(rootDir)).rejects.toThrow(audioPath);
  });

  it("rejects a changed audio payload", async () => {
    const { rootDir, audioPath } = await createAudioRoot();
    const contents = await readFile(audioPath);
    contents[contents.length - 1] ^= 0xff;
    await writeFile(audioPath, contents);
    await expect(verifyBackgroundMusic(rootDir)).rejects.toThrow(/hash mismatch/);
  });
});
