import { useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Icon, type IconName } from '../../components/Icon';
import { ICON_NAMES } from '../../components/icons';
import { Sheet } from '../../components/Sheet';
import { ThemeToggle } from '../../components/ThemeToggle';
import { UsageBadges } from '../../components/UsageBadges';
import { ungrouped, group, type Token } from '../../styles/tokens';
import { THEME_OPTIONS } from '../../styles/themes';
import { useTokens } from './useTokens';
import styles from './StyleGuide.module.css';

/**
 * Token groups, by name prefix.
 *
 * A prefix rather than a list, so the guide grows with the system: adding
 * `--radius-2xl` puts it under Shape with no edit here. The price is that a
 * token has to be namespaced by its role to be found, which is a reason to keep
 * naming them that way. Anything that matches nothing lands in "Everything
 * else" at the bottom, so a token can never be silently missing from this page.
 */
const GROUPS = [
  { title: 'Colour roles', prefixes: ['--color-'], render: 'swatch' },
  { title: 'Elevation', prefixes: ['--shadow-', '--backdrop'], render: 'shadow' },
  { title: 'Type scale', prefixes: ['--text-'], render: 'type' },
  { title: 'Type roles', prefixes: ['--font-', '--weight-', '--leading-', '--tracking-'] },
  { title: 'Spacing', prefixes: ['--space-'], render: 'space' },
  { title: 'Shape', prefixes: ['--radius-'], render: 'radius' },
  { title: 'Motion', prefixes: ['--duration-', '--ease-', '--transition-'] },
  {
    title: 'Icons and layout',
    prefixes: [
      '--icon-',
      '--tap-target',
      '--content-width',
      '--nav-',
      '--rail-',
      '--blur-',
      '--z-',
    ],
  },
] as const;

/**
 * The design system, showing itself.
 *
 * Not a document describing the design language — a page *rendered by* it. Every
 * token comes from `readTokens`, which asks the loaded stylesheets what they
 * declare and the computed style what each one currently resolves to; every
 * component below is the real component. So there is no version of this page
 * that can drift from the app: a role added to a theme appears here, a role
 * renamed disappears, and switching theme re-reads every value.
 *
 * That is the whole reason it lives inside the app rather than being a static
 * HTML file in `docs/`. A separate file would have been a snapshot, and a
 * snapshot of a design system is a lie with a date on it.
 *
 * It is lazily loaded from the router, so a learner who never opens it never
 * downloads it.
 */
