/**
 * Who a Spanish sentence is spoken to, and what each choice is called.
 *
 * Spanish forces this choice in almost every sentence spoken to another person,
 * and getting it wrong is the difference between polite and rude — so it is
 * first-class data rather than a note. What was wrong was *where* it lived:
 * `ADDRESS_FORMS` in `src/domain/content/model.ts` was four Spanish pronoun names
 * in the language-neutral model, reaching the zod boundary as a closed enum and
 * `UsageBadges` as a label table. A German pack cannot say `du`/`Sie`/`ihr`
 * through that, and `docs/tasks/language-matrix.md` §7 records the case that
 * actually breaks it: **Chinese barely marks the distinction at all**, so the
 * field has to be droppable and a screen has to render nothing rather than guess.
 *
 * So a language declares its own forms, and every consumer asks. The ids are what
 * a row authors and the pack stores; the labels are what a learner reads.
 *
 * The **neutral** half — number and formality — is what the build reasons with,
 * because a command has to match the audience it is declared for and no amount of
 * knowing the word `ustedes` tells it that. German's `Sie` is the shape that keeps
 * this honest: it is formal in both numbers, so `number` there would be two rows
 * or a missing field, and nothing here assumes a 2×2.
 */

import type { AddressFormSpec } from '../types';

/**
 * The four, in the order a learner meets them: singular before plural, informal
 * before formal.
 *
 * `vosotros` carries the one regional limit Spanish has here. That fact used to
 * be a separate `regionsForAddress` function on the module, which meant two
 * places knew about address forms and only one of them listed them — so a fifth
 * form could be added and quietly get no region. It is a column now.
 */
export const SPANISH_ADDRESS_FORMS: readonly AddressFormSpec[] = [
  {
    id: 'tu',
    label: 'tú',
    title: 'Informal: someone you address as tú — a friend, a peer, a child',
    number: 'singular',
    formality: 'informal',
  },
  {
    id: 'usted',
    label: 'usted',
    title: 'Formal: someone you address as usted — a stranger, an official, an elder',
    number: 'singular',
    formality: 'formal',
  },
  {
    id: 'vosotros',
    label: 'vosotros',
    title: 'Informal plural, used in Spain',
    number: 'plural',
    formality: 'informal',
    // Spain's alone. Every other form is used wherever Spanish is, which is why
    // this is one row's column rather than a rule.
    regions: ['es-ES'],
  },
  {
    id: 'ustedes',
    label: 'ustedes',
    title: 'Plural: formal in Spain, the everyday plural in Latin America',
    number: 'plural',
    formality: 'formal',
  },
];
