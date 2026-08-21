import { useEffect, useState } from 'react';
import { buildLearnerContext, type LearnerContext } from '../../ai';
import { useServices } from '../../app/services-context';
import { APP } from '../../app/identity';
import { Button } from '../../components/Button';
import type { LearningItem } from '../../domain/content';
import { canShare, copyToClipboard, shareText } from '../../utils/clipboard';
import { buildSharePayloads } from './payloads';
import { Icon } from '../../components/Icon';
import styles from './ShareActions.module.css';

interface ShareActionsProps {
  readonly item: LearningItem;
}

export function ShareActions({ item }: ShareActionsProps) {
  const { services, preferences } = useServices();
  const [copied, setCopied] = useState<string | null>(null);
  const [learner, setLearner] = useState<LearnerContext | null>(null);

  // Loaded lazily: the learner summary is only needed if someone opens this.
  useEffect(() => {
    let cancelled = false;
    void services.storage.progress.all().then((progress) => {
      if (cancelled) return;
      setLearner(
        buildLearnerContext({
          repository: services.repository,
          progress,
          referenceLanguage: preferences.referenceLanguage,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [services, preferences.referenceLanguage]);

  const payloads = buildSharePayloads(
    services.repository,
    item,
    preferences.referenceLanguage,
    learner ?? undefined,
  );

  const copy = async (id: string, text: string) => {
    const ok = await copyToClipboard(text);
    setCopied(ok ? id : null);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <Icon name="share" size="sm" />
        Copy &amp; share
        <Icon name="expand" size="sm" className={styles.marker} />
      </summary>
      <div className={styles.actions}>
        {payloads.map((payload) => (
          <Button key={payload.id} block onClick={() => void copy(payload.id, payload.text)}>
            {copied === payload.id ? (
              <>
                <Icon name="check" /> Copied
              </>
            ) : (
              payload.label
            )}
          </Button>
        ))}
        {canShare() && (
          <Button block onClick={() => void shareText(item.text, APP.name)}>
            Share…
          </Button>
        )}
      </div>
    </details>
  );
}
