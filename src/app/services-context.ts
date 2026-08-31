import { createContext, use } from 'react';
import type { BatchDefinition } from '../domain/batches';
import type { CourseState, CourseStates, Preferences } from '../storage';
import type { AppServices } from './services';

export interface ServicesValue {
  readonly services: AppServices;
  readonly preferences: Preferences;
  updatePreferences(patch: Partial<Preferences>): void;
  /**
   * Every course's own choices, live rather than as read at boot.
   *
   * Read through `useCourse()` rather than from here: a screen wants *this*
   * course's level and accent, and the open course is a fact about the path.
   * Exposed on the context all the same because `/` has to pick a course before
   * there is one open, which is the one question no `useCourse` can answer.
   */
  readonly courses: CourseStates;
  updateCourse(language: string, patch: Partial<CourseState>): void;
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
