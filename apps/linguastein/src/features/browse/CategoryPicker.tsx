import { Chip } from '../../components/Chip';
import type { TopicFacet } from '../../domain/content';
import styles from './CategoryPicker.module.css';

interface CategoryPickerProps {
  readonly topics: readonly TopicFacet[];
  /** Currently selected topic ids; empty means no narrowing. */
  readonly selected: readonly string[];
  /**
   * A tile was pressed. Whether that adds to the selection or replaces it is
   * the caller's decision — Browse filters by one category, practice
   * preferences by several — and keeping it there is what lets both use this
   * one picker instead of two that drift.
   */
  readonly onToggle: (topic: string) => void;
  /** Heading and `aria-labelledby` target; unique per instance on a screen. */
  readonly id?: string;
  readonly title?: string;
}

/** Categories under one heading, in the order the pack declared them. */
interface Group {
  readonly label: string;
  readonly topics: readonly TopicFacet[];
}

/**
 * "Numbers", "Colours", "Days of the week" — the thematic way into the pack.
 *
 * A `<select>` of thirty-five slugs technically offered this already and nobody
 * would ever find it, which is the whole reason this exists. It writes the same
 * filter state as that select rather than a parallel one, so the two cannot
 * disagree about what is selected.
 *
 * Browse places the picker in its filter sheet, so the sheet owns scrolling.
 * Keeping a second scroll region around the tiles made categories feel clipped
 * and hid the rest of the filters on touch screens.
 *
 * Empty categories are dropped: the registry deliberately lets a category be
 * declared before its content exists, and offering a tile that leads to nothing
 * is worse than not offering it yet.
 */
export function CategoryPicker({
  topics,
  selected,
  onToggle,
  id = 'browse-categories',
  title = 'Categories',
}: CategoryPickerProps) {
  const groups = groupTopics(topics.filter((topic) => topic.count > 0));
  if (groups.length === 0) return null;

  return (
    <section className={styles.picker} aria-labelledby={id}>
      <h2 className={styles.heading} id={id}>
        {title}
      </h2>

      <div className={styles.pane}>
        {groups.map((group) => (
          <div key={group.label} className={styles.group}>
            {group.label && <h3 className={styles.groupHeading}>{group.label}</h3>}
            <ul className={styles.tiles}>
              {group.topics.map((topic) => {
                const pressed = selected.includes(topic.id);
                return (
                  <li key={topic.id}>
                    <Chip
                      // Spelled out rather than left to concatenation: the label
                      // and the count are adjacent inline spans, so the computed
                      // name would be "Numbers27" — technically present, useless
                      // to a screen reader and to an agent matching on a name.
                      aria-label={`${topic.label}, ${topic.count} ${topic.count === 1 ? 'item' : 'items'}`}
                      // The chip *is* the state, so it carries it rather than
                      // relying on the highlight a colour-only style would give.
                      pressed={pressed}
                      count={topic.count}
                      // The same hue this category wears on its Study tile,
                      // because both are derived from the topic id rather than
                      // from where it sits in either list.
                      hue={topic.id}
                      onClick={() => onToggle(topic.id)}
                    >
                      {topic.label}
                    </Chip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Groups in order of first appearance, so the pack's authoring order survives.
 * Sorting alphabetically here would silently discard the decision `topics.tsv`
 * makes on purpose — that a beginner's categories come first.
 */
function groupTopics(topics: readonly TopicFacet[]): readonly Group[] {
  const groups = new Map<string, TopicFacet[]>();
  for (const topic of topics) {
    const label = topic.group ?? '';
    const existing = groups.get(label);
    if (existing) existing.push(topic);
    else groups.set(label, [topic]);
  }
  return [...groups].map(([label, entries]) => ({ label, topics: entries }));
}
