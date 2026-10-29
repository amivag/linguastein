import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocalWrites } from '../../src/components/useLocalWrites';

describe('local write feedback', () => {
  it('waits for every in-flight write before reporting saved', async () => {
    let finish: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const { result } = renderHook(useLocalWrites);
    act(() => {
      result.current.enqueue('one', () => held);
      result.current.enqueue('two', async () => {});
    });
    expect(result.current.status).toBe('saving');
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe('saving');
    await act(async () => finish!());
    await waitFor(() => expect(result.current.status).toBe('saved'));
  });

  it('keeps failed operations, catches synchronous errors and retries only once while pending', async () => {
    const write = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => {
        throw new Error('Quota');
      })
      .mockResolvedValue(undefined);
    const successful = vi.fn(async () => {});
    const { result } = renderHook(useLocalWrites);
    act(() => {
      result.current.enqueue('failed', write);
      result.current.enqueue('good', successful);
    });
    await waitFor(() => expect(result.current.status).toBe('failed'));
    act(() => {
      result.current.retry();
      result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(write).toHaveBeenCalledTimes(2);
    expect(successful).toHaveBeenCalledTimes(1);
  });

  it('does not let completion of an older same-key operation hide a newer write', async () => {
    let finish: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const { result } = renderHook(useLocalWrites);
    act(() => {
      result.current.enqueue('same', async () => {});
      result.current.enqueue('same', () => held);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe('saving');
    await act(async () => finish!());
    await waitFor(() => expect(result.current.status).toBe('saved'));
  });
});
