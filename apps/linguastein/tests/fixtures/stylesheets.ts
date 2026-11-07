/**
 * Every stylesheet the app renders with: its own under `src/`, and the UI kit's
 * under `packages/ui/src/`, which the app draws on every screen.
 *
 * The design-language, motion and hover tests hold both to the same rules, so a
 * rule cannot be escaped by moving a component into the kit. Kit files are named
 * `@platform/ui/<file>`, app files by their path under `src/`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const APP = resolve(process.cwd(), 'src');
const UI = resolve(process.cwd(), '..', '..', 'packages', 'ui', 'src');
const UI_PREFIX = '@platform/ui/';

function walk(root: string, directory = root): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return walk(root, path);
    return path.endsWith('.css') ? [relative(root, path).split('\\').join('/')] : [];
  });
}

export function stylesheets(): string[] {
  return [...walk(APP), ...walk(UI).map((file) => `${UI_PREFIX}${file}`)];
}

export function readStylesheet(file: string): string {
  return file.startsWith(UI_PREFIX)
    ? readFileSync(join(UI, file.slice(UI_PREFIX.length)), 'utf8')
    : readFileSync(join(APP, file), 'utf8');
}
