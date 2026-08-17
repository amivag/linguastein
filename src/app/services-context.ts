import { createContext, use } from 'react';
import type { Preferences } from '../storage';
import type { AppServices } from './services';

export interface ServicesValue {
  readonly services: AppServices;
  readonly preferences: Preferences;
  updatePreferences(patch: Partial<Preferences>): void;
}

export const ServicesContext = createContext<ServicesValue | null>(null);

export function useServices(): ServicesValue {
  const value = use(ServicesContext);
  if (!value) throw new Error('useServices must be used inside <ServicesContext>');
  return value;
}
