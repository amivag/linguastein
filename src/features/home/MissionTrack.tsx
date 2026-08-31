import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import styles from './MissionTrack.module.css';

export interface MissionCard {
  readonly id: string;
  /** `Mission 3 of 13`, or the review card's own line. */
  readonly eyebrow: string;
  readonly title: string;
  /** A line from the exchange, in the target language. */
  readonly phrase: string;
  readonly phraseMeaning?: string;
  readonly language: string;
  readonly icon: IconName;
  readonly facts: readonly { readonly icon: IconName; readonly text: string }[];
  /** What the button says. */
  readonly action: string;
  /**
   * The button's accessible name, which has to name the mission.
   *
   * Thirteen buttons all called `Begin mission · 18 min` are thirteen identical
   * rows in a screen reader's list of controls, and the one thing they differ
   * by — which mission — is the only thing that matters when choosing. Visible
   * text stays short; the name carries the rest.
   */
  readonly actionName: string;
  readonly onStart: () => void;
  /** Finished missions stay openable — this only marks them. */
  readonly done?: boolean;
}

interface MissionTrackProps {
  readonly cards: readonly MissionCard[];
  /** Which card the track opens on: what the app recommends doing next. */
  readonly startIndex: number;
  readonly label: string;
}

/**
 * The journey as a track you can swipe through, rather than one card at a time.
 *
 * Home used to show only the next rung, with the whole ladder in Study — a
 * deliberate split, and one that made choosing something else a two-screen trip
 * for what is a one-gesture decision: "not that one, the next one". The track
 * keeps the recommendation (it is the card the strip opens on, and it says so)
 * and makes the rest reachable without leaving the screen. Study still holds the
 * ladder, and still says more about each rung than a card can.
 *
 * **Scrolling rather than a carousel**, which is the whole of the accessibility
 * story. Every card is a real `<li>` that is always in the accessibility tree
 * and always reachable by keyboard, so nothing is hidden behind a widget that
 * has to re-announce itself. The snap points and the arrows are conveniences on
 * top of a list that works without either — and on a touch screen the gesture is
 * the native one, which no JS carousel gets right.
 */
