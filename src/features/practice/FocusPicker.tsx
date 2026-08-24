import { useId, useState } from 'react';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { SESSION_FOCUSES, type SessionFocus } from '../../domain/sessions';
import type { IconName } from '../../components/Icon';
import { CategoryPicker } from '../browse/CategoryPicker';
import styles from './FocusPicker.module.css';

/** What each focus promises, in the order a learner is likely to want them. */
const FOCUS_LABELS: Record<SessionFocus, { label: string; description: string; icon: IconName }> = {
  balanced: {
    label: 'Balanced',
    description: 'Reviews first, a little new material mixed in',
    icon: 'shuffle',
  },
  struggling: {
    label: 'Shaky items',
    description: 'The ones going wrong, hardest first',
    icon: 'memory',
  },
  due: { label: 'Reviews', description: 'Clear what is due before anything else', icon: 'due' },
  fresh: { label: 'New material', description: 'Unseen items first, and uncapped', icon: 'new' },
  recent: {
    label: 'Where I left off',
    description: 'The material you practised most recently, first',
    icon: 'history',
  },
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
 * The screen shows only the summary; changing it happens in a sheet.
 *
 * That is the point, and it used to be an inline panel: opening it pushed the
 * "Quick session" buttons, the six presets and the whole rest of Home down by
 * something like four hundred pixels, so the act of narrowing what you practise
 * moved the button you were about to press off the screen. The page's height is
 * no longer a function of whether this is open.
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
          // Still `aria-expanded`, and still pointing at the panel it opens: a
          // dialog is what the control reveals, so the relationship a screen
          // reader is told about is unchanged by where the panel is drawn.
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Icon name="tune" size="sm" className={styles.tuneIcon} />
          {/* The name says what the control does as well as what it currently
              says, so "Everything · balanced" is not the whole of what a screen
              reader hears when it lands on a button. */}
          <span className="visually-hidden">Change what to practise: </span>
          <span className={styles.summary}>{summary}</span>
          <Icon name="expand" size="sm" className={styles.chevron} />
        </button>
      </div>

      {/*
        Rendered only while open. A hidden panel whose controls stay in the
        accessibility tree is a screen reader walking through twelve category
        buttons that are not on the screen.

        No wrapper element around the sheet: this section is a grid, and a flow
        child collects a `gap` even when its only content is fixed — which
        pushed the rest of Home down by 12px on open. The id goes on the dialog.
      */}
      {open && (
        <Sheet id={panelId} title="What to practise" width="wide" onClose={() => setOpen(false)}>
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
                  <Icon name={FOCUS_LABELS[focus].icon} size="lg" className={styles.modeIcon} />
                  <span className={styles.modeText}>
                    <span className={styles.modeLabel}>{FOCUS_LABELS[focus].label}</span>
                    <span className={styles.modeDescription}>
                      {FOCUS_LABELS[focus].description}
                    </span>
                  </span>
                  {pressed && <Icon name="check" size="sm" className={styles.modeCheck} />}
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
            <Button block onClick={() => updatePreferences({ focusTopics: [] })}>
              Practise everything
            </Button>
          )}

          <p className={styles.note}>
            A focus decides what comes first, not what is allowed: nothing is held back, so a
            session is never empty because you were doing well.
          </p>
        </Sheet>
      )}
    </section>
  );
}
