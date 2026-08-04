import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const GIF_HEADERS = ["GIF87a", "GIF89a"];
const PNG_SIGNATURE = "89504e470d0a1a0a";
const ASSET_NAMES = ["idle", "sleep", "react", "celebrate"];
export const IDLE_VARIANTS = [
  "02", "03", "04", "05", "06", "08", "09", "10", "11",
  "12", "13", "14", "15", "16", "17", "18", "19", "20"
];
export const MASCOT_ASSET_COUNT = (ASSET_NAMES.length + IDLE_VARIANTS.length) * 2;

async function verifyAsset(filePath, expectedType) {
  const contents = await readFile(filePath);

  if (contents.length === 0) {
    throw new Error(`Mascot asset is empty: ${filePath}`);
  }

  const header = contents.subarray(0, expectedType === "gif" ? 6 : 8).toString("hex");
  const isValid = expectedType === "gif"
    ? GIF_HEADERS.some((gifHeader) => header === Buffer.from(gifHeader).toString("hex"))
    : header === PNG_SIGNATURE;

  if (!isValid) {
    throw new Error(`Invalid ${expectedType.toUpperCase()} header: ${filePath}`);
  }

  let metadata;
  try {
    metadata = await sharp(contents, { animated: expectedType === "gif" }).metadata();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to decode ${expectedType.toUpperCase()} mascot asset: ${filePath}: ${detail}`);
  }

  if (metadata.format !== expectedType) {
    throw new Error(`Unexpected decoded format for ${filePath}: ${metadata.format ?? "unknown"}`);
  }

  if (!Number.isInteger(metadata.width) || metadata.width <= 0
    || !Number.isInteger(metadata.height) || metadata.height <= 0) {
    throw new Error(`Invalid decoded dimensions for ${filePath}`);
  }

  if (expectedType === "gif"
    && (!Number.isInteger(metadata.pages) || metadata.pages <= 0
      || !Number.isInteger(metadata.pageHeight) || metadata.pageHeight <= 0)) {
    throw new Error(`Invalid decoded GIF frames for ${filePath}`);
  }

  let pixels;
  try {
    pixels = await sharp(contents, { animated: expectedType === "gif" })
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to decode ${expectedType.toUpperCase()} pixel data: ${filePath}: ${detail}`);
  }

  const { data, info } = pixels;
  const expectedPixelBytes = info.width * info.height * info.channels;
  if (info.width <= 0 || info.height <= 0 || info.channels <= 0
    || data.length <= 0 || data.length !== expectedPixelBytes) {
    throw new Error(`Invalid decoded pixel buffer for ${filePath}`);
  }
}

export async function verifyMascotAssets(rootDir) {
  const mascotDir = path.join(rootDir, "public", "mascot");

  for (const name of ASSET_NAMES) {
    await verifyAsset(path.join(mascotDir, `${name}.gif`), "gif");
    await verifyAsset(path.join(mascotDir, `${name}.png`), "png");
  }

  for (const variant of IDLE_VARIANTS) {
    await verifyAsset(path.join(mascotDir, "idle", `${variant}.gif`), "gif");
    await verifyAsset(path.join(mascotDir, "idle", `${variant}.png`), "png");
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  verifyMascotAssets(process.cwd())
    .then(() => {
      console.log(`Mascot assets verified: ${MASCOT_ASSET_COUNT} files`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
