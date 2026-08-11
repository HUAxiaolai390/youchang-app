import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "public", "maskable-icon-512x512.png");
const resources = resolve(projectRoot, "android", "app", "src", "main", "res");

const iconSizes = {
  mdpi: { launcher: 48, foreground: 108 },
  hdpi: { launcher: 72, foreground: 162 },
  xhdpi: { launcher: 96, foreground: 216 },
  xxhdpi: { launcher: 144, foreground: 324 },
  xxxhdpi: { launcher: 192, foreground: 432 },
};

for (const [density, sizes] of Object.entries(iconSizes)) {
  const directory = resolve(resources, `mipmap-${density}`);
  await sharp(source).resize(sizes.launcher, sizes.launcher).png().toFile(resolve(directory, "ic_launcher.png"));
  await sharp(source).resize(sizes.launcher, sizes.launcher).png().toFile(resolve(directory, "ic_launcher_round.png"));
  await sharp(source).resize(sizes.foreground, sizes.foreground).png().toFile(resolve(directory, "ic_launcher_foreground.png"));
}

for (const directoryName of await readdir(resources)) {
  if (!directoryName.startsWith("drawable")) continue;
  const destination = resolve(resources, directoryName, "splash.png");

  try {
    const metadata = await sharp(destination).metadata();
    if (!metadata.width || !metadata.height) continue;

    const iconSize = Math.round(Math.min(metadata.width, metadata.height) * 0.28);
    const icon = await sharp(source).resize(iconSize, iconSize).png().toBuffer();
    const splash = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 4,
        background: "#f4f0e8",
      },
    })
      .composite([{ input: icon, gravity: "centre" }])
      .png()
      .toBuffer();
    await sharp(splash).png().toFile(destination);
  } catch {
    // Capacitor projects may omit some density-specific splash assets.
  }
}
