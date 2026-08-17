import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ServicesContext } from '../../src/app/services-context';
import type { AppServices } from '../../src/app/services';
import { NOOP_PLAYBACK, type AudioService, type SpeechRecognitionProvider } from '../../src/audio';
import { ExerciseEngine } from '../../src/domain/exercises';
import { createMemoryStorage, DEFAULT_PREFERENCES } from '../../src/storage';
import { testRepository } from './pack';

/** No device speech in tests, but the dataset-audio path stays reachable. */
const silentAudio: AudioService = {
  play: () => Promise.resolve(NOOP_PLAYBACK),
  speak: () => Promise.resolve(NOOP_PLAYBACK),
  stop: () => {},
  canPlay: () => true,
  canSpeak: () => true,
  voicesFor: () => [],
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
    datasetIssues: [],
    ...overrides,
  };
}

export function renderWithServices(
  ui: ReactElement,
  options: { services?: AppServices; route?: string } = {},
) {
  const services = options.services ?? testServices();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesContext
      value={{
        services,
        preferences: services.preferences,
        updatePreferences: () => {},
      }}
    >
      <MemoryRouter initialEntries={[options.route ?? '/']}>{children}</MemoryRouter>
    </ServicesContext>
  );

  return { services, ...render(ui, { wrapper }) };
}
