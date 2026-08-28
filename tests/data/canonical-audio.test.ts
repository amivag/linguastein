/**
 * The pack's half of the canonical-audio pipeline.
 *
 * `generate-audio.ts` synthesises and records; the dataset build reads what was
 * recorded and emits the audio records. The two never overlap, which is what
 * lets a voice be added, reviewed, replaced or dropped without touching a byte of
 * content — and what lets this half ship before a single clip exists.
 *
 * These run against a scratch copy of `content/es`, so the shipped pack is
 * untouched and the ledger under test is one this file wrote.
 */

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { AudioClip, PackManifest } from '../../src/domain/content';
import { createScratchPack, packManifestPath, type ScratchPack } from '../fixtures/dataset';

const LEDGER = 'audio-ledger.tsv';
const VOICES = 'voices.tsv';

const header = [
  '# Generated clips. The generator owns every column except `review`, which a',
  '# human owns: set `approved` or `redo` and rerun to regenerate the rejects.',
  '#\titem\tlocale\tvoice\ttextHash\tfile\tdurationMs\tgenerated\treview',
].join('\n');

/** One ledger row, in the order `generate-audio.ts` writes them. */
const clip = (
  item: string,
  review: string,
  { locale = 'es-ES', voice = 'lucia', hash = '9f3ab27c' } = {},
) =>
  [
    item,
    locale,
    voice,
    hash,
    `audio/${locale}/${voice}/${item}-${hash}.m4a`,
    '2180',
    '2026-08-23',
    review,
  ].join('\t');

describe('canonical audio', () => {
  let scratch: ScratchPack | undefined;

  afterEach(() => scratch?.dispose());

  it('ships nothing at all when there is no ledger', () => {
    // The pack as it stands today. Audio is additive, so the absence of a ledger
    // has to be indistinguishable from the feature not existing.
    scratch = createScratchPack('audio-none');
    scratch.build();

    const manifest = JSON.parse(
      readFileSync(packManifestPath(scratch.packs), 'utf8'),
    ) as PackManifest;
    expect(manifest.files.some((file) => file.kind === 'audio')).toBe(false);
    expect(manifest.voices).toBeUndefined();
  });

  it('emits one file per locale, and only for approved clips', () => {
    /*
     * The rule the ledger exists for: a human owns the `review` column, so
     * anything not yet approved is work in progress rather than content. A build
     * that shipped `pending` clips would make the review step decorative.
     */
    scratch = createScratchPack('audio-approved');
    scratch.write(
      LEDGER,
      [
        header,
        clip('000001', 'approved'),
        clip('000002', 'pending'),
        clip('000003', 'redo'),
        clip('000004', 'failed'),
        clip('000001', 'approved', { locale: 'es-MX', voice: 'mateo' }),
      ].join('\n'),
    );
    scratch.build();

    const spain = scratch.records<AudioClip>('audio-es-ES');
    const mexico = scratch.records<AudioClip>('audio-es-MX');

    expect(spain).toHaveLength(1);
    expect(mexico).toHaveLength(1);
    expect(spain[0]).toMatchObject({
      item: 'core-es:item:000001',
      locale: 'es-ES',
      voice: 'lucia',
      textHash: '9f3ab27c',
      src: 'audio/es-ES/lucia/000001-9f3ab27c.m4a',
      durationMs: 2180,
    });

    // One audio file per locale, in locale order. Asserted through the shared
    // prefix rather than as two literals: the prefix carries the pack's level
    // range and moves when the content does, and what this test is about is the
    // per-locale split, not the range.
    const manifest = JSON.parse(
      readFileSync(packManifestPath(scratch.packs), 'utf8'),
    ) as PackManifest;
    const audio = manifest.files.filter((file) => file.kind === 'audio').map((file) => file.path);
    const prefix = audio[0]?.replace(/-audio-es-ES\.jsonl$/, '') ?? '';
    expect(prefix).toMatch(/^es-a1-[a-c][12]-core$/);
    expect(audio).toEqual([`${prefix}-audio-es-ES.jsonl`, `${prefix}-audio-es-MX.jsonl`]);
  });

  it('keys a clip by item, locale and voice — never by the text it speaks', () => {
    /*
     * An item keeps its id through a typo fix, so a re-recording of the same line
     * in the same voice fills the same slot. An id that moved with the wording
     * would mint a new clip every time a sentence was corrected, and nothing
     * would ever supersede the old one.
     */
    scratch = createScratchPack('audio-ids');
    scratch.write(LEDGER, [header, clip('000001', 'approved', { hash: 'aaaa1111' })].join('\n'));
    scratch.build();
    const first = scratch.records<AudioClip>('audio-es-ES')[0];

    scratch.write(LEDGER, [header, clip('000001', 'approved', { hash: 'bbbb2222' })].join('\n'));
    scratch.build();
    const second = scratch.records<AudioClip>('audio-es-ES')[0];

    expect(second?.id).toBe(first?.id);
    expect(second?.textHash).not.toBe(first?.textHash);
  });

  it('drops a clip whose item no longer exists rather than failing', () => {
    // A ledger row can outlive the sentence it spoke. That is a stale recording,
    // not a broken build — the alternative is a pack nobody can rebuild after a
    // row is deleted.
    scratch = createScratchPack('audio-stale');
    scratch.write(LEDGER, [header, clip('499999', 'approved')].join('\n'));
    scratch.build();

    const manifest = JSON.parse(
      readFileSync(packManifestPath(scratch.packs), 'utf8'),
    ) as PackManifest;
    expect(manifest.files.some((file) => file.kind === 'audio')).toBe(false);
  });

  it('declares each voice in the manifest, with its own licence', () => {
    /*
     * Generated speech is not automatically yours to redistribute, so a voice
     * carries its licence rather than inheriting the pack's — and the settings
     * picker needs a label that scanning the clip files could never supply.
     */
    scratch = createScratchPack('audio-voices');
    scratch.write(LEDGER, [header, clip('000001', 'approved')].join('\n'));
    scratch.write(
      VOICES,
      [
        '#\tid\tlocale\tlabel\tprovider\tlicense\treview',
        'lucia\tes-ES\tLucía\tpiper\tCC0-1.0\treviewed',
      ].join('\n'),
    );
    scratch.build();

    const manifest = JSON.parse(
      readFileSync(packManifestPath(scratch.packs), 'utf8'),
    ) as PackManifest;
    expect(manifest.voices).toEqual([
      {
        id: 'lucia',
        locale: 'es-ES',
        label: 'Lucía',
        provider: 'piper',
        license: 'CC0-1.0',
        review: 'reviewed',
      },
    ]);
  });
});
