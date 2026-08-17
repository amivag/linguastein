import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BrowseScreen } from '../features/browse/BrowseScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { PassageScreen } from '../features/read/PassageScreen';
import { ReadScreen } from '../features/read/ReadScreen';
import { SessionScreen } from '../features/practice/SessionScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import type { Preferences } from '../storage';
import { applyTheme } from '../styles/themes';
import { createServices, type AppServices } from './services';
import { ServicesContext } from './services-context';

type BootState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly services: AppServices }
  | { readonly phase: 'failed'; readonly error: Error };

export function App() {
  const [boot, setBoot] = useState<BootState>({ phase: 'loading' });
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createServices().then(
      (services) => {
        if (cancelled) return;
        setBoot({ phase: 'ready', services });
        setPreferences(services.preferences);
      },
      (error: unknown) => {
        if (!cancelled) {
          setBoot({
            phase: 'failed',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const services = boot.phase === 'ready' ? boot.services : null;

  const updatePreferences = useCallback(
    (patch: Partial<Preferences>) => {
      if (!services) return;
      void services.storage.preferences.write(patch).then(setPreferences);
    },
    [services],
  );

  // The document always carries a concrete theme; `system` is resolved here and
  // re-resolved when the OS preference changes while the app is open.
  const preferredTheme = preferences?.theme ?? 'system';
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme(preferredTheme, media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [preferredTheme]);

  if (boot.phase === 'loading') return <Splash message="Loading…" />;
  if (boot.phase === 'failed')
    return <Splash message={`Could not load content: ${boot.error.message}`} />;
  if (!services || !preferences) return <Splash message="Loading…" />;

  return (
    <ServicesContext value={{ services, preferences, updatePreferences }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/browse" element={<BrowseScreen />} />
          <Route path="/read" element={<ReadScreen />} />
          <Route path="/read/:id" element={<PassageScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/session" element={<SessionScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </BrowserRouter>
    </ServicesContext>
  );
}

function Splash({ message }: { readonly message: string }) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100%',
        padding: 'var(--space-5)',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
      }}
    >
      <p>{message}</p>
    </div>
  );
}
