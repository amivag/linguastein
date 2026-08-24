#!/usr/bin/env tsx
/**
 * Generates canonical audio for the pack, in resumable batches.
 *
 * Runs the pipeline of spec §6: synthesise → post-process → record in a ledger,
 * so a human can review a voice before anything ships. It never touches the
 * pack itself; `build-dataset.ts` reads the ledger and emits the audio records.
 *
 * Three rules from docs/tasks/canonical-audio.md are load-bearing here:
 *
 * 1. A clip is keyed by a hash of the text it speaks, never by item id alone.
 *    An item keeps its id through a typo fix (see `id-ledger.tsv`), so an
 *    id-named file would go on serving the old pronunciation for ever.
 * 2. Work is deduplicated on (text, locale, voice), not on item. `frío` ships
 *    as both a noun and an adjective card; that is one clip and two records.
 * 3. Every run is resumable. Free quotas run out and local models are slow, so
 *    the ledger is appended after each clip and a rerun does only what is left.
 *
 * Usage:
 *   tsx scripts/generate-audio.ts --provider <id> --voice <name> [options]
 *
 *   --provider <id>     stub | sapi | command   (see PROVIDERS)
 *   --voice <name>      provider-specific voice id; also the output directory
 *   --locale <tag>      pronunciation locale, default es-ES
 *   --sample            only the ~20 items that decide a voice (§4.1)
 *   --items <ids>       comma-separated local ids, e.g. 000201,500230
 *   --limit <n>         stop after n clips, to fit a quota or an evening
 *   --dry-run           report what would be generated; synthesise nothing
 *   --raw               skip ffmpeg post-processing (tests; not for shipping)
 *   --compare           write a blind A/B page over every sampled voice
 *   --out <dir>         output root; defaults per --sample
 *
 * Voices are compared, not trusted: generate the same sample on each candidate,
 * then `--compare` and listen without knowing which is which.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const PACKS_DIR = resolve(process.env['LINGUASTEIN_PACKS_DIR'] ?? 'public/packs');
const PACK_DIR = join(PACKS_DIR, 'core-es');
const CONTENT_DIR = resolve(process.env['LINGUASTEIN_CONTENT_DIR'] ?? 'content/es');

/** Overridable so a test can pin the date the ledger records. */
const TODAY = process.env['LINGUASTEIN_NOW'] ?? new Date().toISOString().slice(0, 10);

// ── options ─────────────────────────────────────────────────────────────────

interface Options {
  provider: string;
  voice: string;
  locale: string;
  sample: boolean;
  items: string[];
  limit: number;
  dryRun: boolean;
  raw: boolean;
  compare: boolean;
  out: string;
  ledger: string;
}

function parseOptions(argv: readonly string[]): Options {
  const flag = (name: string): string | undefined => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const has = (name: string): boolean => argv.includes(`--${name}`);

  const sample = has('sample');
  // Samples stay out of the pack: they are throwaway, and several voices' worth
  // of the same twenty items is not something to ship.
  const givenOut = flag('out');
  // Comparing is a sampling activity, so it looks where samples live unless
  // told otherwise — nobody typing `--compare` should have to add `--sample`.
  const samplesByDefault = sample || has('compare');
  const out = resolve(givenOut ?? (samplesByDefault ? 'audio-samples' : join(PACK_DIR, 'audio')));

  return {
    provider: flag('provider') ?? 'stub',
    voice: flag('voice') ?? 'default',
    locale: flag('locale') ?? 'es-ES',
    sample,
    items: (flag('items') ?? '').split(',').filter((id) => id.length > 0),
    limit: Number(flag('limit') ?? Number.POSITIVE_INFINITY),
    dryRun: has('dry-run'),
    raw: has('raw'),
    compare: has('compare'),
    out,
    // The shipping ledger lives in `content/es` because a human owns its review
    // column and it has to be committed — the clips themselves are ignored while
    // a voice is still being chosen. Anything writing elsewhere keeps its ledger
    // beside its output, so a sample or a test cannot touch the real one.
    ledger: resolve(
      flag('ledger') ??
        (sample || givenOut
          ? join(out, 'audio-ledger.tsv')
          : join(CONTENT_DIR, 'audio-ledger.tsv')),
    ),
  };
}

