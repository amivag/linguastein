import { useCallback, useRef, useState } from 'react';

export type LocalWriteStatus = 'saved' | 'saving' | 'failed';
interface Job {
  readonly write: () => Promise<unknown>;
  running: boolean;
}
/** Keep failed operations (and their original ids) available for an explicit retry. */
export function useLocalWrites() {
  const jobs = useRef(new Map<string, Job>());
  const [status, setStatus] = useState<LocalWriteStatus>('saved');
  const publish = useCallback(() => {
    const held = [...jobs.current.values()];
    setStatus(held.some((job) => !job.running) ? 'failed' : held.length > 0 ? 'saving' : 'saved');
  }, []);
  const enqueue = useCallback(
    (key: string, write: () => Promise<unknown>) => {
      const job: Job = { write, running: true };
      jobs.current.set(key, job);
      publish();
      void Promise.resolve()
        .then(write)
        .then(
          () => {
            if (jobs.current.get(key) === job) jobs.current.delete(key);
            publish();
          },
          () => {
            job.running = false;
            publish();
          },
        );
    },
    [publish],
  );
  const retry = useCallback(() => {
    for (const [key, job] of jobs.current) if (!job.running) enqueue(key, job.write);
  }, [enqueue]);
  return { status, enqueue, retry };
}
