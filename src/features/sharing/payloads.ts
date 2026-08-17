/**
 * Copy/share payloads (spec §7). Copying is a first-class feature: the app
 * plays well with translators, notes apps and external AI tools instead of
 * trying to replace them.
 */

import type { ContentRepository, LanguageTag, LearningItem } from '../../domain/content';

export interface SharePayload {
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

export function buildSharePayloads(
  repository: ContentRepository,
  item: LearningItem,
  referenceLanguage: LanguageTag,
): readonly SharePayload[] {
  const translation = repository.translationOf(item.id, referenceLanguage);
  const examples = (item.examples ?? [])
    .map((id) => repository.getItem(id))
    .filter((example): example is LearningItem => example !== undefined);
  const skills = (item.skills ?? [])
    .map((id) => repository.getSkill(id))
    .filter((skill) => skill !== undefined);

  const payloads: SharePayload[] = [{ id: 'target', label: 'Copy Spanish', text: item.text }];

  if (translation) {
    payloads.push({
      id: 'pair',
      label: 'Copy with translation',
      text: `${item.text}\n${translation.text}`,
    });
  }

  if (skills.length > 0 || item.note) {
    const lines = [item.text];
    if (translation) lines.push(translation.text);
    if (item.note) lines.push('', item.note);
    for (const skill of skills) {
      const skillTranslation = repository.translationOf(skill.id, referenceLanguage);
      lines.push(`${skill.label}${skillTranslation ? ` — ${skillTranslation.text}` : ''}`);
    }
    payloads.push({ id: 'context', label: 'Copy with context', text: lines.join('\n') });
  }

  if (examples.length > 0) {
    payloads.push({
      id: 'examples',
      label: 'Copy examples',
      text: examples
        .map((example) => {
          const exampleTranslation = repository.translationOf(example.id, referenceLanguage);
          return exampleTranslation ? `${example.text} — ${exampleTranslation.text}` : example.text;
        })
        .join('\n'),
    });
  }

  payloads.push({
    id: 'ai-prompt',
    label: 'Copy as AI prompt',
    text: buildAiPrompt(item),
  });

  return payloads;
}

/** A ready-to-paste prompt for an external AI tool. */
export function buildAiPrompt(item: LearningItem): string {
  return [
    'Explain this Spanish sentence for a beginner:',
    `"${item.text}"`,
    '',
    'Include:',
    '- meaning',
    '- grammar pattern',
    '- pronunciation tips',
    '- 3 natural variations',
  ].join('\n');
}