// ── the items that can be spoken ────────────────────────────────────────────

interface Item {
  readonly id: string;
  readonly localId: string;
  readonly text: string;
  readonly type: string;
  readonly register?: string;
  readonly regions?: readonly string[];
  readonly skills?: readonly string[];
}

/**
 * The spoken items, found through the manifest rather than by file name.
 *
 * These two paths used to be literals. A pack file's name carries the level
 * range of its content and the build derives that range from the content, so
 * the day B1 landed both literals pointed at files that no longer existed —
 * and `readItems` skips a missing file rather than failing, so this would have
 * gone on synthesising nothing and reporting success.
 */
function readItems(): Item[] {
  const manifestPath = join(PACK_DIR, 'pack.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    files?: readonly { readonly kind: string; readonly path: string }[];
  };
  const files = (manifest.files ?? [])
    .filter((file) => file.kind === 'items')
    .map((file) => file.path);

  const items: Item[] = [];
  for (const file of files) {
    const path = join(PACK_DIR, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (line.length === 0 || line.startsWith('#')) continue;
      const record = JSON.parse(line) as Item & { id: string };
      items.push({ ...record, localId: record.id.split(':').pop() ?? record.id });
    }
  }
  return items.sort((a, b) => a.localId.localeCompare(b.localId));
}

// ── the sample that decides a voice ─────────────────────────────────────────

/**
 * Twenty items chosen to expose the ways a Spanish voice goes wrong, rather
 * than twenty at random. Each criterion says what it is listening for, so the
 * dry run explains itself and a later reader can argue with the choices.
 */
const SAMPLE_CRITERIA: readonly { readonly why: string; readonly test: (item: Item) => boolean }[] =
  [
    { why: 'question intonation', test: (i) => i.text.includes('¿') },
    { why: 'exclamation', test: (i) => i.text.includes('¡') },
    {
      why: 'a command (newly generated forms)',
      test: (i) => (i.skills ?? []).some((s) => s.includes('imperative')),
    },
    { why: 'longest sentence — prosody over a clause boundary', test: () => false },
    { why: 'seseo vs distinción: z before a vowel', test: (i) => /z[aeiou]/i.test(i.text) },
    { why: 'seseo vs distinción: ce/ci', test: (i) => /c[ei]/i.test(i.text) },
    { why: 'll and y', test: (i) => /ll/i.test(i.text) },
    { why: 'ñ', test: (i) => /ñ/i.test(i.text) },
    { why: 'trilled rr', test: (i) => /rr/i.test(i.text) },
    { why: 'j and ge/gi', test: (i) => /j|g[ei]/i.test(i.text) },
    { why: 'regional vocabulary', test: (i) => (i.regions ?? []).length > 0 },
    { why: 'marked register', test: (i) => i.register !== undefined && i.register !== 'neutral' },
    { why: 'written accent on a stressed vowel', test: (i) => /[áéíóú]/i.test(i.text) },
    { why: 'a very short word card', test: (i) => i.type === 'word' && i.text.length <= 3 },
    { why: 'a long word card', test: (i) => i.type === 'word' && i.text.length >= 10 },
    {
      why: 'a word card with a written accent',
      test: (i) => i.type === 'word' && /[áéíóú]/i.test(i.text),
    },
  ];

interface Sampled extends Item {
  readonly why: string;
}

