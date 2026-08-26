/**
 * Which categorical hue a *grammatical fact* wears.
 *
 * The companion to `kinds.ts`, and deliberately its opposite. A topic's hue is
 * hashed, because there are thirty-six topics, nobody authored them as a set and
 * a pack in a second language must arrive already coloured. A gender, a part of
 * speech and a tense are none of those things: there are three, five and nine of
 * them, they are closed sets a language actually has, and *which* colour each
 * one gets is the whole point rather than an implementation detail. So they are
 * chosen here, by hand, with the reasoning written down.
 *
 * Everything below returns a {@link KindHue} — a position on the same twelve-hue
 * wheel the categorical family already declares. That is the load-bearing
 * decision in this file: no new colour role, no new contrast surface, and
 * `kindTone` in `surfaces.module.css` keeps being the only place a number becomes
 * a pair of colours. A gender badge and a topic badge are drawn by the same rule
 * and hold the same guarantees at every contrast level, because they are the same
 * mechanism pointed at a different question.
 *
 * ## Why colour at all
 *
 * Not decoration, and not gamification. These are the facts about a Spanish word
 * that carry no information a learner can reason their way to — `el mapa` is
 * masculine and `la mano` is feminine and there is nothing in either word to say
 * so. That is precisely the kind of arbitrary pairing a second channel helps
 * with: a learner who has met `mano` in feminine orange forty times has a second
 * hook on it that "look it up again" never builds. It is the reason polyglots
 * colour their own notes, and the one use of colour in this app that is doing
 * pedagogical work rather than making a list scannable.
 *
 * The constraints from the design language are unchanged and are not negotiable
 * in exchange for that:
 *
 * - **Nothing is ever only its colour.** Every hue here is carried by a CSS
 *   background and foreground on an element whose *content* is the word it means
 *   — `el`/`la`, "noun", "preterite". Colour never reaches the accessibility
 *   tree, and the label always does, so a learner who cannot see the difference
 *   loses a mnemonic and no information. Note the contrast with the categorical
 *   badges in `surfaces.module.css`, which carry no text and therefore *are*
 *   `aria-hidden`: same rule, opposite mechanism, because one has a label of its
 *   own and the other borrows the label beside it.
 * - **Never a verdict, never a control.** These mark material, so they step aside
 *   where success, danger or the accent is doing its job, exactly as a topic hue
 *   does.
 * - **`undefined` is a real answer.** A verb has no gender and the indicative is
 *   the unmarked mood; both return nothing rather than a twelfth colour that
 *   means "not applicable". A call site withholds `data-kind` and the thing is
 *   simply uncoloured, which is the same mechanism a finished mission uses to let
 *   green win.
 *
 * ## Why the three systems may reuse a hue
 *
 * Three genders, five parts of speech and nine tense-or-mood values is seventeen
 * meanings over twelve hues, so reuse is arithmetic rather than a choice. It is
 * safe for the reason the design language already gives for the hues sitting near
 * the accent: proximity only misleads if two colours can appear in the same role.
 * A tense hue appears on a conjugation table and on a grammar skill; a gender hue
 * appears on a noun. Nothing draws both as the same shape in the same place.
 *
 * The one collision that would actually mislead is guarded against by hand:
 * **gender and part of speech share no hue**, because a noun carries both at once
 * and a card showing the same colour twice for two different reasons is worse
 * than a card showing none.
 */

import type { Gender, Mood, PartOfSpeech, Tense } from '../domain/content';
import type { KindHue } from './kinds';

