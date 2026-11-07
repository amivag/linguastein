import { Button } from '@platform/ui';
import type { LocalWriteStatus } from './useLocalWrites';

export function PersistenceNotice({
  status,
  onRetry,
}: {
  readonly status: LocalWriteStatus;
  readonly onRetry: () => void;
}) {
  if (status !== 'failed') return null;
  return (
    <div role="alert">
      <p>Some progress could not be saved. Keep this page open and retry.</p>
      <Button onClick={onRetry}>Retry saving</Button>
    </div>
  );
}
