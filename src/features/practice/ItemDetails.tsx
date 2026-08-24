import { useServices } from '../../app/services-context';
import { Annotation } from '../../components/Annotation';
import { TokenizedText } from '../../components/TokenizedText';
import type { ItemId, LearningItem, TokenId } from '../../domain/content';
import { ShareActions } from '../sharing/ShareActions';
import styles from './Practice.module.css';

interface ItemDetailsProps {
  readonly item: LearningItem;
  /**
   * Opens a word of one of the example sentences.
   *
   * The examples are ordinary items, so there is no reason a word inside one
   * should be less answerable than a word in the phrase above it — which is
   * what "meanings everywhere" has to mean to be worth anything.
   */
  readonly onSelectWord?: ((itemId: ItemId, tokenId: TokenId) => void) | undefined;
  readonly selectedTokens?: ((itemId: ItemId) => readonly TokenId[]) | undefined;
}

/** "More info" and "Examples" — the expandable half of a practice card (spec §4.1). */
export function ItemDetails({ item, onSelectWord, selectedTokens }: ItemDetailsProps) {
  const { services, preferences } = useServices();
  const { repository } = services;
  const language = preferences.referenceLanguage;

  const skills = (item.skills ?? [])
    .map((id) => repository.getSkill(id))
    .filter((skill) => skill !== undefined);
  const examples = (item.examples ?? [])
    .map((id) => repository.getItem(id))
    .filter((example) => example !== undefined);

  return (
    <div className={styles.details}>
      {item.note && <Annotation facet="note">{item.note}</Annotation>}

      {/*
        What this phrase lets you do, as one labelled group rather than as bullets.
        One hue for the whole list rather than one per skill: these are several
        facets of the *same* claim, and a colour each would say they were several
        kinds of thing.
      */}
      {skills.length > 0 && (
        <Annotation facet="ability" label={skills.length === 1 ? 'Ability' : 'Abilities'}>
          <ul className={styles.abilities}>
            {skills.map((skill) => {
              const gloss = repository.translationOf(skill.id, language);
              return (
                <li key={skill.id}>
                  <strong>{skill.label}</strong>
                  {gloss ? <span className={styles.hint}>{gloss.text}</span> : null}
                </li>
              );
            })}
          </ul>
        </Annotation>
      )}

      {examples.length > 0 && (
        <ul className={styles.examples}>
          {examples.map((example) => {
            const translation = repository.translationOf(example.id, language);
            return (
              <li key={example.id}>
                <TokenizedText
                  item={example}
                  className={styles.exampleText}
                  onSelect={onSelectWord ? (token) => onSelectWord(example.id, token) : undefined}
                  selected={selectedTokens?.(example.id)}
                  contextLabel={example.text}
                />
                {translation ? <span className={styles.hint}>{translation.text}</span> : null}
              </li>
            );
          })}
        </ul>
      )}

      <ShareActions item={item} />
    </div>
  );
}