function pickSample(items: readonly Item[], size = 20): { sample: Sampled[]; unmet: string[] } {
  const picked = new Map<string, Sampled>();
  const unmet: string[] = [];
  const take = (item: Item | undefined, why: string): boolean => {
    if (!item || picked.has(item.id)) return false;
    picked.set(item.id, { ...item, why });
    return true;
  };

  for (const criterion of SAMPLE_CRITERIA) {
    if (criterion.why.startsWith('longest')) {
      const byLength = [...items].sort((a, b) => b.text.length - a.text.length);
      if (!byLength.some((item) => take(item, criterion.why))) unmet.push(criterion.why);
      continue;
    }
    // The first match may already be in the sample for another reason, so keep
    // looking — otherwise a criterion is silently dropped and the sample stops
    // covering what it claims to.
    const match = items.find((item) => criterion.test(item) && !picked.has(item.id));
    if (!take(match, criterion.why)) unmet.push(criterion.why);
  }

  // Fill the rest by walking the id-sorted list at an even stride, so the
  // sample is stable between runs and still spreads across the pack.
  const stride = Math.max(1, Math.floor(items.length / size));
  for (let at = 0; picked.size < size && at < items.length; at += stride) {
    take(items[at], 'spread across the pack');
  }
  return { sample: [...picked.values()], unmet };
}

// ── clip identity ───────────────────────────────────────────────────────────

/**
 * Eight hex characters of the spoken text. Short enough to read in a filename,
 * long enough that a collision across a few thousand clips is not a concern.
 */
const hashOf = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 8);

/**
 * A clip is named for the item that first needed it plus the hash of what it
 * says. When two items read the same, both records point at this one file, so
 * the id in the name is a readability convenience — the ledger holds the truth.
 */
const clipPath = (options: Options, item: Item, hash: string, extension: string): string =>
  join(options.out, options.locale, options.voice, `${item.localId}-${hash}.${extension}`);

/** Ledger paths are relative to the output root, so a pack stays portable. */
const relativeTo = (options: Options, path: string): string =>
  path.slice(options.out.length + 1).replaceAll('\\', '/');

// ── the ledger ──────────────────────────────────────────────────────────────

interface LedgerRow {
  item: string;
  locale: string;
  voice: string;
  textHash: string;
  file: string;
  durationMs: string;
  generated: string;
  review: string;
}

const LEDGER_COLUMNS: readonly (keyof LedgerRow)[] = [
  'item',
  'locale',
  'voice',
  'textHash',
  'file',
  'durationMs',
  'generated',
  'review',
];

const LEDGER_HEADER = [
  '# Generated clips. The generator owns every column except `review`, which a',
  '# human owns: set `approved` or `redo` and rerun to regenerate the rejects.',
  '# Unlike id-ledger.tsv this file is NOT purely generated — do not recreate it.',
  `#\t${LEDGER_COLUMNS.join('\t')}`,
].join('\n');

function readLedger(path: string): LedgerRow[] {
  if (!existsSync(path)) return [];
  const rows: LedgerRow[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.length === 0 || line.startsWith('#')) continue;
    const fields = line.split('\t');
    const row = Object.fromEntries(
      LEDGER_COLUMNS.map((column, at) => [column, fields[at] ?? '']),
    ) as unknown;
    rows.push(row as LedgerRow);
  }
  return rows;
}

function appendLedger(path: string, row: LedgerRow): void {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) writeFileSync(path, `${LEDGER_HEADER}\n`, 'utf8');
  // A human edits this file to approve or reject clips, and plenty of editors
  // strip the trailing newline on save. Without this, the next append would be
  // glued onto their last row and quietly corrupt it.
  const existing = readFileSync(path, 'utf8');
  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  appendFileSync(
    path,
    `${separator}${LEDGER_COLUMNS.map((column) => row[column]).join('\t')}\n`,
    'utf8',
  );
}

// ── providers ───────────────────────────────────────────────────────────────

interface SynthesisRequest {
  readonly text: string;
  readonly locale: string;
  readonly voice: string;
  /** Where to write a WAV. Post-processing converts it afterwards. */
  readonly out: string;
}

interface BatchProvider {
  readonly id: string;
  /** Why this provider cannot run, or undefined if it can. */
  unavailable(options: Options): string | undefined;
  synthesise(request: SynthesisRequest): void;
}

/**
 * A deterministic tone, not a voice: it exists so the pipeline is testable
 * without any TTS installed.
 *
 * Deliberately padded with 200 ms of silence at each end and kept quiet, so
 * post-processing has something to do and a test can prove it did it. Pure
 * silence would be worse than useless here — `silenceremove` eats it whole, and
 * an empty output looks identical to a broken filter chain.
 */
