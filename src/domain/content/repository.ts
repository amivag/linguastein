/**
 * The normalised in-memory language model: packs go in, indexed lookups come
 * out. This is the only thing feature code should read content through, so
 * that the storage format (JSONL today, anything later) stays an implementation
 * detail of the data layer.
 */

import type { PartOfSpeech } from './annotation';
import { STUDYABLE_POS } from './annotation';
import type { ItemId, LexemeId, PackId, PassageId, SenseId, SkillId, VerbFormId } from './ids';
import {
  isUsableIn,
  type LanguageTag,
  resolveByLanguage,
  resolvePronunciationLocale,
} from './language';
import type {
  AddressForm,
  AudioClip,
  AudioRef,
  CefrLevel,
  ContentPack,
  ItemType,
  LearningItem,
  Lexeme,
  PackManifest,
  PackTopic,
  PackVoice,
  Passage,
  Register,
  Sense,
  Skill,
  Translation,
  VerbForm,
} from './model';

/** A declared category plus how many items currently carry it. */
export interface TopicFacet extends PackTopic {
  readonly count: number;
}

/** A part of speech plus how many items in scope exemplify one. */
export interface PosFacet {
  readonly pos: PartOfSpeech;
  readonly count: number;
}

export interface ItemFilter {
  readonly packs?: readonly PackId[];
  /**
   * Exactly these items, e.g. the sentences of one passage.
   *
   * Unlike the faceted filters below, an *empty* list means no items rather than
   * no constraint: it is an explicit allow-list, so an unresolved passage yields
   * an empty session instead of quietly practising the whole pack.
   */
  readonly ids?: readonly ItemId[];
  readonly types?: readonly ItemType[];
  readonly levels?: readonly CefrLevel[];
  readonly registers?: readonly Register[];
  /**
   * Keep only content usable where the learner is aiming. Region-neutral
   * content always passes; `es-419` content passes for any Latin American
   * locale.
   */
  readonly usableIn?: LanguageTag;
  readonly address?: readonly AddressForm[];
  readonly topics?: readonly string[];
  readonly tags?: readonly string[];
  readonly lexemes?: readonly LexemeId[];
  /**
   * Items exemplifying a lexeme of one of these parts of speech — "the verbs",
   * "the nouns", however many lexemes that turns out to be.
   *
   * Kind rather than identity, which is what makes it a category a learner can
   * pick: `lexemes` above answers "these exact words", and spelling "the verbs"
   * that way meant enumerating every verb lexeme in the pack at the call site,
   * so a second such set was a second enumeration.
   */
  readonly pos?: readonly PartOfSpeech[];
  readonly skills?: readonly SkillId[];
  /** Case/diacritic-insensitive substring match on the target-language text. */
  readonly search?: string;
}

const EMPTY: readonly never[] = [];

export class ContentRepository {
  private readonly packsById = new Map<PackId, PackManifest>();
  private readonly itemsById = new Map<ItemId, LearningItem>();
  private readonly lexemesById = new Map<LexemeId, Lexeme>();
  private readonly sensesById = new Map<SenseId, Sense>();
  private readonly verbFormsById = new Map<VerbFormId, VerbForm>();
  private readonly skillsById = new Map<SkillId, Skill>();
  /** ref → language tag → translation */
  private readonly translationsByRef = new Map<string, Map<LanguageTag, Translation>>();
  private readonly itemsByLexeme = new Map<LexemeId, ItemId[]>();
  private readonly itemsBySkill = new Map<SkillId, ItemId[]>();
  private readonly formsByLexeme = new Map<LexemeId, VerbFormId[]>();
  private readonly itemOrder: ItemId[] = [];
  private readonly passagesById = new Map<PassageId, Passage>();
  private readonly passageOrder: PassageId[] = [];
  /** item → the passages it reads as part of, so a sentence can point home. */
  private readonly passagesByItem = new Map<ItemId, PassageId[]>();
  /** item → every recording of it, across locales and voices. */
  private readonly clipsByItem = new Map<ItemId, AudioClip[]>();

  static from(packs: readonly ContentPack[]): ContentRepository {
    const repository = new ContentRepository();
    for (const pack of packs) repository.add(pack);
    return repository;
  }