/**
 * Grammatical gender: blue, orange, green.
 *
 * Chosen against the convention rather than with it. Spanish teaching materials
 * overwhelmingly use blue for masculine and pink or red for feminine, and both
 * halves of that are worth rejecting:
 *
 * - **Blue and orange survive colour blindness; blue and pink do not.** Red-green
 *   deficiency is the common one, and it collapses pink towards grey-blue —
 *   turning the single most useful colour pair in the app into two shades of the
 *   same thing for roughly one man in twelve. Blue against orange is the pairing
 *   that stays distinct under deuteranopia, protanopia and tritanopia alike, and
 *   this is the one place in the app where that matters most, because here the
 *   colour is carrying a fact rather than aiding a scan.
 * - **Grammatical gender is not gender.** `el problema` is masculine and `la
 *   víctima` is feminine; importing pink and blue drags a human category into an
 *   arbitrary morphological one and quietly teaches something false about both.
 *
 * Neuter takes green, which Spanish needs less than the other two — `esto`,
 * `eso`, `aquello` and little else — but which has to be a real third colour
 * rather than the absence of one, since absence already means "this word has no
 * gender".
 */
export function genderHue(gender: Gender | undefined): KindHue | undefined {
  if (gender === undefined) return undefined;
  return GENDER_HUES[gender];
}

const GENDER_HUES: Record<Gender, KindHue> = {
  masculine: 3,
  feminine: 8,
  neuter: 11,
};

/**
 * Part of speech, for the classes a learner studies as a set.
 *
 * `undefined` for everything else, and that is the same judgement
 * {@link STUDYABLE_POS} already makes: `de`, `el` and `que` are met inside
 * phrases rather than collected, there are a closed handful of each, and a colour
 * per function word would spend eleven hues teaching a learner to recognise
 * categories they never pick. An uncoloured token on a card reads as ordinary
 * language, which is what a function word is.
 *
 * Verbs take red-pink and nouns take cyan — the two ends of the wheel — because
 * those are the two classes that appear together most often and carry most of the
 * work in a sentence.
 */
export function posHue(pos: PartOfSpeech): KindHue | undefined {
  return POS_HUES[pos];
}

/*
 * Keyed to {@link STUDYABLE_POS} and asserted against it in both directions, so
 * a hue here for a class nobody can pick fails a test. `ADV: 10` was exactly
 * that once `docs/tasks/function-words.md` took adverbs off the list: a hue
 * reserved for a category the app never shows.
 */
const POS_HUES: Partial<Record<PartOfSpeech, KindHue>> = {
  NOUN: 1,
  VERB: 7,
  ADJ: 4,
  NUM: 6,
};

/**
 * A tense, or the mood that overrides it.
 *
 * Mood is asked first and wins, because that is how a learner names these: a
 * subjunctive present is "the subjunctive", not "the present". The indicative is
 * the unmarked case and returns nothing, so an ordinary present-tense sentence
 * carries no mood colour at all and the marked moods stand out by being the only
 * ones that do.
 *
 * The assignment that matters is **preterite against imperfect**. They are the
 * distinction A1 and A2 learners get wrong most, they are both "the past" in
 * English, and no amount of explanation substitutes for having seen them apart a
 * few hundred times. So they take hues on opposite sides of the wheel — red-warm
 * for the preterite, cool azure for the imperfect — rather than the two adjacent
 * hues a "the pasts go together" instinct would hand them. Adjacency here would
 * be actively teaching the confusion.
 */
export function tenseHue(tense: Tense | undefined, mood?: Mood | undefined): KindHue | undefined {
  if (mood !== undefined && mood !== 'indicative') return MOOD_HUES[mood];
  if (tense === undefined) return undefined;
  return TENSE_HUES[tense];
}

const TENSE_HUES: Record<Tense, KindHue> = {
  present: 12,
  /*
   * Opposite sides of the wheel, deliberately. See above.
   *
   * The preterite was 7 until the reference facets were added and the word sheet
   * got looked at properly — and 7 is also `VERB`. A verb in the preterite
   * therefore wore the same hue twice, in two adjacent pills, for two unrelated
   * reasons: exactly the collision the note above calls "worse than a card
   * showing none", and the one the gender guard exists to prevent. Only verbs
   * carry a tense, so `VERB` is the single part of speech a tense can meet, and
   * it is now the one hue no tense may take.
   *
   * 8 rather than another free number because nothing is free: it is feminine
   * gender's hue, and gender and tense are the one pair that provably cannot
   * co-occur — a verb has no gender and a noun has no tense. It also puts the
   * preterite six steps from the imperfect instead of five, which is the most
   * the wheel allows.
   */
  preterite: 8,
  imperfect: 2,
  future: 5,
  'present-perfect': 9,
  'past-perfect': 10,
  conditional: 4,
};

