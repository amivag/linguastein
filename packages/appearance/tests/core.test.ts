import { describe, expect, it } from 'vitest';
import {
  createAppearance,
  createThemeMode,
  defineThemeCatalog,
  serializeAxes,
  type AppearanceHost,
} from '../src/index.ts';

function fixture(namespace = 'rhythm') {
  const dataset: Record<string, string> = {};
  const saved = new Map<string, string>();
  const host: AppearanceHost = {
    document: { documentElement: { dataset } },
    localStorage: {
      setItem: (key, value) => {
        saved.set(key, value);
      },
    },
  };
  return { dataset, saved, host, appearance: createAppearance({ namespace, host: () => host }) };
}
const pulse = { id: 'pulse', label: 'Pulse', description: 'A rhythm app theme.' } as const;
const studio = { id: 'studio', label: 'Studio', description: 'Another app theme.' } as const;

describe('independent app theme sets', () => {
  it('composes theme modules and derives ids, metadata and fallback from one catalog', () => {
    const builtIn = [pulse] as const;
    const extension = [studio] as const;
    const catalog = defineThemeCatalog([...builtIn, ...extension], 'studio');
    expect(catalog.ids).toEqual(['pulse', 'studio']);
    expect(catalog.options.map((option) => option.label)).toEqual(['Pulse', 'Studio']);
    expect(catalog.is('studio')).toBe(true);
    expect(catalog.is(42)).toBe(false);
    expect(catalog.resolve('indigo')).toBe('studio');
    expect(catalog.resolve('pulse')).toBe('pulse');
    expect(catalog.resolve(undefined)).toBe('studio');
  });

  it('keeps two apps on one origin isolated while using the same mechanism', () => {
    const one = fixture('language');
    const two = fixture('rhythm');
    const hostTwo = { ...two.host, localStorage: one.host.localStorage! };
    const rhythm = createAppearance({ namespace: 'rhythm', host: () => hostTwo });
    const languageCatalog = defineThemeCatalog(
      [{ id: 'paper', label: 'Paper', description: '' }],
      'paper',
    );
    const rhythmCatalog = defineThemeCatalog([pulse, studio], 'studio');
    const languageAxis = one.appearance.defineAxis({
      key: 'palette',
      values: languageCatalog.ids,
      fallback: languageCatalog.defaultId,
    });
    const rhythmAxis = rhythm.defineAxis({
      key: 'palette',
      values: rhythmCatalog.ids,
      fallback: rhythmCatalog.defaultId,
    });
    languageAxis.apply('paper');
    rhythmAxis.apply('pulse');
    expect(one.dataset.palette).toBe('paper');
    expect(two.dataset.palette).toBe('pulse');
    expect(Object.fromEntries(one.saved)).toEqual({
      'language.palette': 'paper',
      'rhythm.palette': 'pulse',
    });
    expect(languageAxis.is('pulse')).toBe(false);
    expect(rhythmAxis.is('paper')).toBe(false);
    const prePaint = serializeAxes([rhythmAxis]);
    expect(prePaint[0]).toMatchObject({
      storageKey: 'rhythm.palette',
      values: ['pulse', 'studio'],
      fallback: 'studio',
      dataset: 'palette',
      system: false,
    });
  });

  it('snapshots plugin metadata so later mutation cannot change the registered catalog', () => {
    const original = { id: 'pulse', label: 'Pulse', description: '' };
    const entries = [original];
    const catalog = defineThemeCatalog(entries, 'pulse');
    original.id = 'changed';
    entries.push({ id: 'late', label: 'Late', description: '' });
    expect(catalog.ids).toEqual(['pulse']);
    expect(catalog.options[0]?.id).toBe('pulse');
  });

  it.each([
    { entries: [], fallback: 'pulse' },
    { entries: [pulse, pulse], fallback: 'pulse' },
    { entries: [pulse], fallback: 'missing' },
    { entries: [{ ...pulse, id: 'bad id' }], fallback: 'bad id' },
    { entries: [{ ...pulse, label: '  ' }], fallback: 'pulse' },
  ])('refuses invalid app registration: $fallback / $entries', ({ entries, fallback }) => {
    expect(() => defineThemeCatalog(entries, fallback)).toThrow();
  });
});

describe('appearance host and axes', () => {
  it('caches system preference while rendering and serializing a concrete mode', () => {
    const { appearance, dataset, saved } = fixture();
    const mode = createThemeMode(appearance);
    expect(mode.apply('system', true)).toBe('dark');
    expect(dataset.theme).toBe('dark');
    expect(saved.get('rhythm.theme')).toBe('system');
    expect(mode.apply('system', false)).toBe('light');
    expect(mode.apply('dark', false)).toBe('dark');
    expect(mode.apply('light', true)).toBe('light');
    expect(serializeAxes([mode.axis])[0]?.system).toBe(true);
  });

  it('applies an axis even when accessing localStorage throws', () => {
    const { dataset, host } = fixture();
    Object.defineProperty(host, 'localStorage', {
      get() {
        throw new Error('Blocked storage');
      },
    });
    const axis = createAppearance({ namespace: 'rhythm', host: () => host }).defineAxis({
      key: 'reading-size',
      values: ['small', 'large'],
      fallback: 'small',
    });
    expect(() => axis.apply('large')).not.toThrow();
    expect(dataset.readingSize).toBe('large');
  });

  it('works without a document or storage, including during build-time imports', () => {
    const axis = createAppearance({ namespace: 'headless', host: () => ({}) }).defineAxis({
      key: 'palette',
      values: ['pulse'],
      fallback: 'pulse',
    });
    expect(() => axis.apply('pulse')).not.toThrow();
    const { appearance, dataset, host } = fixture();
    const axisNoStorage = createAppearance({
      namespace: 'no-storage',
      host: () => ({ document: host.document! }),
    }).defineAxis({ key: 'palette', values: ['pulse'], fallback: 'pulse' });
    axisNoStorage.apply('pulse');
    expect(dataset.palette).toBe('pulse');
    expect(
      appearance.defineAxis({ key: 'palette', values: ['pulse'], fallback: 'pulse' }).is(null),
    ).toBe(false);
  });

  it('rejects invalid axes and namespaces before they reach CSS or pre-paint', () => {
    expect(() => createAppearance({ namespace: 'bad namespace' })).toThrow();
    const { appearance } = fixture();
    expect(() =>
      appearance.defineAxis({ key: 'badKey', values: ['on'], fallback: 'on' }),
    ).toThrow();
    expect(() => appearance.defineAxis({ key: 'palette', values: [], fallback: 'on' })).toThrow();
    expect(() =>
      appearance.defineAxis({ key: 'palette', values: ['on', 'on'], fallback: 'on' }),
    ).toThrow();
    expect(() =>
      appearance.defineAxis({ key: 'palette', values: ['on'], fallback: 'off' }),
    ).toThrow();
    const axis = appearance.defineAxis({ key: 'palette', values: ['on'], fallback: 'on' });
    expect(() => serializeAxes([axis, axis])).toThrow();
  });

  it('snapshots axis values before deriving validators and serialized data', () => {
    const { appearance } = fixture();
    const values = ['pulse'];
    const axis = appearance.defineAxis({ key: 'palette', values, fallback: 'pulse' });
    values.push('late');
    expect(axis.is('late')).toBe(false);
    expect(serializeAxes([axis])[0]?.values).toEqual(['pulse']);
  });
});
