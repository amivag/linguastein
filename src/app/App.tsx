import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HomeScreen } from '../features/home/HomeScreen';
import { SessionScreen } from '../features/practice/SessionScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import type { Preferences } from '../storage';
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

  // Theme is applied to the document so CSS variables resolve everywhere.
  useEffect(() => {
    const theme = preferences?.theme ?? 'system';
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [preferences?.theme]);

  if (boot.phase === 'loading') return <Splash message="Loading…" />;
  if (boot.phase === 'failed')
    return <Splash message={`Could not load content: ${boot.error.message}`} />;
  if (!services || !preferences) return <Splash message="Loading…" />;

  return (
    <ServicesContext value={{ services, preferences, updatePreferences }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
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
