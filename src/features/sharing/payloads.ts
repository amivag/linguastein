/**
 * Copy/share payloads (spec §7). Copying is a first-class feature: the app
 * plays well with translators, notes apps and external AI tools instead of
 * trying to replace them.
 */

import { formatLearnerContext, type LearnerContext } from '../../ai';
import {
  languageOption,
  type ContentRepository,
  type LanguageTag,
  type LearningItem,
} from '../../domain/content';

export interface SharePayload {
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

export function buildSharePayloads(
  repository: ContentRepository,
  item: LearningItem,
  referenceLanguage: LanguageTag,
  learner?: LearnerContext,
): readonly SharePayload[] {
  const translation = repository.translationOf(item.id, referenceLanguage);
  const examples = (item.examples ?? [])
    .map((id) => repository.getItem(id))
    .filter((example): example is LearningItem => example !== undefined);
  const skills = (item.skills ?? [])
    .map((id) => repository.getSkill(id))
    .filter((skill) => skill !== undefined);

  // Named from the pack that published the item rather than from the course,
  // for the same reason `lang` is: what is being copied is this sentence's
  // language, and a share sheet that says "Copy Spanish" over German is worse
  // than one that says nothing.
  const target = languageName(repository, item);
  const payloads: SharePayload[] = [
    { id: 'target', label: target ? `Copy ${target}` : 'Copy', text: item.text },
  ];

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
    text: buildAiPrompt(item, target),
  });

  // The same prompt, but telling the AI what this learner already knows
  // (spec §18) instead of asking it to guess.
  if (learner) {
    payloads.push({
      id: 'ai-prompt-personal',
      label: 'Copy AI prompt with my level',
      text: `${buildAiPrompt(item, target)}

About me:
${formatLearnerContext(learner)}`,
    });
  }

  return payloads;
}

/**
 * The language an item is written in, spelled for a human, or `undefined` when
 * its pack is not loaded — which is a stale share link rather than a bug.
 */
function languageName(repository: ContentRepository, item: LearningItem): string | undefined {
  const tag = repository.languageOfItem(item);
  return tag === undefined ? undefined : languageOption(tag).englishName;
}

/**
 * A ready-to-paste prompt for an external AI tool.
 *
 * The language is named because the prompt is read by something that has only
 * the sentence: a model asked to explain `Ich muss arbeiten` as Spanish will
 * make something up rather than object. Omitted when unknown, since "explain
 * this sentence" is a worse prompt than a named one and a much better one than
 * a wrong name.
 */
export function buildAiPrompt(item: LearningItem, language?: string): string {
  return [
    `Explain this ${language ? `${language} ` : ''}sentence for a beginner:`,
    `"${item.text}"`,
    '',
    'Include:',
    '- meaning',
    '- grammar pattern',
    '- pronunciation tips',
    '- 3 natural variations',
  ].join('\n');
}
