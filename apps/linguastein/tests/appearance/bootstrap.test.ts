/** Execute the shipped inline bootstrap with a foreign app's registry. */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  createAppearance,
  createThemeMode,
  defineThemeCatalog,
  serializeAxes,
} from '@platform/appearance';

function boot(saved: Record<string, string>, blocked = false, mediaAvailable = true) {
  const appearance = createAppearance({ namespace: 'rhythm' });
  const catalog = defineThemeCatalog(
    [{ id: 'studio', label: 'Studio', description: '' }],
    'studio',
  );
  const mode = createThemeMode(appearance);
  const palette = appearance.defineAxis({
    key: 'palette',
    values: catalog.ids,
    fallback: catalog.defaultId,
  });
  const html = readFileSync('index.html', 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(script).toBeDefined();
  const injected = script!.replaceAll(
    '%APPEARANCE_AXES%',
    JSON.stringify(serializeAxes([mode.axis, palette])),
  );
  const dataset: Record<string, string> = {};
  const keys: string[] = [];
  runInNewContext(injected, {
    document: { documentElement: { dataset } },
    window: {
      matchMedia: () => {
        if (!mediaAvailable) throw new Error('No media queries');
        return { matches: false };
      },
    },
    localStorage: {
      getItem(key: string) {
        keys.push(key);
        if (blocked) throw new Error('Blocked storage');
        return saved[key] ?? null;
      },
    },
  });
  return { dataset, keys };
}

describe('portable first paint', () => {
  it('uses each serialized app namespace and falls back after a theme is removed', () => {
    const { dataset, keys } = boot({
      'rhythm.palette': 'removed',
      'rhythm.theme': 'system',
      'linguastein.palette': 'indigo',
    });
    expect(dataset).toEqual({ theme: 'light', palette: 'studio' });
    expect(keys).toEqual(['rhythm.theme', 'rhythm.palette']);
  });
  it('keeps applying fallbacks when storage and OS preference access fail', () => {
    expect(boot({}, true, false).dataset).toEqual({ theme: 'dark', palette: 'studio' });
  });
  it('retains an explicit mode when the OS preference differs', () => {
    expect(boot({ 'rhythm.palette': 'studio', 'rhythm.theme': 'dark' }).dataset).toEqual({
      theme: 'dark',
      palette: 'studio',
    });
  });
});
