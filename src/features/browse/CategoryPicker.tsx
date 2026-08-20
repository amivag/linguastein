import type { ReactNode } from 'react';
import type { TopicFacet } from '../../domain/content';
import styles from './CategoryPicker.module.css';

interface CategoryPickerProps {
  readonly topics: readonly TopicFacet[];
  /** Currently selected topic id, or `all` for no narrowing. */
  readonly selected: string;
  readonly onSelect: (topic: string) => void;
  /**
   * The compact control for this same state — Browse's topic `<select>`. It sits
   * beside the heading rather than in the row of filters below, so the two
   * topic controls read as one filter and the chosen category stays legible
   * once the pane has scrolled its tile out of view.
   */
  readonly action?: ReactNode;
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
 * The tiles live in a box of a fixed height and scroll inside it: laid out in
 * full they were the tallest thing on the screen, and the results the page is
 * actually about started below the fold.
 *
 * Empty categories are dropped: the registry deliberately lets a category be
 * declared before its content exists, and offering a tile that leads to nothing
 * is worse than not offering it yet.
 */
export function CategoryPicker({ topics, selected, onSelect, action }: CategoryPickerProps) {
  const groups = groupTopics(topics.filter((topic) => topic.count > 0));
  if (groups.length === 0) return null;

  return (
    <section className={styles.picker} aria-labelledby="browse-categories">
      <div className={styles.bar}>
        <h2 className={styles.heading} id="browse-categories">
          Categories
        </h2>
        {action && <div className={styles.action}>{action}</div>}
      </div>

      <div className={styles.pane}>
        {groups.map((group) => (
          <div key={group.label} className={styles.group}>
            {group.label && <h3 className={styles.groupHeading}>{group.label}</h3>}
            <ul className={styles.tiles}>
              {group.topics.map((topic) => {
                const pressed = topic.id === selected;
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      className={styles.tile}
                      // Spelled out rather than left to concatenation: the label
                      // and the count are adjacent inline spans, so the computed
                      // name would be "Numbers27" — technically present, useless
                      // to a screen reader and to an agent matching on a name.
                      aria-label={`${topic.label}, ${topic.count} ${topic.count === 1 ? 'item' : 'items'}`}
                      // The button *is* the state, so it carries it rather than
                      // relying on the highlight a colour-only style would give.
                      aria-pressed={pressed}
                      // Pressing the selected tile clears it, so the picker can
                      // undo itself without reaching for the neighbouring select.
                      onClick={() => onSelect(pressed ? 'all' : topic.id)}
                    >
                      <span className={styles.label}>{topic.label}</span>
                      <span className={styles.count}>{topic.count}</span>
                    </button>
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