const STUB_PAD_SECONDS = 0.2;

const stubProvider: BatchProvider = {
  id: 'stub',
  unavailable: () => undefined,
  synthesise({ text, out }) {
    const rate = 16000;
    // 40 ms per character, so a longer phrase yields a longer file and the
    // duration column is at least plausible.
    const toneSamples = Math.max(1, Math.round(text.length * 0.04 * rate));
    const padSamples = Math.round(STUB_PAD_SECONDS * rate);
    const data = Buffer.alloc((padSamples * 2 + toneSamples) * 2);
    for (let at = 0; at < toneSamples; at += 1) {
      // Quiet on purpose: loudnorm should have to raise it.
      const value = Math.round(Math.sin((2 * Math.PI * 220 * at) / rate) * 2000);
      data.writeInt16LE(value, (padSamples + at) * 2);
    }
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(rate, 24);
    header.writeUInt32LE(rate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.concat([header, data]));
  },
};

/** Windows' built-in voices. Free and local, but rarely installed for Spanish. */
const sapiProvider: BatchProvider = {
  id: 'sapi',
  unavailable(options) {
    if (process.platform !== 'win32') return 'SAPI is Windows-only';
    const voices = sapiVoices();
    if (voices.length === 0)
      return `no installed SAPI voice speaks ${options.locale} — no SAPI voices found`;
    const language = options.locale.split('-')[0];
    const matching = voices.filter((voice) => voice.culture.startsWith(language ?? ''));
    if (matching.length === 0) {
      return (
        `no installed SAPI voice speaks ${options.locale} — found ${voices.map((v) => v.culture).join(', ')}. ` +
        'Refusing rather than reading Spanish with a voice from another language.'
      );
    }
    return undefined;
  },
  synthesise({ text, out, voice }) {
    mkdirSync(dirname(out), { recursive: true });
    // The text goes via a file: it contains accents, quotes and question marks,
    // none of which survive being interpolated into a PowerShell string.
    const textFile = `${out}.txt`;
    writeFileSync(textFile, text, 'utf8');
    const script = [
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      voice === 'default' ? '' : `$s.SelectVoice('${voice.replace(/'/g, "''")}')`,
      `$s.SetOutputToWaveFile('${out.replace(/'/g, "''")}')`,
      `$s.Speak([IO.File]::ReadAllText('${textFile.replace(/'/g, "''")}', [Text.Encoding]::UTF8))`,
      '$s.Dispose()',
    ]
      .filter((line) => line.length > 0)
      .join('; ');
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: 'pipe',
    });
  },
};

interface SapiVoice {
  name: string;
  culture: string;
}

function sapiVoices(): SapiVoice[] {
  if (process.platform !== 'win32') return [];
  const script =
    'Add-Type -AssemblyName System.Speech; ' +
    '(New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ' +
    'ForEach-Object { "$($_.VoiceInfo.Name)`t$($_.VoiceInfo.Culture)" }';
  const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return [];
  return result.stdout
    .split('\n')
    .map((line) => line.trim().split('\t'))
    .filter((fields) => fields.length === 2)
    .map(([name, culture]) => ({ name: name ?? '', culture: culture ?? '' }));
}

/**
 * Any CLI, configured rather than coded, so installing a local model is a
 * config line instead of a new provider. Placeholders: {out} {voice} {locale}
 * {textFile}; the text also arrives on stdin.
 *
 *   LINGUASTEIN_TTS_COMMAND="piper --model {voice} --output_file {out}"
 */
