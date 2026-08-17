import { useState } from 'react';
import { useServices } from '../../app/services-context';
import { Button } from '../../components/Button';
import type { LearningItem } from '../../domain/content';
import { canShare, copyToClipboard, shareText } from '../../utils/clipboard';
import { buildSharePayloads } from './payloads';
import styles from './ShareActions.module.css';

interface ShareActionsProps {
  readonly item: LearningItem;
}

export function ShareActions({ item }: ShareActionsProps) {
  const { services, preferences } = useServices();
  const [copied, setCopied] = useState<string | null>(null);
  const payloads = buildSharePayloads(services.repository, item, preferences.referenceLanguage);

  const copy = async (id: string, text: string) => {
    const ok = await copyToClipboard(text);
    setCopied(ok ? id : null);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>Copy &amp; share</summary>
      <div className={styles.actions}>
        {payloads.map((payload) => (
          <Button key={payload.id} block onClick={() => void copy(payload.id, payload.text)}>
            {copied === payload.id ? 'Copied ✓' : payload.label}
          </Button>
        ))}
        {canShare() && (
          <Button block onClick={() => void shareText(item.text, 'Lingo')}>
            Share…
          </Button>
        )}
      </div>
    </details>
  );
}
