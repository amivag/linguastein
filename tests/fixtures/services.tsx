import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ServicesContext } from '../../src/app/services-context';
import type { AppServices } from '../../src/app/services';
import type { BatchDefinition } from '../../src/domain/batches';
import { NOOP_PLAYBACK, type AudioService, type SpeechRecognitionProvider } from '../../src/audio';
import { ExerciseEngine } from '../../src/domain/exercises';
import { createMemoryStorage, DEFAULT_PREFERENCES, type Preferences } from '../../src/storage';
import { testRepository } from './pack';

/** No device speech in tests, but the dataset-audio path stays reachable. */
const silentAudio: AudioService = {
  play: () => Promise.resolve(NOOP_PLAYBACK),
  speak: () => Promise.resolve(NOOP_PLAYBACK),
  stop: () => {},
  canPlay: () => true,
  canSpeak: () => true,
  voicesFor: () => [],
  voiceFor: () => undefined,
  ready: () => Promise.resolve(),
};

/** No microphone in tests unless a case supplies one. */
const noSpeech: SpeechRecognitionProvider = {
  id: 'none',
  isAvailable: () => false,
  supportsLanguage: () => false,
  listen: () => Promise.reject(new Error('unavailable')),
  stop: () => {},
};

export function testServices(overrides: Partial<AppServices> = {}): AppServices {
  return {
    repository: testRepository(),
    storage: createMemoryStorage(),
    audio: silentAudio,
    speech: noSpeech,
    exercises: new ExerciseEngine(),
    preferences: DEFAULT_PREFERENCES,
    batches: [],
    datasetIssues: [],
    ...overrides,
  };
}

export function renderWithServices(
  ui: ReactElement,
  options: {
    services?: AppServices;
    route?: string;
    /** Supply one to assert on what a control tried to change. */
    updatePreferences?: (patch: Partial<Preferences>) => void;
    /** Supply one to assert on a batch a control tried to save. */
    saveBatch?: (batch: BatchDefinition) => void;
    removeBatch?: (id: string) => void;
  } = {},
) {
  const services = options.services ?? testServices();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesContext
      value={{
        services,
        preferences: services.preferences,
        updatePreferences: options.updatePreferences ?? (() => {}),
        // The batches a screen reads are the ones the services were built with,
        // exactly as `preferences` is: a test that needs one supplies it through
        // `testServices({ batches })` rather than through a second channel.
        batches: services.batches,
        saveBatch: options.saveBatch ?? (() => {}),
        removeBatch: options.removeBatch ?? (() => {}),
      }}
    >
      <MemoryRouter initialEntries={[options.route ?? '/']}>{children}</MemoryRouter>
    </ServicesContext>
  );

  return { services, ...render(ui, { wrapper }) };
}
