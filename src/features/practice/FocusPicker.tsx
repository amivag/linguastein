import { useId, useState } from 'react';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { SESSION_FOCUSES, type SessionFocus } from '../../domain/sessions';
import { CategoryPicker } from '../browse/CategoryPicker';
import styles from './FocusPicker.module.css';

/** What each focus promises, in the order a learner is likely to want them. */
const FOCUS_LABELS: Record<SessionFocus, { label: string; description: string }> = {
  balanced: { label: 'Balanced', description: 'Reviews first, a little new material mixed in' },
  struggling: { label: 'Shaky items', description: 'The ones going wrong, hardest first' },
  due: { label: 'Reviews', description: 'Clear what is due before anything else' },
  fresh: { label: 'New material', description: 'Unseen items first, and uncapped' },
};

/**
 * What to practise: which categories, and which items to lead with.
 *
 * It lives on the practice screen rather than in Settings because it is a
 * practice decision, and it is a *standing* one — a learner working through
 * food and travel should not have to re-pick that before every session. The
 * choice is written into the session link all the same, so a session stays fully
 * described by its URL and can still be shared or scripted.
 *
 * Collapsed by default, and summarised while collapsed: the category pane is
 * tall, and this must not be the first thing between a learner and the button
 * they came to press.
 */
export function FocusPicker() {
  const { services, preferences, updatePreferences } = useServices();
  const { filter } = useCourse();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Counted within the course, so a category cannot advertise items the current
  // level puts out of reach — and a category with nothing in scope is not
  // offered at all, matching what the picker shows.
  const topics = services.repository.topics(filter);
  const offered = new Map(
    topics.filter((topic) => topic.count > 0).map((topic) => [topic.id, topic.label]),
  );

  /**
   * What the summary and the tiles reflect: the stored choice, minus categories
   * this course has no content for. Switching down to A1 must not leave the bar
   * boasting about a B1 category that is currently unreachable.
   */
  const chosen = preferences.focusTopics.filter((topic) => offered.has(topic));

  const toggle = (topic: string) => {
    // Written against the *stored* list rather than the visible one, so
    // toggling a category while narrowed does not silently discard a choice
    // made at a wider level.
    const stored = preferences.focusTopics;
    const next = stored.includes(topic)
      ? stored.filter((entry) => entry !== topic)
      : [...stored, topic];
    updatePreferences({ focusTopics: next });
  };

  const summary = [
    chosen.length === 0
      ? 'Everything'
      : chosen.length <= 2
        ? chosen.map((topic) => offered.get(topic) ?? topic).join(' + ')
        : `${chosen.length} categories`,
    FOCUS_LABELS[preferences.focus].label.toLowerCase(),
  ].join(' · ');

  return (
    <section className={styles.focus} aria-labelledby={`${panelId}-title`}>
      <div className={styles.bar}>
        <h2 className={styles.title} id={`${panelId}-title`}>
          Practising
        </h2>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          {/* The name says what the control does as well as what it currently
              says, so "Everything · balanced" is not the whole of what a screen
              reader hears when it lands on a button. */}
          <span className="visually-hidden">Change what to practise: </span>
          <span className={styles.summary}>{summary}</span>
          <span className={styles.chevron} aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        </button>
      </div>

      {/* Rendered only while open. A hidden panel whose controls stay in the
          accessibility tree is a screen reader walking through twelve category
          buttons that are not on the screen. */}
      {open && (
        <div className={styles.panel} id={panelId}>
          <fieldset className={styles.modes}>
            <legend className={styles.legend}>Lead with</legend>
            {SESSION_FOCUSES.map((focus) => {
              const pressed = preferences.focus === focus;
              return (
                <button
                  key={focus}
                  type="button"
                  className={styles.mode}
                  aria-pressed={pressed}
                  onClick={() => updatePreferences({ focus })}
                >
                  <span className={styles.modeLabel}>{FOCUS_LABELS[focus].label}</span>
                  <span className={styles.modeDescription}>{FOCUS_LABELS[focus].description}</span>
                </button>
              );
            })}
          </fieldset>

          <CategoryPicker
            id={`${panelId}-categories`}
            title="Categories"
            topics={topics}
            selected={chosen}
            // Several at once here, unlike Browse: "food and travel" is a
            // normal thing to be working on, and one category at a time would
            // make that two separate sessions.
            onToggle={toggle}
          />

          {chosen.length > 0 && (
            <button
              type="button"
              className={styles.clear}
              onClick={() => updatePreferences({ focusTopics: [] })}
            >
              Practise everything
            </button>
          )}

          <p className={styles.note}>
            A focus decides what comes first, not what is allowed: nothing is held back, so a
            session is never empty because you were doing well.
          </p>
        </div>
      )}
    </section>
  );
}