const commandProvider: BatchProvider = {
  id: 'command',
  unavailable: () =>
    process.env['LINGUASTEIN_TTS_COMMAND']
      ? undefined
      : 'set LINGUASTEIN_TTS_COMMAND to the synthesis command, e.g. "piper --model {voice} --output_file {out}"',
  synthesise({ text, out, voice, locale }) {
    mkdirSync(dirname(out), { recursive: true });
    const textFile = `${out}.txt`;
    writeFileSync(textFile, text, 'utf8');
    const template = process.env['LINGUASTEIN_TTS_COMMAND'] ?? '';
    const parts = template
      .split(' ')
      .filter((part) => part.length > 0)
      .map((part) =>
        part
          .replaceAll('{out}', out)
          .replaceAll('{voice}', voice)
          .replaceAll('{locale}', locale)
          .replaceAll('{textFile}', textFile),
      );
    const [command, ...args] = parts;
    if (!command) throw new Error('LINGUASTEIN_TTS_COMMAND is empty');
    const result = spawnSync(command, args, { input: text, stdio: ['pipe', 'pipe', 'pipe'] });
    if (result.status !== 0) {
      throw new Error(`${command} failed: ${result.stderr?.toString() ?? 'no stderr'}`);
    }
  },
};

const PROVIDERS: readonly BatchProvider[] = [stubProvider, sapiProvider, commandProvider];

// ── post-processing ─────────────────────────────────────────────────────────

/**
 * Trims silence from both ends and normalises loudness. This matters more to
 * perceived quality than the voice does: 300 ms of dead air at the front makes
 * listen-and-repeat feel like a broken button, and clips that differ in level
 * make a learner ride the volume control — worse still once two voices are
 * mixed in one dialogue.
 */
const TRIM_AND_NORMALISE = [
  'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB',
  'areverse',
  'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB',
  'areverse',
  'loudnorm=I=-16:TP=-1.5:LRA=11',
].join(',');

/**
 * 24 kHz mono. `loudnorm` resamples to 192 kHz internally and will happily
 * leave the output there, which produced 96 kHz clips of a 16 kHz source —
 * bigger files carrying no more speech. Pinning the rate also stops two voices
 * with different native rates from landing in the pack at different qualities.
 */
const SPEECH_RATE_HZ = process.env['LINGUASTEIN_AUDIO_RATE'] ?? '24000';

function postProcess(wav: string, out: string): void {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      wav,
      '-af',
      TRIM_AND_NORMALISE,
      '-ac',
      '1',
      '-ar',
      SPEECH_RATE_HZ,
      '-c:a',
      'aac',
      '-b:a',
      '48k',
      out,
    ],
    { stdio: 'pipe' },
  );
}

function durationMsOf(file: string): number {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  );
  const seconds = Number.parseFloat(result.stdout?.trim() ?? '');
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
}

// ── the blind comparison page ───────────────────────────────────────────────

/**
 * One row per sampled phrase, with every voice's take on it in an order that
 * varies per row and hides which is which. Choosing a voice from a spec sheet
 * or a vendor demo reel is how you end up regenerating a thousand clips.
 */
