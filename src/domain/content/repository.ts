/**
 * The normalised in-memory language model: packs go in, indexed lookups come
 * out. This is the only thing feature code should read content through, so
 * that the storage format (JSONL today, anything later) stays an implementation
 * detail of the data layer.
 */

import { byLetter, initialLetter } from './alphabet';
import type { PartOfSpeech } from './annotation';
import { STUDYABLE_POS } from './annotation';
import type { FormId, ItemId, LexemeId, PackId, PassageId, SenseId, SkillId } from './ids';
import { moodOf, type SentenceMood } from './mood';
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
  InflectedForm,
  Translation,
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

/** A letter of the alphabet plus how many items in scope file under it. */
export interface InitialFacet {
  readonly letter: string;
  readonly count: number;
}

/** A region plus how many items in scope are specifically marked for it. */
export interface RegionFacet {
  readonly locale: LanguageTag;
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
  /**
   * Asking, telling or exclaiming — a form, not a theme.
   *
   * Beside `address` and `register` rather than in `topics`, because "the
   * questions" is a grammatical set and `questions` the topic is a subject. A
   * word card carries no mood and is excluded by any value here, which is the
   * whole reason {@link moodOf} takes the item and not the text.
   */
  readonly moods?: readonly SentenceMood[];
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
  /**
   * Items filing under one letter — `C` for both `café` and `Cerveza`.
   *
   * A bucket rather than a prefix, and normalised through `initialLetter` on the
   * way in, so a link saying `initial=c` and a chip saying `Ç` mean what the
   * content means. Not a substitute for {@link search}: `A` is where a learner
   * starts reading a list, not something they typed.
   */
  readonly initial?: string;
}

const EMPTY: readonly never[] = [];

export class ContentRepository {
  private readonly packsById = new Map<PackId, PackManifest>();
  private readonly itemsById = new Map<ItemId, LearningItem>();
  private readonly lexemesById = new Map<LexemeId, Lexeme>();
  private readonly sensesById = new Map<SenseId, Sense>();
  private readonly formsById = new Map<FormId, InflectedForm>();
  private readonly skillsById = new Map<SkillId, Skill>();
  /** ref → language tag → translation */
  private readonly translationsByRef = new Map<string, Map<LanguageTag, Translation>>();
  private readonly itemsByLexeme = new Map<LexemeId, ItemId[]>();
  private readonly itemsBySkill = new Map<SkillId, ItemId[]>();
  private readonly formsByLexeme = new Map<LexemeId, FormId[]>();
  /**
   * Normalised surface → every lexeme it can be, so a word a learner *typed*
   * can be resolved.
   *
   * The only index here that answers a question from outside the dataset. Every
   * other one starts from an id the app already holds — a token carries its
   * `lexeme` because `build-dataset.ts` resolved the surface at build time, and
   * `inspectToken` needs no lookup at all. A search box has neither an item nor
   * a token id, only a string, and nothing in the app could turn one into the
   * other.
   *
   * A list rather than one lexeme, because a surface is genuinely ambiguous:
   * `entre` is a preposition and `entrar`'s subjunctive, and `frío` is a noun
   * beside an adjective. The build picks a reading from the words either side of
   * it (`disambiguate`); a query has no context to pick from, so every reading
   * is returned and the caller shows them all. Guessing here would be the one
   * failure mode worse than an error, which is being confidently wrong.
   */
  private readonly lexemesBySurface = new Map<string, LexemeId[]>();
  /**
   * Language → its translations, so a meaning can be searched *backwards*.
   *
   * `translationsByRef` answers "what does this mean", which is the direction
   * every screen has needed until now. A learner who knows the English and wants
   * the Spanish is asking the opposite, and no index answered it: Browse's
   * search box has claimed to search both languages since it shipped while
   * `ItemFilter.search` only ever matched `item.text`.
   */
  private readonly translationsByLanguage = new Map<LanguageTag, Translation[]>();
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

    for (const lexeme of pack.lexemes) {
      this.lexemesById.set(lexeme.id, lexeme);
      this.indexSurface(lexeme.lemma, lexeme.id);
    }
    for (const sense of pack.senses) this.sensesById.set(sense.id, sense);
    for (const skill of pack.skills) this.skillsById.set(skill.id, skill);

    for (const form of pack.forms) {
      this.formsById.set(form.id, form);
      push(this.formsByLexeme, form.lexeme, form.id);
      // Both halves of the paradigm are searchable, because a learner types the
      // word they met: `tengo` far more often than `tener`. The surfaces were
      // always derivable from these records — the build already drives its own
      // index from them, which is what keeps "what a learner can be shown" and
      // "what a sentence can link to" from drifting apart.
      this.indexSurface(form.form, form.lexeme);
    }