  add(pack: ContentPack): void {
    this.packsById.set(pack.manifest.id, pack.manifest);

    for (const lexeme of pack.lexemes) this.lexemesById.set(lexeme.id, lexeme);
    for (const sense of pack.senses) this.sensesById.set(sense.id, sense);
    for (const skill of pack.skills) this.skillsById.set(skill.id, skill);

    for (const form of pack.verbForms) {
      this.verbFormsById.set(form.id, form);
      push(this.formsByLexeme, form.lexeme, form.id);
    }

    for (const item of pack.items) {
      if (!this.itemsById.has(item.id)) this.itemOrder.push(item.id);
      this.itemsById.set(item.id, item);
      for (const lexeme of item.lexemes ?? EMPTY) push(this.itemsByLexeme, lexeme, item.id);
      for (const skill of item.skills ?? EMPTY) push(this.itemsBySkill, skill, item.id);
    }

    for (const passage of pack.passages) {
      if (!this.passagesById.has(passage.id)) this.passageOrder.push(passage.id);
      this.passagesById.set(passage.id, passage);
      for (const item of passage.items) push(this.passagesByItem, item, passage.id);
    }

    for (const clip of pack.audio) push(this.clipsByItem, clip.item, clip);

    for (const translation of pack.translations) {
      let byLanguage = this.translationsByRef.get(translation.ref);
      if (!byLanguage) {
        byLanguage = new Map();
        this.translationsByRef.set(translation.ref, byLanguage);
      }
      // First translation of a language wins; alternatives are additive data
      // that the UI can request explicitly later.
      if (!byLanguage.has(translation.lang)) byLanguage.set(translation.lang, translation);
    }
  }

  get packs(): readonly PackManifest[] {
    return [...this.packsById.values()];
  }

  get itemCount(): number {
    return this.itemsById.size;
  }

  getPack(id: PackId): PackManifest | undefined {
    return this.packsById.get(id);
  }

  getItem(id: ItemId): LearningItem | undefined {
    return this.itemsById.get(id);
  }

  getLexeme(id: LexemeId): Lexeme | undefined {
    return this.lexemesById.get(id);
  }

  getSense(id: SenseId): Sense | undefined {
    return this.sensesById.get(id);
  }

  getSkill(id: SkillId): Skill | undefined {
    return this.skillsById.get(id);
  }

  getVerbForm(id: VerbFormId): VerbForm | undefined {
    return this.verbFormsById.get(id);
  }

  /** Items in stable pack order — the basis for sequential practice. */
  allItems(): readonly LearningItem[] {
    return this.itemOrder.map((id) => this.itemsById.get(id)).filter(isDefined);
  }

  getPassage(id: PassageId): Passage | undefined {
    return this.passagesById.get(id);
  }

  /** Passages in stable pack order. */
  allPassages(): readonly Passage[] {
    return this.passageOrder.map((id) => this.passagesById.get(id)).filter(isDefined);
  }

  /**
   * Resolves the local part of a passage id — `700001` for
   * `core-es:passage:700001` — which is what a route carries so URLs stay
   * readable. With several packs loaded the first match wins, so a shared route
   * is only unambiguous while local ids are.
   */
  passageByLocalId(local: string): Passage | undefined {
    return this.allPassages().find((passage) => passage.id.endsWith(`:passage:${local}`));
  }

  /** The passages a sentence reads as part of, usually none or one. */
  passagesOfItem(id: ItemId): readonly Passage[] {
    return (this.passagesByItem.get(id) ?? EMPTY)
      .map((passageId) => this.passagesById.get(passageId))
      .filter(isDefined);
  }

  /** A passage's sentences in reading order, skipping any that failed to load. */
  itemsOfPassage(id: PassageId): readonly LearningItem[] {
    const passage = this.passagesById.get(id);
    if (!passage) return EMPTY;
    return passage.items.map((itemId) => this.itemsById.get(itemId)).filter(isDefined);
  }

  itemsOfLexeme(id: LexemeId): readonly LearningItem[] {
    return (this.itemsByLexeme.get(id) ?? EMPTY)
      .map((itemId) => this.itemsById.get(itemId))
      .filter(isDefined);
  }

  itemsOfSkill(id: SkillId): readonly LearningItem[] {
    return (this.itemsBySkill.get(id) ?? EMPTY)
      .map((itemId) => this.itemsById.get(itemId))
      .filter(isDefined);
  }

