import { regionLabel, type AddressForm, type LanguageTag, type Register } from '../domain/content';
import { usageHue, type UsageFacet } from '../styles/semantics';
import { Icon, type IconName } from './Icon';
import styles from './UsageBadges.module.css';

interface UsageBadgesProps {
  readonly register?: Register | undefined;
  readonly address?: AddressForm | undefined;
  readonly regions?: readonly LanguageTag[] | undefined;
  readonly compact?: boolean;
}

/**
 * Who you can say this to, and where.
 *
 * Spanish makes these choices unavoidable — address the wrong person as `tú`
 * and you are rude, order a `zumo` in Bogotá and nobody knows what you mean —
 * and neither is recoverable from a translation. Showing them beside the phrase
 * is the difference between knowing words and knowing how to use them.
 *
 * Three facets, and the whole design problem is that they are three: `usted`,
 * `formal` and `es-MX` in a row all look like the same kind of tag, so a learner
 * has to read all three to find the one they wanted. Each facet now carries its
 * own hue from `usageHue` and its own glyph — who you are talking to, how it
 * sounds, where it is said — over a label that still says the word. The colour is
 * a shortcut for someone who has seen the row before; the label is the
 * information, and it is what reaches the accessibility tree.
 *
 * Neutral, unmarked content renders nothing: a badge on everything is noise.
 */
export function UsageBadges({ register, address, regions, compact = false }: UsageBadgesProps) {
  const badges = [
    ...(address ? [{ key: address, ...ADDRESS[address] }] : []),
    ...(register && register !== 'neutral' ? [{ key: register, ...REGISTER[register] }] : []),
    ...(regions ?? []).map((region) => ({
      key: region,
      label: regionLabel(region),
      title: `Said in ${regionLabel(region)}`,
      facet: 'region' as const,
    })),
  ];

  if (badges.length === 0) return null;

  return (
    <ul className={`${styles.badges} ${compact ? styles.compact : ''}`} aria-label="Usage">
      {badges.map((badge) => (
        <li key={badge.key} className={styles.badge} data-kind={usageHue(badge.facet)}>
          {/* `aria-hidden`, like every glyph inside something that names itself:
              the badge's own text is beside it, and `title` carries the rest. */}
          <Icon name={FACET_ICONS[badge.facet]} size="sm" />
          <span title={badge.title}>{badge.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Which glyph each facet wears. The hues are in `src/styles/semantics.ts`. */
const FACET_ICONS: Record<UsageFacet, IconName> = {
  address: 'audience',
  register: 'tone',
  region: 'place',
};

const ADDRESS: Record<AddressForm, { label: string; title: string; facet: 'address' }> = {
  tu: {
    label: 'tú',
    title: 'Informal: someone you address as tú — a friend, a peer, a child',
    facet: 'address',
  },
  usted: {
    label: 'usted',
    title: 'Formal: someone you address as usted — a stranger, an official, an elder',
    facet: 'address',
  },
  vosotros: {
    label: 'vosotros',
    title: 'Informal plural, used in Spain',
    facet: 'address',
  },
  ustedes: {
    label: 'ustedes',
    title: 'Plural: formal in Spain, the everyday plural in Latin America',
    facet: 'address',
  },
};

const REGISTER: Record<
  Exclude<Register, 'neutral'>,
  { label: string; title: string; facet: 'register' }
> = {
  colloquial: {
    label: 'casual',
    title: 'Everyday speech: fine with friends, too casual for formal writing',
    facet: 'register',
  },
  slang: {
    label: 'slang',
    title: 'In-group speech: marks where you are from, and can date you',
    facet: 'register',
  },
  formal: {
    label: 'formal',
    title: 'Polite or professional: service, officials, people you have just met',
    facet: 'register',
  },
  vulgar: { label: 'vulgar', title: 'Crude — know it, do not use it lightly', facet: 'register' },
};
