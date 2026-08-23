import { createContext, use } from 'react';
import type { BatchDefinition } from '../domain/batches';
import type { Preferences } from '../storage';
import type { AppServices } from './services';

export interface ServicesValue {
  readonly services: AppServices;
  readonly preferences: Preferences;
  updatePreferences(patch: Partial<Preferences>): void;
  /**
   * The learner's batches, live rather than as read at boot.
   *
   * Alongside `preferences` and for the same reason: `services` carries the
   * value loaded once, and this carries the value as it now stands, so a screen
   * that saves one does not have to reload the app to see it.
   */
  readonly batches: readonly BatchDefinition[];
  saveBatch(batch: BatchDefinition): void;
  removeBatch(id: string): void;
}

export const ServicesContext = createContext<ServicesValue | null>(null);

export function useServices(): ServicesValue {
  const value = use(ServicesContext);
  if (!value) throw new Error('useServices must be used inside <ServicesContext>');
  return value;
}
