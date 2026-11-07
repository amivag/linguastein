/**
 * Raster icons from the SVG sources in `public/icons/`.
 *
 * SVG is enough for browsers that read the manifest's `sizes: any`, but not for
 * every platform: iOS takes only a PNG `apple-touch-icon`, and install surfaces
 * that do not rasterize SVG fall back to a blank tile. The PNGs are generated
 * rather than hand-exported, so a changed SVG is one command from a matching set.
 *
 * The maskable source fills its whole square, which is what both maskable icons
 * and iOS need: iOS applies its own rounded mask, and a transparent corner shows
 * as black there.
 *
 * Run with `npm run build:icons`; the output is committed.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ICONS = join(import.meta.dirname, '..', 'public', 'icons');

/**
 * File, source SVG and edge length. The manifest in `vite.config.ts` and
 * `tests/app/icons.test.ts` name the same files.
 */
const RASTER_ICONS = [
  ['icon-192.png', 'icon.svg', 192],
  ['icon-512.png', 'icon.svg', 512],
  ['icon-maskable-192.png', 'icon-maskable.svg', 192],
  ['icon-maskable-512.png', 'icon-maskable.svg', 512],
  ['apple-touch-icon.png', 'icon-maskable.svg', 180],
] as const;

for (const [file, source, size] of RASTER_ICONS) {
  // Rendered at twice the largest size and scaled down, so edges are antialiased.
  await sharp(readFileSync(join(ICONS, source)), { density: 144 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(ICONS, file));
  console.log(`${file} ${size}×${size} from ${source}`);
}