function writeComparePage(options: Options): string | undefined {
  const root = join(options.out, options.locale);
  const voices = existsSync(root)
    ? readdirSync(root).filter((entry) => !entry.startsWith('.'))
    : [];
  if (voices.length === 0) return undefined;
  const items = readItems();
  const byLocalId = new Map(items.map((item) => [item.localId, item]));

  const clips = new Map<string, { voice: string; file: string }[]>();
  for (const voice of voices) {
    for (const file of readdirSync(join(root, voice))) {
      if (!/\.(m4a|wav)$/.test(file)) continue;
      const localId = basename(file).split('-')[0] ?? '';
      if (!clips.has(localId)) clips.set(localId, []);
      clips.get(localId)?.push({ voice, file: `${voice}/${file}` });
    }
  }

  const rows = [...clips.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([localId, takes], index) => {
      // Rotate rather than shuffle: blind, but reproducible without a seed.
      const rotated = takes.map((_, at) => takes[(at + index) % takes.length]);
      const players = rotated
        .map(
          (take, at) =>
            `<td><div class="take"><b>${String.fromCharCode(65 + at)}</b>` +
            // Relative to the page, which sits above the locale directory.
            `<audio controls preload="none" src="${options.locale}/${take?.file ?? ''}"></audio>` +
            `<span class="who" hidden>${take?.voice ?? ''}</span></div></td>`,
        )
        .join('');
      const text = byLocalId.get(localId)?.text ?? localId;
      return `<tr><th scope="row">${text}</th>${players}</tr>`;
    })
    .join('\n');

  const page = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Voice comparison — ${options.locale}</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 60rem; padding: 0 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid #ccc; padding: .5rem; text-align: left; vertical-align: top; }
  th[scope="row"] { font-weight: 600; width: 40%; }
  .take { display: flex; align-items: center; gap: .5rem; }
  audio { height: 2rem; }
  .who { font: 12px monospace; color: #555; }
</style>
<h1>Voice comparison — ${options.locale}</h1>
<p>${clips.size} phrases · ${voices.length} voice(s): the column a voice sits in
changes from row to row, so listen first and reveal afterwards.</p>
<p><button onclick="document.querySelectorAll('.who').forEach(e => e.hidden = !e.hidden)">Reveal / hide voices</button></p>
<table>${rows}</table>
</html>
`;
  const path = join(options.out, `compare-${options.locale}.html`);
  mkdirSync(options.out, { recursive: true });
  writeFileSync(path, page, 'utf8');
  return path;
}

// ── main ────────────────────────────────────────────────────────────────────

const options = parseOptions(process.argv.slice(2));

if (options.compare) {
  const path = writeComparePage(options);
  if (path === undefined) {
    console.error(
      `\nno clips under ${join(options.out, options.locale)} — generate a sample for at least ` +
        'one voice first:\n  npm run generate:audio -- --sample --provider <id> --voice <name>\n',
    );
    process.exit(1);
  }
  console.log(`\nwrote ${path}`);
  process.exit(0);
}

const provider = PROVIDERS.find((candidate) => candidate.id === options.provider);
if (!provider) {
  console.error(
    `unknown provider "${options.provider}" — have ${PROVIDERS.map((p) => p.id).join(', ')}`,
  );
  process.exit(1);
}

const allItems = readItems();
if (allItems.length === 0) {
  console.error(`no items in ${PACK_DIR} — run "npm run build:data" first`);
  process.exit(1);
}

const sampled = options.sample ? pickSample(allItems) : { sample: [], unmet: [] };

const queue: Sampled[] = options.sample
  ? sampled.sample
  : options.items.length > 0
    ? allItems
        .filter((item) => options.items.includes(item.localId))
        .map((item) => ({ ...item, why: 'requested' }))
    : allItems.map((item) => ({ ...item, why: 'full pack' }));

const ledger = options.ledger;
const existing = readLedger(ledger);

/** Items that already have a row for this exact text, voice and locale. */
const recorded = new Set(
  existing
    .filter((row) => row.review !== 'redo')
    .map((row) => `${row.item}\t${row.textHash}\t${row.locale}\t${row.voice}`),
);

/**
 * Clips that already exist on disk, by text rather than by item. This is what
 * makes two items that read the same share one file — and it has to be read
 * back from the ledger, not just tracked within a run, or a resumed batch would
 * synthesise the duplicate again.
 */
const synthesised = new Map<string, string>();
for (const row of existing) {
  if (row.file.length > 0 && row.review !== 'redo') {
    synthesised.set(`${row.textHash}\t${row.locale}\t${row.voice}`, row.file);
  }
}

interface Work {
  readonly item: Sampled;
  readonly hash: string;
  /** Set when another item's clip already says these words. */
  readonly reuse?: string;
}

const work: Work[] = [];
for (const item of queue) {
  const hash = hashOf(item.text);
  if (recorded.has(`${item.localId}\t${hash}\t${options.locale}\t${options.voice}`)) continue;
  const reuse = synthesised.get(`${hash}\t${options.locale}\t${options.voice}`);
  if (reuse) {
    work.push({ item, hash, reuse });
    continue;
  }
  // Claim it now so a later item in the same batch reuses it rather than
  // synthesising the same words twice.
  synthesised.set(
    `${hash}\t${options.locale}\t${options.voice}`,
    relativeTo(options, clipPath(options, item, hash, options.raw ? 'wav' : 'm4a')),
  );
  work.push({ item, hash });
}

const reused = work.filter((entry) => entry.reuse !== undefined);
const toSynthesise = work.filter((entry) => entry.reuse === undefined).slice(0, options.limit);
const characters = toSynthesise.reduce((total, entry) => total + entry.item.text.length, 0);

console.log(`\nprovider ${provider.id} · voice ${options.voice} · locale ${options.locale}`);
console.log(`  ${queue.length} item(s) in scope, ${existing.length} already in the ledger`);
console.log(`  ${toSynthesise.length} clip(s) to synthesise · ${characters} characters`);
console.log(
  `  ~${Math.round(characters / 14 + toSynthesise.length * 0.3)}s of audio · ledger ${ledger}`,
);
if (reused.length > 0) {
  console.log(`  ${reused.length} item(s) reuse another item's clip — same words, one file`);
}
const skipped = work.length - reused.length - toSynthesise.length;
if (skipped > 0)
  console.log(`  ${skipped} clip(s) beyond --limit ${options.limit}, left for the next run`);

if (options.sample) {
  console.log('\n  the sample, and what each item is listening for:');
  for (const entry of toSynthesise) {
    console.log(`    ${entry.item.localId}  ${entry.item.text.padEnd(38)} ${entry.item.why}`);
  }
  if (sampled.unmet.length > 0) {
    // A gap in the sample is a gap in the content: say so rather than quietly
    // shipping a comparison that cannot hear the thing it claims to test.
    console.log('\n  nothing in the pack exercises these, so the sample cannot test them:');
    for (const why of sampled.unmet) console.log(`    - ${why}`);
  }
}

if (options.dryRun) {
  console.log('\n--dry-run: nothing synthesised.\n');
  process.exit(0);
}

const why = provider.unavailable(options);
if (why) {
  console.error(`\n${provider.id} cannot run: ${why}\n`);
  process.exit(1);
}

let generated = 0;
let failed = 0;
for (const { item, hash } of toSynthesise) {
  const target = clipPath(options, item, hash, options.raw ? 'wav' : 'm4a');
  const wav = options.raw ? target : `${target}.tmp.wav`;
  try {
    provider.synthesise({
      text: item.text,
      locale: options.locale,
      voice: options.voice,
      out: wav,
    });
    if (!options.raw) postProcess(wav, target);
    // The intermediate WAV and the text handed to a CLI are scaffolding; leaving
    // them behind doubles the directory and confuses the compare page.
    for (const temporary of [options.raw ? '' : wav, `${wav}.txt`]) {
      if (temporary.length > 0 && existsSync(temporary)) rmSync(temporary);
    }
    appendLedger(ledger, {
      item: item.localId,
      locale: options.locale,
      voice: options.voice,
      textHash: hash,
      file: relativeTo(options, target),
      durationMs: String(durationMsOf(target)),
      generated: TODAY,
      review: 'unreviewed',
    });
    generated += 1;
    if (generated % 25 === 0) console.log(`  … ${generated}/${toSynthesise.length}`);
  } catch (error) {
    // Recorded rather than thrown: a quota rejection or one bad phrase should
    // not cost the rest of the batch, and a rerun retries only the failures.
    failed += 1;
    appendLedger(ledger, {
      item: item.localId,
      locale: options.locale,
      voice: options.voice,
      textHash: hash,
      file: '',
      durationMs: '0',
      generated: TODAY,
      review: `failed: ${(error as Error).message.split('\n')[0] ?? 'unknown'}`,
    });
  }
}

// Items that share another item's words still need their own record, pointing at
// the one file. Written after synthesis so a clip claimed by this batch exists.
for (const { item, hash, reuse } of reused) {
  appendLedger(ledger, {
    item: item.localId,
    locale: options.locale,
    voice: options.voice,
    textHash: hash,
    file: reuse ?? '',
    durationMs: String(durationMsOf(join(options.out, reuse ?? ''))),
    generated: TODAY,
    review: 'unreviewed',
  });
}

console.log(
  `\n  ${generated} generated, ${failed} failed → ${join(options.out, options.locale, options.voice)}`,
);
if (reused.length > 0) console.log(`  ${reused.length} record(s) written against a shared clip`);
if (failed > 0) console.log('  rerun to retry the failures; they are marked in the ledger.');
console.log();
