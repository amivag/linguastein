/**
 * Who a sentence addresses, owned by the language rather than by the model.
 *
 * `ADDRESS_FORMS` was `['tu', 'usted', 'vosotros', 'ustedes']` in
 * `src/domain/content/model.ts` — four Spanish pronouns in the model every pack
 * shares. It reached the zod boundary as a closed enum, so a German pack saying
 * `sie` would have been rejected at load, and `UsageBadges` as a label table, so
 * no other language could be badged at all. `docs/tasks/language-matrix.md` §7
 * records the case that settles it: **Chinese barely marks the distinction**, so
 * the field has to be droppable and a screen has to render nothing rather than
 * guess a label.
 *
 * Three things had to become true, and each is asserted here:
 *
 * - the vocabulary is the language module's, with the label and the neutral pair
 *   in one row rather than three files;
 * - the **build** refuses a value the language does not declare, which is where
 *   the guarantee the zod enum used to give had to go;
 * - a value the language has no label for renders nothing.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { addressForm, addressForms } from '../../src/languages/runtime';
import { UsageBadges } from '../../src/components/UsageBadges';
import { createScratchPack, type ScratchPack } from '../fixtures/dataset';
import { renderWithServices } from '../fixtures/services';

describe('the runtime lookup', () => {
  it('answers for the language being learned', () => {
    expect(addressForm('es', 'usted')?.label).toBe('usted');
    expect(addressForm('es-MX', 'tu')?.label).toBe('tú');
  });

  it('gives nothing for a language that marks no address', () => {
    // Not an error and not a gap: a language that does not mark this declares no
    // forms, and every caller treats absence as "say nothing".
    expect(addressForms('de')).toEqual([]);
    expect(addressForm('de', 'sie')).toBeUndefined();
  });

  it('gives nothing for a value this language does not know', () => {
    // What a pack authored elsewhere looks like when read on this course.
    expect(addressForm('es', 'sie')).toBeUndefined();
    expect(addressForm('es', undefined)).toBeUndefined();
    expect(addressForm(undefined, 'tu')).toBeUndefined();
  });
});

describe('the badge', () => {
  it('names the form the language declares', () => {
    renderWithServices(<UsageBadges address="vosotros" />);
    expect(screen.getByText('vosotros')).toBeInTheDocument();
  });

  it('renders nothing rather than guess a label it does not have', () => {
    // The requirement §7 sets out, and the one a per-language label *table* could
    // not have met: showing the raw slug would be worse than showing no badge.
    renderWithServices(<UsageBadges address="sie" />);
    expect(screen.queryByRole('list', { name: 'Usage' })).not.toBeInTheDocument();
  });

  it('drops only the address badge, keeping the facets it can name', () => {
    renderWithServices(<UsageBadges address="sie" register="formal" regions={['es-MX']} />);

    expect(screen.getByText('formal')).toBeInTheDocument();
    expect(screen.queryByText('sie')).not.toBeInTheDocument();
  });

  it('says nothing at all with no course to ask', () => {
    // Rendered outside a course — the style guide and a bare unit test both do
    // this — so there is no target language and therefore no label.
    render(<UsageBadges address="tu" />);
    expect(screen.queryByRole('list', { name: 'Usage' })).not.toBeInTheDocument();
  });
});

describe('the build gate', () => {
  let pack: ScratchPack;

  beforeAll(() => {
    pack = createScratchPack('linguastein-address-forms');
  }, 120_000);

  afterAll(() => {
    pack.dispose();
  });

  it('refuses an address form the language does not declare', () => {
    // The check the zod enum used to make, in the one place that can make it for
    // any language: against the declaration rather than against a literal.
    pack.append(
      'sentences-more-coverage.tsv',
      ['Sie sprechen sehr schnell.', 'You speak very fast.', 'a1', 'core', '', '', 'sie'].join(
        '\t',
      ),
    );

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('unknown address "sie"');
  });
});
