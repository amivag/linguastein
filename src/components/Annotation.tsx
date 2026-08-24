import type { ReactNode } from 'react';
import { annotationHue, type AnnotationFacet } from '../styles/semantics';
import { Icon, type IconName } from './Icon';
import styles from './Annotation.module.css';

interface AnnotationProps {
  readonly facet: AnnotationFacet;
  /**
   * Replaces the facet's own word, for a note that is about something narrower
   * than "note" — the grammar of a form, say. The colour and the glyph stay with
   * the facet, because those are what make two notes on one card read as the
   * same *kind* of thing.
   */
  readonly label?: string;
  /** Sets the reading at prompt size, for the one annotation a card is about. */
  readonly lead?: boolean;
  readonly children: ReactNode;
}

/**
 * One kind of thing said *about* the phrase above it: what it means, what to
 * know before using it, what it lets you do.
 *
 * These used to be three plain paragraphs of muted small text in a column — a
 * translation, an authored note and a grammar remark, all the same weight and
 * the same grey, so telling them apart meant reading all three. A practice card
 * shows up to five such facts at once, and the one a learner is actually looking
 * for is nearly always the meaning.
 *
 * So each facet gets a hue and a glyph from `src/styles/semantics.ts`, and — the
 * part that makes it legal as well as legible — the facet's own **word**. Colour
 * never reaches the accessibility tree; the label always does, so a learner who
 * cannot separate two hues reads exactly what everyone else reads and loses only
 * the shortcut. That is the same contract `GrammarTags` holds, and the reason
 * both are readable where the categorical `kindBadge` is `aria-hidden`.
 *
 * Not a heading. These are asides beside a phrase, and a screen with six of them
 * would otherwise have six headings competing with the one thing on it that is a
 * heading.
 */
export function Annotation({ facet, label, lead = false, children }: AnnotationProps) {
  return (
    /*
      A `div` rather than a `p`, and the reason is the ability list: an annotation
      is sometimes a short run of prose and sometimes a labelled group with a
      list in it, and a `ul` inside a `p` is a parse error that silently
      restructures the DOM around it. One element for both keeps the label, the
      glyph and the tint in one place rather than in two that drift.
    */
    <div
      className={`${styles.annotation} ${lead ? styles.lead : ''}`}
      data-kind={annotationHue(facet)}
    >
      <Icon name={FACET_ICONS[facet]} size="sm" className={styles.icon} />
      {/* `children` sits directly in the container rather than in a wrapping
          span: the ability list is a `ul`, and phrasing content cannot hold it. */}
      <div className={styles.text}>
        <span className={styles.label}>{label ?? FACET_LABELS[facet]}</span>
        {children}
      </div>
    </div>
  );
}

/** The word a facet is called, which is also what a screen reader reads first. */
const FACET_LABELS: Record<AnnotationFacet, string> = {
  meaning: 'Meaning',
  note: 'Note',
  ability: 'Ability',
};

const FACET_ICONS: Record<AnnotationFacet, IconName> = {
  meaning: 'meaning',
  note: 'note',
  ability: 'study',
};