export function MissionTrack({ cards, startIndex, label }: MissionTrackProps) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(startIndex);
  /**
   * Where the strip is heading, which is not always where it is.
   *
   * A ref beside the state rather than instead of it, and the reason is a real
   * failure rather than tidiness: two quick taps on Next both read `current`
   * from the same render and both compute `0 + 1`, so the strip advanced one
   * card for two presses. Anyone browsing thirteen missions taps that button
   * repeatedly. The ref is written synchronously, so the second press sees where
   * the first one sent it.
   */
  const heading = useRef(startIndex);

  /**
   * Opened on the recommended card, without animating there.
   *
   * `scrollLeft` rather than `scrollIntoView`, because the latter scrolls every
   * ancestor: landing on Home would jump the page down to wherever the strip
   * sits. Guarded because jsdom has no layout — every width is 0, so this is a
   * no-op in tests rather than a crash.
   */
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    element.scrollLeft = offsetOf(element, startIndex);
    heading.current = startIndex;
    setCurrent(startIndex);
  }, [startIndex]);

  /*
   * Which card is showing, read off the scroll position rather than tracked as
   * state the arrows write. A swipe and an arrow press have to agree, and the
   * scroll position is the one thing both of them actually move.
   */
  const sync = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const width = element.clientWidth;
    if (width === 0) return;
    const at = Math.min(cards.length - 1, Math.max(0, Math.round(element.scrollLeft / width)));
    // A swipe is the learner overruling wherever the arrows were sending it.
    heading.current = at;
    setCurrent(at);
  }, [cards.length]);

  const step = (delta: number) => {
    const element = track.current;
    const target = Math.min(cards.length - 1, Math.max(0, heading.current + delta));
    heading.current = target;
    if (element) element.scrollTo?.({ left: offsetOf(element, target), behavior: 'smooth' });
    // Set directly as well as on scroll: jsdom fires no scroll event, and on a
    // real device the readout should move with the press rather than after it.
    setCurrent(target);
  };

  return (
    <div className={styles.wrap}>
      {/*
        `tabIndex` because a scrollable region has to be reachable by keyboard —
        without it, a learner who cannot swipe or drag has no way to move the
        strip, which axe reports as `scrollable-region-focusable` and which is
        the commonest way a carousel is unusable rather than merely awkward.
      */}
      <div
        ref={track}
        className={styles.track}
        onScroll={sync}
        tabIndex={0}
        role="group"
        aria-label={label}
      >
        <ul className={styles.list}>
          {cards.map((card, index) => (
            <li
              key={card.id}
              className={styles.slide}
              data-slide={index}
              // The recommendation, stated rather than only implied by which
              // card the strip happens to open on.
              {...(index === startIndex ? { 'aria-current': 'step' as const } : {})}
            >
              {/* A plain wrapper: the `<li>` is what makes this a thing in a
                  list, and a second landmark-ish role inside it would only add
                  a `role="article"` for anything counting them on this screen
                  to trip over — `home-search.test.tsx` counts exactly that. */}
              <div className={styles.card}>
                <p className={styles.eyebrow}>
                  {card.eyebrow}
                  {card.done && (
                    <span className={styles.done}>
                      <Icon name="check" size="sm" />
                      Done
                    </span>
                  )}
                </p>

                <div className={styles.heading}>
                  <div>
                    <h3 className={styles.title}>{card.title}</h3>
                    <p className={styles.phrase} lang={card.language}>
                      {card.phrase}
                    </p>
                    {card.phraseMeaning && <p className={styles.meaning}>{card.phraseMeaning}</p>}
                  </div>
                  <span className={styles.icon} aria-hidden="true">
                    <Icon name={card.icon} size="xl" />
                  </span>
                </div>

                <div className={styles.facts}>
                  {card.facts.map((fact) => (
                    <span key={fact.text}>
                      <Icon name={fact.icon} />
                      {fact.text}
                    </span>
                  ))}
                </div>

                <Button
                  variant="primary"
                  block
                  large
                  aria-label={card.actionName}
                  onClick={card.onStart}
                >
                  <Icon name="play" />
                  {card.action}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/*
        Arrows and a position, for everyone the swipe does not serve: a mouse
        with no horizontal wheel, a trackpad nobody has told the learner about,
        and the reader who wants to know how much of this there is. Hidden
        entirely for a single card, where they would be three controls that do
        nothing.
      */}
      {cards.length > 1 && (
        <div className={styles.controls}>
          <Button aria-label="Previous mission" disabled={current === 0} onClick={() => step(-1)}>
            <Icon name="back" size="sm" />
          </Button>
          <p className={styles.position}>
            {current + 1} of {cards.length}
          </p>
          <Button
            aria-label="Next mission"
            disabled={current === cards.length - 1}
            onClick={() => step(1)}
          >
            <Icon name="next" size="sm" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * How far to scroll for slide `index`, measured from the *first slide* rather
 * than from the container.
 *
 * `slide.offsetLeft - element.offsetLeft` looks equivalent and is not: a slide's
 * offset includes the strip's own left padding — the padding that pairs with the
 * negative margin to keep the cards lined up with the rest of the screen — so
 * scrolling to slide 0 by that measure scrolled the padding away and left the
 * first card flush against the edge of the display. Measured slide-to-slide the
 * padding cancels, and slide 0 is 0.
 */
function offsetOf(track: HTMLElement, index: number): number {
  const first = track.querySelector<HTMLElement>('[data-slide="0"]');
  const slide = track.querySelector<HTMLElement>(`[data-slide="${index}"]`);
  return first && slide ? slide.offsetLeft - first.offsetLeft : 0;
}
