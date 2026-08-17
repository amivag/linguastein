import { useServices } from '../../app/services-context';
import type { LearningItem } from '../../domain/content';
import { ShareActions } from '../sharing/ShareActions';
import styles from './Practice.module.css';

interface ItemDetailsProps {
  readonly item: LearningItem;
}

/** "More info" and "Examples" — the expandable half of a practice card (spec §4.1). */
export function ItemDetails({ item }: ItemDetailsProps) {
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
      {item.note && <p>{item.note}</p>}

      {skills.length > 0 && (
        <ul className={styles.examples}>
          {skills.map((skill) => {
            const gloss = repository.translationOf(skill.id, language);
            return (
              <li key={skill.id}>
                <strong>{skill.label}</strong>
                {gloss ? ` — ${gloss.text}` : ''}
              </li>
            );
          })}
        </ul>
      )}

      {examples.length > 0 && (
        <ul className={styles.examples}>
          {examples.map((example) => {
            const translation = repository.translationOf(example.id, language);
            return (
              <li key={example.id}>
                {example.text}
                {translation ? ` — ${translation.text}` : ''}
              </li>
            );
          })}
        </ul>
      )}

      <ShareActions item={item} />
    </div>
  );
}
