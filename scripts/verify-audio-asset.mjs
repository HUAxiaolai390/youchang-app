import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BACKGROUND_MUSIC_HASH = "3A494E36FC9528C9C81F39F713C88909DE54D895B7022D05814CA26261206970";

function readSyncSafeInteger(bytes) {
  return ((bytes[0] & 0x7f) << 21)
    | ((bytes[1] & 0x7f) << 14)
    | ((bytes[2] & 0x7f) << 7)
    | (bytes[3] & 0x7f);
}

export async function verifyBackgroundMusic(rootDir) {
  const filePath = path.join(rootDir, "public", "audio", "background.mp3");
  const contents = await readFile(filePath);
  if (contents.length < 10_000) throw new Error(`Background music is too small: ${filePath}`);

  const hasId3 = contents.subarray(0, 3).toString("ascii") === "ID3";
  if (!hasId3) throw new Error(`Background music is missing its ID3 header: ${filePath}`);

  const firstFrameOffset = 10 + readSyncSafeInteger(contents.subarray(6, 10));
  const hasMpegFrame = contents[firstFrameOffset] === 0xff
    && (contents[firstFrameOffset + 1] & 0xe0) === 0xe0;
  if (!hasMpegFrame) throw new Error(`Background music is missing its first MPEG frame: ${filePath}`);

  const hash = createHash("sha256").update(contents).digest("hex").toUpperCase();
  if (hash !== BACKGROUND_MUSIC_HASH) throw new Error(`Background music hash mismatch: ${filePath}`);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  verifyBackgroundMusic(process.cwd())
    .then(() => console.log("Background music verified: 1 MP3 file"))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
