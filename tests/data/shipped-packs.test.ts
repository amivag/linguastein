/** Every pack the build ships must load cleanly and be practisable. */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/app/missions';
import { loadCatalog, loadPack, type DatasetSource } from '../../src/data/loaders';
import { ContentRepository } from '../../src/domain/content';
import { missionPassageForStage, missionTransfers } from '../../src/domain/missions';

const root = resolve(process.cwd(), 'public/packs');
const source: DatasetSource = {
  name: root,
  read: (path) => readFile(resolve(root, path), 'utf8'),
};

async function loadAll() {
  const catalog = await loadCatalog(source);
  const loaded = await Promise.all(catalog.packs.map((entry) => loadPack(source, entry.manifest)));
  return {
    catalog,
    issues: loaded.flatMap((result) => result.issues),
    repository: ContentRepository.from(loaded.map((result) => result.pack)),
  };
}

describe('shipped packs', () => {
  it('load with no errors or warnings', async () => {
    const { catalog, issues } = await loadAll();
    expect(catalog.packs.length).toBeGreaterThan(0);
    expect(issues.map((issue) => `${issue.source}: ${issue.message}`)).toEqual([]);
  });

  it('carry enough content for real sessions', async () => {
    const { repository } = await loadAll();

    expect(repository.itemCount).toBeGreaterThan(700);
    expect(repository.query({ types: ['word'] }).length).toBeGreaterThan(300);
    expect(repository.query({ types: ['sentence', 'phrase'] }).length).toBeGreaterThan(400);
  });

  it('translate every item into the first reference language', async () => {
    const { repository } = await loadAll();
    const untranslated = repository
      .allItems()
      .filter((item) => repository.translationOf(item.id, 'en') === undefined);

    expect(untranslated.map((item) => item.id)).toEqual([]);
  });

  it('give every verb a full set of generated forms', async () => {
    const { repository } = await loadAll();
    const verbs = repository.query().flatMap((item) => item.lexemes ?? []);
    const tener = [...new Set(verbs)].find((id) => id.endsWith(':lexeme:tener'));
    expect(tener).toBeDefined();

    const forms = repository.verbFormsOf(tener!).map((form) => form.form);
    expect(forms).toContain('tengo');
    expect(forms).toContain('tuvimos');
    expect(forms).toContain('tenía');
    expect(forms).toContain('teniendo');
  });

  it('link sentence tokens to lexemes so words can be inspected', async () => {
    const { repository } = await loadAll();
    const sentences = repository.query({ types: ['sentence'] });
    const tokens = sentences.flatMap((item) => item.tokens ?? []);
    const words = tokens.filter((token) => token.pos !== 'PUNCT');
    const linked = words.filter((token) => token.lexeme !== undefined);

    // A dataset where words are not linked cannot support word inspection.
    expect(linked.length / words.length).toBeGreaterThan(0.97);
  });

  it('resolves ambiguous surface forms to the right lexeme', async () => {
    const { repository } = await loadAll();
    const tokenIn = (text: string, word: string) => {
      const item = repository.allItems().find((candidate) => candidate.text === text);
      expect(item, `no shipped item reads "${text}"`).toBeDefined();
      return item!.tokens?.find((token) => token.text === word);
    };

    // `hay` is declared as a bare surface form and carries no morphology, so it
    // failed the "after a verb" check and `nada` resolved to `nadar`.
    expect(tokenIn('No hay nada en la nevera.', 'nada')?.lemma).toBe('nada');
    // `muy` cues a noun phrase, which handed the adverb `mal` to the adjective.
    expect(tokenIn('Mi novio canta muy mal.', 'mal')?.lemma).toBe('mal');
    // The apocopated adjective is still the right reading before a noun.
    expect(tokenIn('Hace mal tiempo hoy.', 'mal')?.lemma).toBe('malo');
    // Noun and adjective share the form; after a verb the noun heads the phrase.
    expect(tokenIn('Tengo frío.', 'frío')?.pos).toBe('NOUN');
    // ser and ir share a preterite and nothing local decides it, so this stays
    // unlinked on purpose: a missing lemma beats a wrong one.
    expect(tokenIn('Fuimos a la playa.', 'Fuimos')?.lemma).toBeUndefined();
  });

  it('annotate the gustar-type pattern for every verb it names', async () => {
    const { repository } = await loadAll();
    const marked = repository
      .query({ types: ['sentence'] })
      .filter((item) =>
        item.annotations?.some((annotation) => annotation.skill?.endsWith(':skill:gustar-type')),
      );
    const verbs = new Set(
      marked.flatMap((item) =>
        (item.tokens ?? []).filter((token) => token.pos === 'VERB').map((token) => token.lemma),
      ),
    );

    // doler and encantar are named by the pattern matcher; leaving them out of
    // the dataset made it reachable by gustar alone.
    expect([...verbs]).toEqual(expect.arrayContaining(['gustar', 'doler', 'encantar']));
  });

  it('label a command as a command, not as third-person present', async () => {
    const { repository } = await loadAll();
    const verbIn = (text: string) => {
      const item = repository.allItems().find((candidate) => candidate.text === text);
      expect(item, `no shipped item reads "${text}"`).toBeDefined();
      return { item: item!, verb: item!.tokens?.find((token) => token.pos === 'VERB') };
    };

    // A tú command is spelled like the third person present, so these used to
    // ship as "person 3, present indicative" — telling a learner the wrong thing
    // about the sentence and filing it under the wrong skill.
    const command = verbIn('Cierra la puerta, por favor.');
    expect(command.verb?.morph?.mood).toBe('imperative');
    expect(command.verb?.morph?.person).toBe(2);
    expect(command.verb?.morph?.tense).toBeUndefined();
    expect(command.item.address).toBe('tu');

    // The same surface form, genuinely third person, must stay indicative.
    const statement = verbIn('El mercado cierra a las dos.');
    expect(statement.verb?.morph?.mood).toBe('indicative');
    expect(statement.verb?.morph?.person).toBe(3);

    // usted commands are unambiguous, so the address comes from the form itself.
    const formal = verbIn('Gire a la derecha.');
    expect(formal.verb?.morph?.formality).toBe('formal');
    expect(formal.item.address).toBe('usted');

    // A statement that merely opens with a verb spelled like estar's tú command
    // must not be dragged into the imperative by the sentence's declared usted.
    const mixed = verbIn('Está muy cerca. Siga por esta calle.');
    expect(mixed.verb?.morph?.mood).toBe('indicative');
  });

  it('ship connected texts, not only single sentences', async () => {
    const { repository } = await loadAll();
    const passages = repository.allPassages();

    expect(passages.length).toBeGreaterThan(10);
    expect(passages.some((passage) => passage.kind === 'dialogue')).toBe(true);
    // Four sentences is where a text starts training how sentences hang together.
    expect(passages.filter((passage) => passage.items.length >= 4).length).toBeGreaterThan(10);
  });

  it('resolve every sentence a passage references', async () => {
    const { repository } = await loadAll();
    const broken = repository.allPassages().filter((passage) => {
      const resolved = repository.itemsOfPassage(passage.id);
      return resolved.length !== passage.items.length;
    });

    // A hole mid-paragraph is worse than no paragraph.
    expect(broken.map((passage) => passage.title)).toEqual([]);
  });

  it('ships every taught and transfer passage named by the mission catalog', async () => {
    const { repository } = await loadAll();
    const missing = MISSIONS.flatMap((mission) => [
      missionPassageForStage(mission, 'understand'),
      ...missionTransfers(mission).map((transfer) => transfer.passage),
    ]).filter((localId) => repository.passageByLocalId(localId) === undefined);

    expect(missing).toEqual([]);
  });

  it('teaches every declared mission capability in both the lesson and transfer situation', async () => {
    const { repository } = await loadAll();
    const missing: string[] = [];

    for (const mission of MISSIONS) {
      if (!mission.capabilities?.length) continue;
      const contexts = [
        { name: 'understand', passage: mission.passage },
        ...missionTransfers(mission).map((transfer, index) => ({
          name: `transfer-${index + 1}`,
          passage: transfer.passage,
        })),
      ];
      for (const context of contexts) {
        const passage = repository.passageByLocalId(context.passage);
        const used = new Set(
          passage ? repository.itemsOfPassage(passage.id).flatMap((item) => item.skills ?? []) : [],
        );
        for (const localId of mission.capabilities) {
          const skill = repository.skillByLocalId(localId);
          if (!skill || skill.kind !== 'function' || !used.has(skill.id)) {
            missing.push(`${mission.id}/${context.name}/${localId}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('resolves every response palette to distinct ordinary sentence items', async () => {
    const { repository } = await loadAll();
    const broken: string[] = [];

    for (const mission of MISSIONS) {
      for (const palette of mission.responsePalettes ?? []) {
        const capability = repository.skillByLocalId(palette.capability);
        if (!capability || capability.kind !== 'function') {
          broken.push(`${mission.id}/${palette.id}/capability`);
        }
        const seen = new Set<string>();
        for (const response of palette.responses) {
          const item = repository.itemByLocalId(response.item);
          if (!item || !['sentence', 'phrase'].includes(item.type)) {
            broken.push(`${mission.id}/${palette.id}/${response.item}`);
          }
          if (capability && !item?.skills?.includes(capability.id)) {
            broken.push(`${mission.id}/${palette.id}/${response.item}:capability`);
          }
          if (seen.has(response.item)) {
            broken.push(`${mission.id}/${palette.id}/duplicate:${response.item}`);
          }
          seen.add(response.item);
        }
      }
    }

    expect(broken).toEqual([]);
  });

  it('name a speaker for every line of every dialogue', async () => {
    const { repository } = await loadAll();
    const wrong = repository
      .allPassages()
      .filter((passage) => passage.kind === 'dialogue')
      .filter((passage) => passage.speakers?.length !== passage.items.length);

    expect(wrong.map((passage) => passage.title)).toEqual([]);
  });

  it('recycle vocabulary within a passage rather than introducing all new words', async () => {
    const { repository } = await loadAll();

    // The reason paragraphs beat unrelated sentences: a word met in line 1 comes
    // round again while it is still fresh. Without that they are just sentences
    // that happen to share a page.
    const repeated = repository.allPassages().filter((passage) => {
      const lexemes = repository
        .itemsOfPassage(passage.id)
        .flatMap((item) => item.lexemes ?? []) as string[];
      return lexemes.length > new Set(lexemes).size;
    });

    expect(repeated.length).toBe(repository.allPassages().length);
  });

  it('give every word card an example sentence to show it in', async () => {
    const { repository } = await loadAll();
    const cards = repository.query({ types: ['word'] });
    const orphans = cards.filter((card) => (card.examples?.length ?? 0) === 0);

    expect(orphans.map((card) => card.text)).toEqual([]);
  });

  it('give every lexeme a word-level gloss', async () => {
    const { repository } = await loadAll();
    const lexemes = new Set(repository.query().flatMap((item) => item.lexemes ?? []));
    const missing = [...lexemes].filter((id) => repository.translationOf(id, 'en') === undefined);

    expect(missing).toEqual([]);
  });
});
