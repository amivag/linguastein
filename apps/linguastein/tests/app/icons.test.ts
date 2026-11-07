/**
 * Every icon the manifest and the HTML name exists, at the size they claim.
 *
 * A missing or mis-sized icon fails nowhere else: the build copies `public/`
 * without looking, and the install prompt quietly shows a blank tile.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP } from '../../src/app/identity';

const root = process.cwd();
const config = readFileSync(join(root, 'vite.config.ts'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): readonly [number, number] {
  const bytes = readFileSync(file);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

const manifestIcons = [
  ...config.matchAll(/src: `\$\{BASE\}(icons\/[^`]+)`,\s*sizes: '([^']+)'/g),
].map(([, path, sizes]) => ({ path: path!, sizes: sizes! }));

describe('the manifest icons', () => {
  it('are read from the config, so the checks below cannot pass vacuously', () => {
    expect(manifestIcons.length).toBeGreaterThanOrEqual(4);
  });

  it('exist, and each PNG is the size it declares', () => {
    for (const { path, sizes } of manifestIcons) {
      const file = join(root, 'public', path);
      expect(existsSync(file), path).toBe(true);
      if (path.endsWith('.png')) expect(pngSize(file).join('x'), path).toBe(sizes);
    }
  });

  it('include the 192 and 512 PNGs install surfaces require', () => {
    const pngs = manifestIcons.filter((icon) => icon.path.endsWith('.png'));
    expect(pngs.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});

describe('the HTML icons', () => {
  it('give iOS a PNG touch icon at 180 pixels', () => {
    const href = /rel="apple-touch-icon" href="\/([^"]+)"/.exec(html)?.[1];

    expect(href).toMatch(/\.png$/);
    expect(pngSize(join(root, 'public', href!))).toEqual([180, 180]);
  });

  it('take the chrome colour from identity rather than a literal', () => {
    expect(html).toContain('%APP_CHROME_COLOR%');
    expect(APP.chromeColor).toMatch(/^#[0-9a-f]{6}$/);
  });
});