  verbFormsOf(id: LexemeId): readonly VerbForm[] {
    return (this.formsByLexeme.get(id) ?? EMPTY)
      .map((formId) => this.verbFormsById.get(formId))
      .filter(isDefined);
  }

  /**
   * Translation for an entity in the learner's reference language, following
   * the fallback chain. `undefined` means target-language-only mode.
   */
  translationOf(ref: string, language: LanguageTag): Translation | undefined {
    const byLanguage = this.translationsByRef.get(ref);
    return byLanguage ? resolveByLanguage(byLanguage, language) : undefined;
  }

  /** All translations of an entity, e.g. to show literal next to natural. */
  translationsOf(ref: string): readonly Translation[] {
    return [...(this.translationsByRef.get(ref)?.values() ?? EMPTY)];
  }

  /**
   * Every recording of an item, from clip records and from anything the item
   * embeds directly. Both sources are supported on purpose: a generated pack
   * ships records so voices stay separable, while a small hand-authored pack can
   * keep two clips inline without a second file.
   */
  private refsOf(item: LearningItem): readonly AudioRef[] {
    const clips = this.clipsByItem.get(item.id) ?? EMPTY;
    if (clips.length === 0) return item.audio ?? EMPTY;
    const fromClips = clips.map((clip): AudioRef => ({
      locale: clip.locale,
      src: clip.src,
      voice: clip.voice,
      ...(clip.durationMs === undefined ? {} : { durationMs: clip.durationMs }),
      ...(clip.provenance === undefined ? {} : { provenance: clip.provenance }),
    }));
    return [...fromClips, ...(item.audio ?? EMPTY)];
  }

  /**
   * Best audio for the preferred pronunciation locale (spec §6), and the
   * preferred voice within it where one is asked for and available.
   *
   * Locale is resolved first: hearing the right language in the wrong voice
   * beats hearing the wrong accent because a voice name matched.
   */
  audioOf(
    item: LearningItem,
    preferredLocale: LanguageTag,
    preferredVoice?: string,
  ): AudioRef | undefined {
    const forLocale = this.audioVariantsOf(item, preferredLocale);
    if (forLocale.length === 0) return undefined;
    if (preferredVoice === undefined) return forLocale[0];
    return forLocale.find((entry) => entry.voice === preferredVoice) ?? forLocale[0];
  }

  /**
   * Every take of an item in the resolved locale, so the UI can offer a choice
   * and playback can vary voices deliberately. Order is stable, which matters:
   * varying the voice per review has to be reproducible under a session seed.
   */
  audioVariantsOf(item: LearningItem, preferredLocale: LanguageTag): readonly AudioRef[] {
    const refs = this.refsOf(item);
    if (refs.length === 0) return EMPTY;
    const locale = resolvePronunciationLocale(
      refs.map((entry) => entry.locale),
      preferredLocale,
    );
    return refs.filter((entry) => entry.locale === locale);
  }

  /**
   * Voices the loaded packs ship clips for, optionally narrowed to one locale.
   * The settings picker lists these alongside the device's own voices.
   */
  packVoices(locale?: LanguageTag): readonly PackVoice[] {
    const voices = [...this.packsById.values()].flatMap((manifest) => manifest.voices ?? EMPTY);
    return locale === undefined ? voices : voices.filter((voice) => voice.locale === locale);
  }

  query(filter: ItemFilter = {}): readonly LearningItem[] {
    const search = filter.search ? normalise(filter.search) : undefined;
    return this.allItems().filter((item) => {
      if (filter.packs?.length && !filter.packs.includes(item.pack)) return false;
      if (filter.ids && !filter.ids.includes(item.id)) return false;
      if (filter.types?.length && !filter.types.includes(item.type)) return false;
      if (filter.levels?.length && !(item.level && filter.levels.includes(item.level)))
        return false;
      // Unmarked content counts as neutral: most phrases carry no register.
      if (filter.registers?.length && !filter.registers.includes(item.register ?? 'neutral')) {
        return false;
      }
      if (filter.address?.length && !(item.address && filter.address.includes(item.address))) {
        return false;
      }
      if (filter.usableIn && !isUsableIn(item.regions, filter.usableIn)) return false;
      if (filter.topics?.length && !overlaps(item.topics, filter.topics)) return false;
      if (filter.tags?.length && !overlaps(item.tags, filter.tags)) return false;
      if (filter.lexemes?.length && !overlaps(item.lexemes, filter.lexemes)) return false;
      if (filter.pos?.length && !this.exemplifies(item, filter.pos)) return false;
      if (filter.skills?.length && !overlaps(item.skills, filter.skills)) return false;
      if (search && !normalise(item.text).includes(search)) return false;
      return true;
    });
  }

