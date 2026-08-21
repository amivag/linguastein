import { regionLabel, type AddressForm, type LanguageTag, type Register } from '../domain/content';
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
      tone: 'region' as const,
    })),
  ];

  if (badges.length === 0) return null;

  return (
    <ul className={`${styles.badges} ${compact ? styles.compact : ''}`} aria-label="Usage">
      {badges.map((badge) => (
        <li key={badge.key} className={`${styles.badge} ${styles[badge.tone]}`} title={badge.title}>
          {badge.label}
        </li>
      ))}
    </ul>
  );
}

const ADDRESS: Record<AddressForm, { label: string; title: string; tone: 'address' }> = {
  tu: {
    label: 'tú',
    title: 'Informal: someone you address as tú — a friend, a peer, a child',
    tone: 'address',
  },
  usted: {
    label: 'usted',
    title: 'Formal: someone you address as usted — a stranger, an official, an elder',
    tone: 'address',
  },
  vosotros: {
    label: 'vosotros',
    title: 'Informal plural, used in Spain',
    tone: 'address',
  },
  ustedes: {
    label: 'ustedes',
    title: 'Plural: formal in Spain, the everyday plural in Latin America',
    tone: 'address',
  },
};

const REGISTER: Record<
  Exclude<Register, 'neutral'>,
  { label: string; title: string; tone: 'register' }
> = {
  colloquial: {
    label: 'casual',
    title: 'Everyday speech: fine with friends, too casual for formal writing',
    tone: 'register',
  },
  slang: {
    label: 'slang',
    title: 'In-group speech: marks where you are from, and can date you',
    tone: 'register',
  },
  formal: {
    label: 'formal',
    title: 'Polite or professional: service, officials, people you have just met',
    tone: 'register',
  },
  vulgar: { label: 'vulgar', title: 'Crude — know it, do not use it lightly', tone: 'register' },
};
