/** A meaningful value that can occupy one slot in a reusable sentence frame. */
export interface VariationChoice {
  readonly id: string;
  readonly target: string;
  readonly reference: string;
}

export interface VariationSlot {
  readonly id: string;
  readonly label: string;
  readonly choices: readonly VariationChoice[];
}

/**
 * Language material from which the UI derives substitution practice.
 *
 * This is not an exercise record and carries no learner state. A selected set
 * of slot values becomes a transient phrase through `renderVariation`, just as
 * a content item becomes a cloze or think-and-say exercise through a generator.
 */
export interface VariationPattern {
  readonly id: string;
  readonly title: string;
  readonly cue: string;
  readonly targetTemplate: string;
  readonly referenceTemplate: string;
  readonly slots: readonly VariationSlot[];
}

export interface RenderedVariation {
  readonly target: string;
  readonly reference: string;
  readonly selections: Readonly<Record<string, string>>;
}

/** Use the first deliberately ordered choice in each slot. */
export function defaultVariationSelections(
  pattern: VariationPattern,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    pattern.slots.flatMap((slot) => (slot.choices[0] ? [[slot.id, slot.choices[0].id]] : [])),
  );
}

/** Build one valid target/reference pair without storing the generated phrase. */
export function renderVariation(
  pattern: VariationPattern,
  selections: Readonly<Record<string, string>>,
): RenderedVariation {
  const selected = Object.fromEntries(
    pattern.slots.map((slot) => {
      const choice = slot.choices.find((candidate) => candidate.id === selections[slot.id]);
      if (!choice) throw new Error(`Unknown choice for variation slot “${slot.id}”`);
      return [slot.id, choice] as const;
    }),
  );

  const interpolate = (template: string, language: 'target' | 'reference') =>
    template.replace(/\{([^}]+)\}/g, (_placeholder, slotId: string) => {
      const choice = selected[slotId];
      if (!choice) throw new Error(`Unknown variation slot “${slotId}”`);
      return choice[language];
    });

  return {
    target: interpolate(pattern.targetTemplate, 'target'),
    reference: interpolate(pattern.referenceTemplate, 'reference'),
    selections,
  };
}

/** Structural catalog checks kept separate from rendering for build-time tests. */
export function variationProblems(pattern: VariationPattern): readonly string[] {
  const problems: string[] = [];
  const ids = pattern.slots.map((slot) => slot.id);
  if (new Set(ids).size !== ids.length) problems.push('duplicate slot id');
  for (const slot of pattern.slots) {
    if (!slot.choices.length) problems.push(`${slot.id}: no choices`);
    const choiceIds = slot.choices.map((choice) => choice.id);
    if (new Set(choiceIds).size !== choiceIds.length)
      problems.push(`${slot.id}: duplicate choice id`);
    /*
     * A slot is rendered as a `<select>`, so a choice with no target is a blank
     * line in a dropdown — which reads as a rendering fault rather than as an
     * option, and cannot be picked out by name. "Say nothing here" has to be
     * spelled with something visible, the way the sentence-final slots use a
     * bare full stop.
     */
    for (const choice of slot.choices) {
      if (!choice.target.trim()) problems.push(`${slot.id}/${choice.id}: empty target`);
      if (!choice.reference.trim()) problems.push(`${slot.id}/${choice.id}: empty reference`);
    }
  }
  for (const [name, template] of [
    ['target', pattern.targetTemplate],
    ['reference', pattern.referenceTemplate],
  ] as const) {
    const placeholders = [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!);
    for (const id of ids) {
      if (!placeholders.includes(id)) problems.push(`${name}: missing slot ${id}`);
    }
    for (const placeholder of placeholders) {
      if (!ids.includes(placeholder)) problems.push(`${name}: unknown slot ${placeholder}`);
    }
  }
  return problems;
}