  /**
   * The parts of speech this item exemplifies, through the lexemes it is
   * annotated with. Derived rather than indexed: a lexeme reached through a
   * `Map` is cheap, and an index would have to be rebuilt whenever a pack
   * arrived after the items referencing it.
   */
  private posOf(item: LearningItem): ReadonlySet<PartOfSpeech> {
    const tags = new Set<PartOfSpeech>();
    for (const lexemeId of item.lexemes ?? EMPTY) {
      const pos = this.lexemesById.get(lexemeId)?.pos;
      if (pos) tags.add(pos);
    }
    return tags;
  }

  private exemplifies(item: LearningItem, wanted: readonly PartOfSpeech[]): boolean {
    const tags = this.posOf(item);
    return wanted.some((pos) => tags.has(pos));
  }

  /**
   * The word kinds a learner can narrow to, with a count in this scope.
   *
   * Counted rather than merely listed, for the reason {@link topics} is: a
   * picker has to be able to drop a category that would lead nowhere, and
   * working that out separately from the options is how the two drift apart.
   * Only {@link STUDYABLE_POS} is offered — see there for why `DET` is not a
   * category anyone would ask for.
   */
  partsOfSpeech(filter: ItemFilter = {}): readonly PosFacet[] {
    const counts = new Map<PartOfSpeech, number>();
    for (const item of this.query(filter)) {
      for (const pos of this.posOf(item)) counts.set(pos, (counts.get(pos) ?? 0) + 1);
    }
    return STUDYABLE_POS.map((pos) => ({ pos, count: counts.get(pos) ?? 0 })).filter(
      (facet) => facet.count > 0,
    );
  }

  /**
   * The thematic categories of the loaded packs, with a count of the items in
   * each, in the order the packs declare them.
   *
   * Counts are part of the result rather than a caller's job: a picker has to
   * be able to hide a category that is registered but empty, and computing
   * that separately from the labels is how the two drift apart.
   */
  topics(filter: ItemFilter = {}): readonly TopicFacet[] {
    const counts = new Map<string, number>();
    for (const item of this.query(filter)) {
      for (const topic of item.topics ?? EMPTY) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }

    const declared = [...this.packsById.values()].flatMap((manifest) => manifest.topics ?? EMPTY);
    const seen = new Set<string>();
    const facets: TopicFacet[] = [];

    for (const topic of declared) {
      if (seen.has(topic.id)) continue;
      seen.add(topic.id);
      facets.push({ ...topic, count: counts.get(topic.id) ?? 0 });
    }

    // A pack that declares no registry, or content tagged with a topic the
    // registry has since dropped, still has to be browsable — so fall back to
    // the slug as its own label rather than making the category disappear.
    for (const [id, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
      if (!seen.has(id)) facets.push({ id, label: id.replace(/-/g, ' '), count });
    }

    return facets;
  }

  /** Distinct values available for building filter UIs. */
  facets(filter: ItemFilter = {}): {
    levels: readonly CefrLevel[];
    topics: readonly string[];
    types: readonly ItemType[];
  } {
    const levels = new Set<CefrLevel>();
    const topics = new Set<string>();
    const types = new Set<ItemType>();
    for (const item of this.query(filter)) {
      if (item.level) levels.add(item.level);
      for (const topic of item.topics ?? EMPTY) topics.add(topic);
      types.add(item.type);
    }
    return {
      levels: [...levels].sort(),
      topics: [...topics].sort(),
      types: [...types].sort(),
    };
  }
}

function push<K, V>(index: Map<K, V[]>, key: K, value: V): void {
  const existing = index.get(key);
  if (existing) existing.push(value);
  else index.set(key, [value]);
}

function overlaps<T>(values: readonly T[] | undefined, wanted: readonly T[]): boolean {
  return values !== undefined && values.some((value) => wanted.includes(value));
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/** Lowercase and strip diacritics so `esta` matches `está`. */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