export function StyleGuideScreen() {
  // Read after paint and re-read on every theme change — see `useTokens`, which
  // records why the theme *preference* is the wrong thing to key that on.
  const tokens = useTokens();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chip, setChip] = useState('food');

  const claimed = GROUPS.map((entry) => entry.prefixes);
  const leftovers = ungrouped(tokens, claimed);

  return (
    <AppShell title="Design system" action={<ThemeToggle variant="compact" />}>
      <p className={styles.lede}>
        Everything below is read from the stylesheets the app is running on, and every control is
        the real component. Change a token and this page changes with it.
      </p>

      <div className={styles.themeRow}>
        <span className={styles.themeLabel}>Rendered in</span>
        <ThemeToggle />
      </div>

      <Section title="The design language">
        <ol className={styles.rules}>
          {RULES.map((rule) => (
            <li key={rule.title} className={styles.rule}>
              <Icon name={rule.icon} size="lg" className={styles.ruleIcon} />
              <span>
                <strong className={styles.ruleTitle}>{rule.title}</strong>
                <span className={styles.ruleBody}>{rule.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {GROUPS.map((entry) => {
        const members = group(tokens, ...entry.prefixes);
        if (members.length === 0) return null;
        return (
          <Section key={entry.title} title={entry.title} count={members.length}>
            <TokenList tokens={members} render={'render' in entry ? entry.render : undefined} />
          </Section>
        );
      })}

      {leftovers.length > 0 && (
        <Section title="Everything else" count={leftovers.length}>
          <p className={styles.note}>
            Declared but not claimed by a group above. A token landing here is a hint that its name
            is not saying what it is for.
          </p>
          <TokenList tokens={leftovers} />
        </Section>
      )}

      <Section title="Icons" count={ICON_NAMES.length}>
        <p className={styles.note}>
          Lucide (ISC), behind the seam in <code>components/icons.ts</code>. Names are semantic —{' '}
          <code>listen</code>, not <code>ear</code> — so a better drawing for an idea can replace
          the old one without touching a call site.
        </p>
        <ul className={styles.icons}>
          {ICON_NAMES.map((name) => (
            <li key={name} className={styles.iconCell}>
              <Icon name={name} size="lg" />
              <code className={styles.iconName}>{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Buttons">
        <p className={styles.note}>
          Filled, never outlined. A filled control with a 4.5:1 label is identified by its label and
          its fill; WCAG 1.4.11 asks for a 3:1 boundary only where a boundary is the indicator.
          Press one — the travel and the band beneath it are one token.
        </p>
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="tonal">Tonal</Button>
          <Button>Default</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <div className={styles.row}>
          <Button variant="option" align="start">
            An option to pick
          </Button>
          <Button variant="correct" disabled>
            <Icon name="correct" /> Correct
          </Button>
          <Button variant="incorrect" disabled>
            <Icon name="incorrect" /> Incorrect
          </Button>
        </div>
        <div className={styles.row}>
          <Button outline>Outlined, on request</Button>
          <Button disabled>Disabled</Button>
          <Button icon aria-label="A glyph button">
            <Icon name="speak" />
          </Button>
        </div>
        <Button variant="primary" block large>
          <Icon name="play" />
          Block, large — the one loud control
        </Button>
      </Section>

      <Section title="Chips">
        <p className={styles.note}>
          Selection is <code>aria-pressed</code>, not a class: the attribute outranks{' '}
          <code>:hover</code>, so a selected chip can never fall back to the unselected hover.
        </p>
        <ul className={styles.chips}>
          {['food', 'travel', 'clock', 'colours'].map((topic) => (
            <li key={topic}>
              <Chip
                pressed={chip === topic}
                count={topic.length * 7}
                onClick={() => setChip(topic)}
                aria-label={`${topic}, ${topic.length * 7} items`}
              >
                {topic}
              </Chip>
            </li>
          ))}
          <li>
            <Chip tone="accent" icon="new">
              New
            </Chip>
          </li>
        </ul>
      </Section>

      <Section title="Surfaces">
        <p className={styles.note}>
          Three recipes, in <code>styles/surfaces.module.css</code>, composed into a screen&rsquo;s
          own classes. They replaced the same four declarations written out in six files.
        </p>
        <div className={styles.surfaces}>
          <div className={styles.demoCard}>
            <strong>card</strong>
            <span className={styles.note}>A row in a list.</span>
          </div>
          <div className={styles.demoCardPrimary}>
            <strong>cardPrimary</strong>
            <span className={styles.note}>The screen&rsquo;s subject.</span>
          </div>
          <button type="button" className={styles.demoInteractive}>
            <strong>cardInteractive</strong>
            <span className={styles.note}>Lifts on hover.</span>
          </button>
          <div className={styles.demoWell}>
            <strong>well</strong>
            <span className={styles.note}>Recessed: a slot, a track.</span>
          </div>
        </div>
      </Section>

      <Section title="Badges">
        <UsageBadges address="tu" register="colloquial" regions={['es-MX', 'es-AR']} />
      </Section>

      <Section title="Overlays">
        <p className={styles.note}>
          A sheet on a phone, a panel on a pointer device — and never a panel that grows inside the
          page. Opening this changes nothing about the height of what is behind it.
        </p>
        <Button variant="tonal" onClick={() => setSheetOpen(true)}>
          <Icon name="expand" />
          Open a sheet
        </Button>
        {sheetOpen && (
          <Sheet title="A sheet" onClose={() => setSheetOpen(false)}>
            <p>
              Header and close button pinned, body scrolling, capped at 82% of the viewport, and a
              flick that runs out of sheet stops rather than scrolling the page behind it.
            </p>
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Close
            </Button>
          </Sheet>
        )}
      </Section>

      <Section title="Themes" count={THEME_OPTIONS.length}>
        <p className={styles.note}>
          Themes are colour-only, one file each under <code>styles/themes/</code>, discovered
          automatically by the contrast test — so a new theme is held to WCAG AA the moment it
          exists.
        </p>
        <ul className={styles.themeList}>
          {THEME_OPTIONS.map((option) => (
            <li key={option.id} className={styles.themeItem}>
              <Icon name={option.icon} size="sm" />
              {option.label}
              <code className={styles.iconName}>{option.id}</code>
            </li>
          ))}
        </ul>
      </Section>
    </AppShell>
  );
}

/**
 * The design language, stated where it can be checked against what is below.
 *
 * Typed against `IconName` rather than left to inference, so a rule that names a
 * glyph the set does not have fails the build instead of the page.
 */
const RULES: readonly { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'level',
    title: 'Depth, not outlines.',
    body: 'A boundary is drawn only where it is the only indicator a control has — a select, a text field. Everything else is a surface, a tint and a shadow.',
  },
  {
    icon: 'topic',
    title: 'Soft geometry.',
    body: 'Pills for controls that select, generous radii for containers that hold. Nothing in the app is a right-angled box.',
  },
  {
    icon: 'expand',
    title: 'Overlay, never push.',
    body: 'A control that expands opens over the page. The height of a screen is never a function of which panels happen to be open.',
  },
  {
    icon: 'word',
    title: 'One display voice.',
    body: 'Spanish is set in the display face and set large. The furniture stays small and quiet, so the eye lands on the language.',
  },
  {
    icon: 'theme',
    title: 'Colour means something.',
    body: 'Indigo is the app acting, amber is new material, green and red are verdicts. A fifth hue would need a fifth meaning.',
  },
  {
    icon: 'quick',
    title: 'Motion confirms, never informs.',
    body: 'An animation may accompany a state change; it may never be the state change. Every one of them collapses under prefers-reduced-motion.',
  },
];

function Section({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count?: number;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        {count !== undefined && <span className={styles.sectionCount}>{count}</span>}
      </h2>
      {children}
    </section>
  );
}

/**
 * One row per token: its name, a preview of what it does, and its resolved
 * value. The preview is what makes the page worth opening rather than reading
 * the stylesheet — a hex is not a colour and `22px` is not a corner.
 */
function TokenList({
  tokens,
  render,
}: {
  readonly tokens: readonly Token[];
  readonly render?: 'swatch' | 'shadow' | 'type' | 'space' | 'radius' | undefined;
}) {
  return (
    <ul className={styles.tokens}>
      {tokens.map((token) => (
        <li key={token.name} className={styles.token}>
          <span className={styles.preview}>
            <Preview name={token.name} render={render} />
          </span>
          <code className={styles.tokenName}>{token.name}</code>
          <code className={styles.tokenValue}>{token.value}</code>
        </li>
      ))}
    </ul>
  );
}

/**
 * The preview cell.
 *
 * `style` with a `var()` reference rather than the resolved value, so the swatch
 * is painted by the same cascade the app is — if a token is overridden inside a
 * media query, the swatch shows what is actually in force rather than what the
 * root said.
 */
function Preview({
  name,
  render,
}: {
  readonly name: string;
  readonly render?: 'swatch' | 'shadow' | 'type' | 'space' | 'radius' | undefined;
}) {
  const reference = `var(${name})`;

  switch (render) {
    case 'swatch':
      return <span className={styles.swatch} style={{ background: reference }} />;
    case 'shadow':
      return (
        <span
          className={styles.swatch}
          style={
            name === '--backdrop'
              ? { background: reference }
              : { boxShadow: reference, background: 'var(--color-surface)' }
          }
        />
      );
    case 'type':
      return (
        <span className={styles.typeSample} style={{ fontSize: reference }}>
          Aa
        </span>
      );
    case 'space':
      return <span className={styles.spaceBar} style={{ width: reference }} />;
    case 'radius':
      return <span className={styles.radiusBox} style={{ borderRadius: reference }} />;
    default:
      return <span className={styles.swatchEmpty} aria-hidden="true" />;
  }
}
