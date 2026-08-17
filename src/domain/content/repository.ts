/**
 * The normalised in-memory language model: packs go in, indexed lookups come
 * out. This is the only thing feature code should read content through, so
 * that the storage format (JSONL today, anything later) stays an implementation
 * detail of the data layer.
 */

import type { ItemId, LexemeId, PackId, SenseId, SkillId, VerbFormId } from './ids';
import {
  isUsableIn,
  type LanguageTag,
  resolveByLanguage,
  resolvePronunciationLocale,
} from './language';
import type {
  AddressForm,
  AudioRef,
  CefrLevel,
  ContentPack,
  ItemType,
  LearningItem,
  Lexeme,
  PackManifest,
  Register,
  Sense,
  Skill,
  Translation,
  VerbForm,
} from './model';

export interface ItemFilter {
  readonly packs?: readonly PackId[];
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

  /** Best audio for the preferred pronunciation locale (spec §6). */
  audioOf(item: LearningItem, preferredLocale: LanguageTag): AudioRef | undefined {
    const audio = item.audio ?? EMPTY;
    if (audio.length === 0) return undefined;
    const locale = resolvePronunciationLocale(
      audio.map((entry) => entry.locale),
      preferredLocale,
    );
    return audio.find((entry) => entry.locale === locale);
  }

  query(filter: ItemFilter = {}): readonly LearningItem[] {
    const search = filter.search ? normalise(filter.search) : undefined;
    return this.allItems().filter((item) => {
      if (filter.packs?.length && !filter.packs.includes(item.pack)) return false;
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
      if (filter.skills?.length && !overlaps(item.skills, filter.skills)) return false;
      if (search && !normalise(item.text).includes(search)) return false;
      return true;
    });
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