const MOOD_HUES: Partial<Record<Mood, KindHue>> = {
  subjunctive: 6,
  imperative: 1,
  // The conditional is a mood and a tense in this model, so both spellings of
  // the question have to give the same colour or a conjugation table and a
  // grammar skill would disagree about the same form.
  conditional: 4,
};

/**
 * The article a learner should hear beside the colour, or nothing.
 *
 * Here rather than in a component because it is the other half of the rule that
 * nothing is ever only its colour: a gender hue that shipped without its label
 * would be a colour-only signal, and keeping the two in one module is what makes
 * that hard to do by accident.
 */
export function genderLabel(gender: Gender | undefined): string | undefined {
  if (gender === undefined) return undefined;
  return GENDER_LABELS[gender];
}

const GENDER_LABELS: Record<Gender, string> = {
  masculine: 'el',
  feminine: 'la',
  neuter: 'lo',
};

/**
 * The facets of a phrase a card can state *about* it, rather than in it.
 *
 * Two closed sets, and they are here for the same reason gender and tense are:
 * there are three of one and three of the other, a language actually has them,
 * and which colour each one gets is the point rather than an implementation
 * detail. What is new is only that these describe an *annotation* — the English
 * meaning, an authored note, who you may say it to — where the sets above
 * describe a word.
 *
 * ## Why these six may not collide with each other
 *
 * The doc above says reuse across the three grammatical systems is safe because
 * "nothing draws both as the same shape in the same place". These six break that
 * assumption, and so are treated as one set: a practice card shows the meaning,
 * the note and all three usage badges *at once*, in one column, as the same
 * shape. Two of them in one hue there would read as one fact split in two. So
 * {@link ANNOTATION_HUES} and {@link USAGE_HUES} share no value, and neither
 * reuses one of the three {@link GENDER_HUES} — the word sheet puts a gender pill
 * in its heading and usage badges directly underneath it.
 *
 * That leaves the tense and part-of-speech hues, which are reused. A tense pill
 * and a usage badge do meet in the word sheet, and the collision is tolerable
 * there for the reason the file already gives: they are different shapes — a pill
 * of grammatical type in the heading against a labelled badge row in the body —
 * and both carry the word they mean.
 */
export type AnnotationFacet = 'meaning' | 'note' | 'ability';

/**
 * The learner-language meaning, an authored note, and a real-world ability.
 *
 * `meaning` takes the hue furthest from the accent of the three, because it is
 * the one a learner looks for on every card and the accent is what the app's own
 * controls wear. `ability` is the odd one out of the three — it is not a fact
 * about the phrase but about the learner — and it is the only one of the three
 * that also appears on its own, in the mission capability list.
 */
export function annotationHue(facet: AnnotationFacet): KindHue {
  return ANNOTATION_HUES[facet];
}

const ANNOTATION_HUES: Record<AnnotationFacet, KindHue> = {
  meaning: 9,
  note: 6,
  ability: 10,
};

/** Who you may say a phrase to, how it sounds, and where it is said. */
export type UsageFacet = 'address' | 'register' | 'region';

/**
 * The three usage facets.
 *
 * `address` is the choice with social consequences — call a stranger `tú` and you
 * are rude — so it takes the hue with the most presence of the three. It used to
 * take `--color-accent` outright, which was the app's own colour spent on a piece
 * of reference data: rule 5 reserves the accent for the app acting, and a badge
 * that says "you would say this to a friend" is not the app acting.
 */
export function usageHue(facet: UsageFacet): KindHue {
  return USAGE_HUES[facet];
}

const USAGE_HUES: Record<UsageFacet, KindHue> = {
  address: 5,
  register: 12,
  region: 2,
};