    for (const item of pack.items) {
      if (!this.itemsById.has(item.id)) this.itemOrder.push(item.id);
      this.itemsById.set(item.id, item);
      // Both places a lexeme can be named, de-duplicated across them.
      //
      // A multi-word headword is named by an *annotation* rather than by
      // `lexemes` — `por qué` spans two tokens, and `Annotation.lexeme` is where
      // that is recorded. Without the second source, "which phrases use this
      // word" answered nothing for every such entry: `por qué` had a gloss, no
      // examples, and looked to any scope check like a word no pack uses. A set
      // because a phrase may name the same lexeme both ways, and a duplicate
      // here becomes one example listed twice.
      const named = new Set<LexemeId>(item.lexemes ?? EMPTY);
      for (const annotation of item.annotations ?? EMPTY) {
        if (annotation.lexeme) named.add(annotation.lexeme);
      }
      for (const lexeme of named) push(this.itemsByLexeme, lexeme, item.id);
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
      // The reverse list keeps *every* translation, including the alternatives
      // the forward map drops. A learner searching their own language should
      // find a word through any of its meanings, and the second gloss of a word
      // is exactly the one they are least likely to guess the first spelling of.
      push(this.translationsByLanguage, translation.lang, translation);
    }
  }

  /** Records a surface a lexeme can appear as, folded the way a query will be. */
  private indexSurface(surface: string, lexeme: LexemeId): void {
    const key = normalise(surface);
    if (!key) return;
    const existing = this.lexemesBySurface.get(key);
    if (!existing) {
      this.lexemesBySurface.set(key, [lexeme]);
      return;
    }
    // A lemma that is also one of its own forms — every infinitive, every
    // singular noun — would otherwise list the same word twice.
    if (!existing.includes(lexeme)) existing.push(lexeme);
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

  /**
   * Every headword the loaded packs declare, in pack order.
   *
   * For the searches an index cannot serve: a prefix or a partial, where the key
   * is not known in advance. Small enough to scan — the shipped pack has 663 —
   * and a scan that is honest about being one beats a second index to keep in
   * step with this one.
   */
  allLexemes(): readonly Lexeme[] {
    return [...this.lexemesById.values()];
  }

  /**
   * The lexemes a written surface can be: `tengo` → `tener`, `entre` →
   * `entre` the preposition *and* `entrar`.
   *
   * Case- and accent-insensitive, so `esta` finds `está`. See
   * {@link lexemesBySurface} for why this returns a list.
   */
  lexemesOfSurface(surface: string): readonly LexemeId[] {
    return this.lexemesBySurface.get(normalise(surface)) ?? EMPTY;
  }

  /** Every translation into a language, for a search that starts from a meaning. */
  translationsIn(language: LanguageTag): readonly Translation[] {
    return this.translationsByLanguage.get(language) ?? EMPTY;
  }

  getSense(id: SenseId): Sense | undefined {
    return this.sensesById.get(id);
  }

  getSkill(id: SkillId): Skill | undefined {
    return this.skillsById.get(id);
  }

  /** Skills in load order, for a picker that offers what the packs actually teach. */
  allSkills(): readonly Skill[] {
    return [...this.skillsById.values()];
  }

  /**
   * Resolves a skill reference — `preterite`, or `core-es:preterite` when a link
   * needs to say which pack. See {@link resolveRef} for why both are accepted
   * and why an ambiguous bare reference resolves to nothing.
   */
  skillByRef(ref: string): Skill | undefined {
    const found = this.resolveSkill(ref);
    return found.kind === 'found' ? found.value : undefined;
  }

  /** As {@link skillByRef}, but says *why* when it did not resolve. */
  resolveSkill(ref: string): RefResolution<Skill> {
    return resolveRef(this.allSkills(), 'skill', ref);
  }

  getForm(id: FormId): InflectedForm | undefined {
    return this.formsById.get(id);
  }

  /**
   * The language an item's text is in: the language of the pack that published
   * it.
   *
   * Read off the pack rather than the course, because the two can differ on any
   * screen that shows content from outside what is currently being studied — a
   * progress list, a search result, a mission that survived a course switch. It
   * is what `lang` on rendered text should carry, and `undefined` when the item
   * came from a pack that is no longer loaded, so a caller falls back rather
   * than tagging text with a guess.
   */
  languageOfItem(item: LearningItem): LanguageTag | undefined {
    return this.packsById.get(item.pack)?.targetLanguage;
  }

  /** Items in stable pack order — the basis for sequential practice. */
  allItems(): readonly LearningItem[] {
    return this.itemOrder.map((id) => this.itemsById.get(id)).filter(isDefined);
  }

  /**
   * Resolves the stable local part of an item id for curriculum references.
   * Like passage and skill local ids, the first loaded match wins.
   */
  itemByLocalId(local: string): LearningItem | undefined {
    return this.allItems().find((item) => item.id.endsWith(`:item:${local}`));
  }

  getPassage(id: PassageId): Passage | undefined {
    return this.passagesById.get(id);
  }

  /** Passages in stable pack order. */
  allPassages(): readonly Passage[] {
    return this.passageOrder.map((id) => this.passagesById.get(id)).filter(isDefined);
  }

  /**
   * Resolves a passage reference — `700001`, or `core-es:700001` when a link
   * needs to say which pack. See {@link resolveRef}.
   */
  passageByRef(ref: string): Passage | undefined {
    const found = this.resolvePassage(ref);
    return found.kind === 'found' ? found.value : undefined;
  }

  /** As {@link passageByRef}, but says *why* when it did not resolve. */
  resolvePassage(ref: string): RefResolution<Passage> {
    return resolveRef(this.allPassages(), 'passage', ref);
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

  formsOf(id: LexemeId): readonly InflectedForm[] {
    return (this.formsByLexeme.get(id) ?? EMPTY)
      .map((formId) => this.formsById.get(formId))
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
   * Reference languages meanings are actually available in, in load order.
   *
   * Counted rather than claimed, for the reason `packs.ts` counts everything
   * else: a manifest can list a language whose translations file was never
   * written, and offering that in the picker gives a learner a setting that
   * silently shows them nothing. What is in the index is what can be read.
   */
  translationLanguages(): readonly LanguageTag[] {
    const languages = new Set<LanguageTag>();
    for (const byLanguage of this.translationsByRef.values()) {
      for (const language of byLanguage.keys()) languages.add(language);
    }
    return [...languages];
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
    const initial = filter.initial ? initialLetter(filter.initial) : undefined;
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
      if (filter.moods?.length) {
        const mood = moodOf(item);
        if (!mood || !filter.moods.includes(mood)) return false;
      }
      if (filter.usableIn && !isUsableIn(item.regions, filter.usableIn)) return false;
      if (filter.topics?.length && !overlaps(item.topics, filter.topics)) return false;
      if (filter.tags?.length && !overlaps(item.tags, filter.tags)) return false;
      if (filter.lexemes?.length && !overlaps(item.lexemes, filter.lexemes)) return false;
      if (filter.pos?.length && !this.exemplifies(item, filter.pos)) return false;
      if (filter.skills?.length && !overlaps(item.skills, filter.skills)) return false;
      if (search && !normalise(item.text).includes(search)) return false;
      if (initial && initialLetter(item.text) !== initial) return false;
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
   * The letters the content in scope actually starts with, in the order the
   * language collates them — `Ñ` after N for Spanish, from the collator rather
   * than from an alphabet typed out here.
   *
   * Derived and counted like {@link topics} and {@link partsOfSpeech}, for the
   * same reason: an A–Z row printed in full is twenty-six taps of which a third
   * lead nowhere, and a pack that grows its first K gets the chip with no code
   * change. Counted over whatever scope it is given, so the counts describe the
   * course rather than the search a learner is halfway through typing.
   */
  initials(filter: ItemFilter = {}, locale?: LanguageTag): readonly InitialFacet[] {
    const counts = new Map<string, number>();
    for (const item of this.query(filter)) {
      const letter = initialLetter(item.text);
      counts.set(letter, (counts.get(letter) ?? 0) + 1);
    }
    const order = byLetter(locale);
    return [...counts]
      .map(([letter, count]): InitialFacet => ({ letter, count }))
      .sort((a, b) => order(a.letter, b.letter));
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

  /**
   * Regions the content in scope is *specifically* marked for, and how many
   * items each has.
   *
   * Counted on declared regions rather than on what `usableIn` would return,
   * which is the whole point: region-neutral content is usable everywhere, so
   * filtering to Argentina passes almost the entire pack and a caller counting
   * that way would find every region equally populous. What a picker needs to
   * know is where there is something *particular to* a place — otherwise it
   * offers a filter that silently does nothing, which reads to a learner as
   * "all of this is Argentinian".
   *
   * A locale is reported when content covering it exists, so `papa` marked
   * `es-419` counts towards Mexico and Argentina alike, exactly as it counts
   * when the filter runs.
   */
  regions(filter: ItemFilter = {}, offered: readonly LanguageTag[]): readonly RegionFacet[] {
    const counts = new Map<LanguageTag, number>();
    for (const item of this.query(filter)) {
      if (!item.regions?.length) continue;
      for (const locale of offered) {
        if (isUsableIn(item.regions, locale)) counts.set(locale, (counts.get(locale) ?? 0) + 1);
      }
    }
    return offered
      .map((locale) => ({ locale, count: counts.get(locale) ?? 0 }))
      .filter((facet) => facet.count > 0);
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

/**
 * Punctuation, as one definition rather than one per caller.
 *
 * Three places already split a phrase into words — speech comparison, exercise
 * generation and grading — and each carried its own character class. A `¿`
 * missing from one of them is a learner told they were wrong, so the set is
 * written once.
 *
 * The second row is the same fact in scripts the app does not ship yet. It costs
 * nothing to have and is invisible when it is missing, which is the bad
 * combination: `。` absent from this class does not fail a build, it makes a full
 * stop into a tappable word and a correctly spoken sentence into a wrong answer,
 * because `splitWords` leaves it stuck to the last word for a recogniser that
 * will never return it. Greek's `·` and `;`-as-question-mark are the same story.
 * The Latin half of a CJK pack — a stray `,` in a loanword — is covered by the
 * first row, so the two are additive rather than alternative.
 */
const PUNCTUATION = /[.,!?;:¡¿"“”«»()…—–]|[。、，！？：；「」『』（）〈〉《》〔〕【】·]/g;

/** True for a token that is punctuation and nothing else, such as a bare `,`. */
export function isPunctuation(text: string): boolean {
  return text.trim().length > 0 && text.replace(PUNCTUATION, '').trim().length === 0;
}

/** The words of a phrase, punctuation dropped. Case and accents are untouched. */
export function splitWords(text: string): readonly string[] {
  return text
    .replace(PUNCTUATION, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * How a content reference resolved — found, ambiguous, or nothing.
 *
 * Ambiguity is a *distinct* outcome rather than a miss, because the two need
 * different words on screen: "no pack has this" tells a learner their link is
 * wrong, while "two packs have this" tells them the link is under-specified, and
 * only the second is fixable by qualifying it.
 */
export type RefResolution<T> =
  | { readonly kind: 'found'; readonly value: T }
  | { readonly kind: 'ambiguous'; readonly packs: readonly string[] }
  | { readonly kind: 'missing' };

/**
 * Resolves `local` or `pack:local` against records whose ids are
 * `<pack>:<kind>:<local>`.
 *
 * A URL carries the **local** part by design — `?skill=preterite`,
 * `/read/700001` — so a shared link does not haul a pack namespace it will
 * outlive. That was free while one pack shipped. It stops being free the moment
 * a second one does: id ranges are partitioned by *kind* rather than by pack, so
 * two independently authored Spanish packs both start their passages at `700001`
 * and both want `preterite` as a skill slug. Collision is the default, not the
 * exception.
 *
 * This used to be `find(id => id.endsWith(':passage:' + local))`, which returns
 * whichever pack loaded first — confidently the wrong text, which is worse than
 * an error because nothing announces it. So:
 *
 * - **Qualified** (`core-es:700001`) resolves inside that pack only, and is
 *   portable: it means the same thing on a device with a different pack set.
 * - **Bare** (`700001`) resolves while exactly one pack claims it, which keeps
 *   every link written before this change working.
 * - **Bare and contested** resolves to `ambiguous`, naming the packs. Never to a
 *   guess — the same rule `disambiguate` follows when it declines to pick a
 *   lexeme, and for the same reason.
 *
 * Local ids cannot contain `:` (see `LOCAL` in `ids.ts`), so the first colon is
 * unambiguously the pack separator.
 */
function resolveRef<T extends { readonly id: string }>(
  entries: readonly T[],
  kind: string,
  ref: string,
): RefResolution<T> {
  const trimmed = ref.trim();
  if (trimmed.length === 0) return { kind: 'missing' };

  const separator = trimmed.indexOf(':');
  if (separator !== -1) {
    const pack = trimmed.slice(0, separator);
    const local = trimmed.slice(separator + 1);
    const exact = entries.find((entry) => entry.id === `${pack}:${kind}:${local}`);
    return exact ? { kind: 'found', value: exact } : { kind: 'missing' };
  }

  const claimants = entries.filter((entry) => entry.id.endsWith(`:${kind}:${trimmed}`));
  if (claimants.length === 1) return { kind: 'found', value: claimants[0]! };
  if (claimants.length === 0) return { kind: 'missing' };
  return {
    kind: 'ambiguous',
    packs: claimants.map((entry) => entry.id.slice(0, entry.id.indexOf(':'))),
  };
}
