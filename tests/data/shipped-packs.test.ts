/** Every pack the build ships must load cleanly and be practisable. */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/app/missions';
import { loadCatalog, loadPack, type DatasetSource } from '../../src/data/loaders';
import { ContentRepository, isUsableIn, moodOf } from '../../src/domain/content';
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

    const forms = repository.formsOf(tener!).map((form) => form.form);
    expect(forms).toContain('tengo');
    expect(forms).toContain('tuvimos');
    expect(forms).toContain('tenía');
    expect(forms).toContain('teniendo');
  });

  it('give every noun its plural and every adjective its agreement forms', async () => {
    const { repository } = await loadAll();
    const paradigm = (local: string) =>
      repository.formsOf(lexemeIn(repository, local)).map((form) => form.form);

    // Generated since the pack existed and used only to link `libros` back to
    // `libro`, so a learner could never be shown the one thing a Spanish noun
    // always raises. `formsOf` had verb forms to read and nothing else.
    expect(paradigm('libro')).toEqual(['libro', 'libros']);
    // A declared irregular plural, which no rule would produce.
    expect(paradigm('examen')).toEqual(['examen', 'exámenes']);
    // An invariable noun still has both, so the sheet can say it does not change.
    expect(paradigm('lunes')).toEqual(['lunes', 'lunes']);
    expect(paradigm('cansado')).toEqual(['cansado', 'cansados', 'cansada', 'cansadas']);
    expect(paradigm('grande')).toEqual(['grande', 'grandes']);
  });

  /**
   * `nevera` has been marked three ways and the third is a product decision
   * rather than a correction, so the history is worth keeping.
   *
   * It shipped `es-ES`, which was inverted: `nevera` is what everyone in Colombia
   * says, and a learner aiming there was denied it. It then shipped
   * `es-ES,es-CO,es-VE,es-CU,es-DO,es-PR` — every locale that actually uses it,
   * which was true and is now more precision than the app carries: **Spanish
   * distinguishes Spain and Latin America and nothing finer**
   * (`FILTERABLE_REGIONS`, and `language-matrix.md` §1 where the call was left
   * open). So it is `es-ES` again, and a Colombian learner meets `refrigerador`.
   *
   * That loses a true fact, and the trade is deliberate: "also said in Colombia
   * and Venezuela but not Mexico" is trivia to a learner, while Spain against
   * Latin America is the split they actually choose between.
   */
  it('splits a regional word along the one line the app draws', async () => {
    const { repository } = await loadAll();
    const fridge = repository.allItems().filter((item) => /nevera|refrigerador/i.test(item.text));
    const seenIn = (locale: string) =>
      fridge.filter((item) => isUsableIn(item.regions, locale as never)).map((item) => item.text);

    // Spain never says refrigerador; Latin America never says nevera — and every
    // Latin American accent resolves through `es-419`, Colombia included.
    expect(seenIn('es-ES').join(' ')).not.toMatch(/refrigerador/);
    for (const locale of ['es-419', 'es-MX', 'es-AR', 'es-CO']) {
      expect(seenIn(locale).join(' '), locale).not.toMatch(/nevera/);
    }
    // Nobody is left without a fridge.
    for (const locale of ['es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-419']) {
      expect(seenIn(locale).length, locale).toBeGreaterThan(0);
    }
  });

  it('carry the region of the word a form belongs to', async () => {
    const { repository } = await loadAll();
    expect(repository.formsOf(lexemeIn(repository, 'papa')).map((form) => form.regions)).toEqual([
      ['es-419'],
      ['es-419'],
    ]);
  });

  it('reads an ordinal before a noun as the ordinal', async () => {
    const { repository } = await loadAll();
    const tokenIn = (text: string, word: string) => {
      const item = repository.allItems().find((candidate) => candidate.text === text);
      expect(item, `no shipped item reads "${text}"`).toBeDefined();
      return item!.tokens?.find((token) => token.text === word);
    };

    // `segundo` the ordinal was simply missing, so the noun (a second of time)
    // claimed `el segundo piso` — a wrong link, which the coverage report counts
    // as a success, and four `segunda` tokens went unlinked beside it.
    expect(tokenIn('Sí, está en el segundo piso.', 'segundo')?.pos).toBe('ADJ');
    expect(tokenIn('Espera un segundo, por favor.', 'segundo')?.pos).toBe('NOUN');
    expect(tokenIn('A la derecha, en la segunda calle.', 'segunda')?.lemma).toBe('segundo');
    // The shortened form is derived from `numerals.ts` rather than authored.
    expect(tokenIn('Sí, está en el primer piso.', 'primer')?.lemma).toBe('primero');
  });

  it('holds a statement and the question built from it as two items', async () => {
    const { repository } = await loadAll();
    const textOf = (text: string) =>
      repository.allItems().find((candidate) => candidate.text === text);

    // The pack held 376 questions and 1,019 statements and not one place where the
    // *same words* appeared as both, which is the one contrast an English speaker
    // most needs: Spanish adds no word and moves nothing. The duplicate-text
    // check used to forbid exactly this pair, because it stripped the marks that
    // carry the whole difference.
    for (const [statement, question] of [
      ['Tu hermano trabaja aquí.', '¿Tu hermano trabaja aquí?'],
      ['Hay pan en la mesa.', '¿Hay pan en la mesa?'],
      ['El tren llega a las ocho.', '¿El tren llega a las ocho?'],
    ] as const) {
      const told = textOf(statement);
      const asked = textOf(question);
      expect(told, statement).toBeDefined();
      expect(asked, question).toBeDefined();
      expect(told!.id).not.toBe(asked!.id);
      expect(moodOf(told!)).toBe('statement');
      expect(moodOf(asked!)).toBe('question');
    }
  });

  it('names how a question is built, not only what it asks about', async () => {
    const { repository } = await loadAll();
    const skillOf = (text: string) =>
      repository
        .allItems()
        .find((candidate) => candidate.text === text)
        ?.skills?.map((skill) => skill.replace(/^.*:skill:/, ''));

    // A yes/no question is the statement itself; a question word opens its own.
    expect(skillOf('¿Hay pan en la mesa?')).toContain('yes-no-question');
    expect(skillOf('¿Cómo te llamas?')).toContain('question-word');
    // A conjunction in front of it does not stop it opening the question.
    // `¿Y dónde giro?` is how a conversation asks its second question, and
    // reading the token straight after `¿` filed thirteen of these as yes/no
    // questions — the opposite of what they are, in the one skill whose whole
    // job is telling the two apart.
    expect(skillOf('¿Y dónde giro?')).toContain('question-word');
    expect(skillOf('¿Y quién más va a la reunión?')).toContain('question-word');
    // And a conjunction with nothing interrogative behind it is still yes/no.
    expect(skillOf('¿Y tienes hermanos?')).toContain('yes-no-question');

    /*
     * Neither, where the shape is genuinely ambiguous — `disambiguate` returns
     * null rather than guess a lexeme, and the same rule has to hold here: a
     * learner practising `yes-no-question` on a `cuánto` question is being taught
     * the opposite of the thing. `¿Y el medio kilo cuánto es?` topicalises its
     * subject and answers a price; `¿Sabe dónde está el banco?` is an embedded
     * question that answers sí. Nothing local separates the two.
     */
    for (const ambiguous of ['¿Y el medio kilo cuánto es?', '¿Sabe dónde está el banco?']) {
      const skills = skillOf(ambiguous) ?? [];
      expect(skills, ambiguous).not.toContain('yes-no-question');
      expect(skills, ambiguous).not.toContain('question-word');
    }
  });

  /**
   * Spanish sticks the object onto an infinitive, a gerund or a command and writes
   * the result as one word. `tokenise` is per-word, so every one of these arrived
   * with no lexeme — the largest group of unlinked tokens in the pack, and the one
   * a learner is most likely to tap, because `ayudarme` is exactly the word they
   * do not know yet.
   */
  it('reads a pronoun stuck onto a verb', async () => {
    const { repository } = await loadAll();
    const tokenLike = (pattern: RegExp) =>
      repository
        .allItems()
        .flatMap((item) => item.tokens ?? [])
        .find((token) => pattern.test(token.text));

    expect(tokenLike(/^ayudarme$/)?.lemma).toBe('ayudar');
    expect(tokenLike(/^probarlos$/)?.lemma).toBe('probar');
    expect(tokenLike(/^verte$/)?.lemma).toBe('ver');
    // The accent is why this is morphology rather than a suffix trim: `diga`
    // becomes `dígame`, so stripping the pronoun leaves `díga`, which is a form of
    // nothing until the stress mark comes back off.
    expect(tokenLike(/^Dígame$/i)?.lemma).toBe('decir');
    expect(tokenLike(/^Dígame$/i)?.morph?.mood).toBe('imperative');
    // And `dime`, which the *surface index* cannot reach: commands are indexed
    // only where nothing else claims the form, and `dar`'s preterite `di` claimed
    // it first. At the enclitic level there is no contest — `dame` is dar, `dime`
    // is decir — so the strip asks the paradigm instead.
    expect(tokenLike(/^dime$/i)?.lemma).toBe('decir');
  });

  it('does not invent a verb out of a word that merely ends in a pronoun', async () => {
    const { repository } = await loadAll();
    const tokens = repository.allItems().flatMap((item) => item.tokens ?? []);

    // A finite tense cannot take an enclitic, and the strip is only tried when
    // nothing claims the surface as written — so an ordinary noun or adjective
    // ending in `-la`, `-lo` or `-te` keeps its own reading.
    for (const [text, lemma] of [
      ['clase', 'clase'],
      ['tarde', 'tarde'],
      ['calle', 'calle'],
    ] as const) {
      const found = tokens.find((token) => token.text.toLowerCase() === text);
      if (found?.lemma) expect(found.lemma, text).toBe(lemma);
    }
  });

  it('holds one word as one lexeme, so its encounters do not split', async () => {
    const { repository } = await loadAll();
    const juntos = repository
      .allItems()
      .flatMap((item) => item.tokens ?? [])
      .filter((token) => token.text.toLowerCase() === 'juntos');

    // `juntos` was declared as its own adverb beside the adjective `junto`, both
    // glossed "together". Eleven tokens split five to one, four to the other and
    // two to neither, so both looked under-encountered and a learner's progress on
    // the word was halved.
    expect(juntos.length).toBeGreaterThan(5);
    expect(new Set(juntos.map((token) => token.lexeme)).size).toBe(1);
    expect(juntos[0]?.lemma).toBe('junto');
  });

  it('generates the future and the conditional, which were simply absent', async () => {
    const { repository } = await loadAll();
    const gustar = repository
      .allItems()
      .flatMap((item) => item.lexemes ?? [])
      .find((id) => id.endsWith(':lexeme:gustar'));
    const forms = repository.formsOf(gustar!);

    // `me gustaría` is one of the first polite formulas anybody learns, and it sat
    // unlinked in the shipped pack because nothing produced the conditional.
    expect(forms.map((form) => form.form)).toContain('gustaría');
    expect(forms.some((form) => form.morph.tense === 'future')).toBe(true);
    expect(forms.some((form) => form.morph.tense === 'conditional')).toBe(true);
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
    ]).filter((localId) => repository.passageByRef(localId) === undefined);

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
        const passage = repository.passageByRef(context.passage);
        const used = new Set(
          passage ? repository.itemsOfPassage(passage.id).flatMap((item) => item.skills ?? []) : [],
        );
        for (const localId of mission.capabilities) {
          const skill = repository.skillByRef(localId);
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
        const capability = repository.skillByRef(palette.capability);
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

/** A lexeme id read off the items that reference it — the repository indexes by id. */
function lexemeIn(repository: ContentRepository, local: string) {
  const ids = new Set(repository.allItems().flatMap((item) => item.lexemes ?? []));
  const found = [...ids].find((id) => id.endsWith(`:lexeme:${local}`));
  expect(found, `no shipped lexeme is called "${local}"`).toBeDefined();
  return found!;
}
