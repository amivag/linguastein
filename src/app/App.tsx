import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { BrowseScreen } from '../features/browse/BrowseScreen';
import { StudyScreen } from '../features/study/StudyScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { PassageScreen } from '../features/read/PassageScreen';
import { ReadScreen } from '../features/read/ReadScreen';
import { SessionScreen } from '../features/practice/SessionScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { MissionScreen } from '../features/missions/MissionScreen';
import { courseOptions, coursePath, resolveCourse } from '../domain/content';
import { mergePreferences, type Preferences } from '../storage';
import { applyTheme } from '../styles/themes';
import { applyReadingSize } from '../styles/reading-size';
import { ErrorBoundary } from './ErrorBoundary';
import { createServices, type AppServices } from './services';
import { ServicesContext, useServices } from './services-context';

/**
 * The style guide, split out of the main bundle.
 *
 * It renders every component in the app plus every icon in the set, so bundling
 * it into the entry chunk would make a learner who never opens it pay for all of
 * it. Lazy is the whole reason it can afford to be exhaustive.
 */
const StyleGuideScreen = lazy(() =>
  import('../features/design/StyleGuideScreen').then((module) => ({
    default: module.StyleGuideScreen,
  })),
);

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

  /**
   * A preference change, applied at once and persisted in order.
   *
   * Both halves matter, and neither was there. Applying it locally first means a
   * second change made in the same breath — picking three categories, toggling
   * two switches — computes from the value the first one set rather than from the
   * one it replaced. Chaining the writes means they cannot interleave inside the
   * store: `write` reads the stored record, merges and puts it back, so three
   * concurrent calls all read the same starting point and the last put wins,
   * silently discarding the other two.
   */
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const updatePreferences = useCallback(
    (patch: Partial<Preferences>) => {
      if (!services) return;
      setPreferences((current) => (current ? mergePreferences(current, patch) : current));
      pending.current = pending.current
        .then(() => services.storage.preferences.write(patch))
        .then(setPreferences, (error: unknown) => {
          // The change still holds for this session; storage being unavailable
          // is not a reason to snap a control back to where it was.
          console.warn('Could not persist preferences', error);
        });
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

  const readingSize = preferences?.readingSize ?? 'small';
  useEffect(() => {
    applyReadingSize(readingSize);
  }, [readingSize]);

  if (boot.phase === 'loading') return <Splash message="Loading…" />;
  if (boot.phase === 'failed')
    return <Splash message={`Could not load content: ${boot.error.message}`} />;
  if (!services || !preferences) return <Splash message="Loading…" />;

  return (
    /*
      Inside the services provider and outside the router, deliberately.

      Inside, so the boundary is mounted for the whole of the app that can throw.
      Outside the router, because a throw during routing must still be caught —
      and because the way out is a reload rather than a navigation, so the
      boundary has no use for router context.
    */
    <ServicesContext value={{ services, preferences, updatePreferences }}>
      <ErrorBoundary>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            {/* Every screen lives inside a course, so what is being studied is
              legible in the address bar and travels with a shared link. */}
            <Route path="/:language/:level" element={<HomeScreen />} />
            <Route path="/:language/:level/study" element={<StudyScreen />} />
            <Route path="/:language/:level/browse" element={<BrowseScreen />} />
            <Route path="/:language/:level/read" element={<ReadScreen />} />
            <Route path="/:language/:level/read/:id" element={<PassageScreen />} />
            <Route path="/:language/:level/progress" element={<ProgressScreen />} />
            <Route path="/:language/:level/session" element={<SessionScreen />} />
            <Route path="/:language/:level/mission/:missionId/:stage" element={<MissionScreen />} />
            <Route path="/:language/:level/settings" element={<SettingsScreen />} />

            {/* Outside the course routes: the design system is a property of the
              app, not of what is being studied. `useCourse` resolves to the
              widest real course when the path carries none, so the navigation
              still points somewhere sensible. */}
            <Route
              path="/design"
              element={
                <Suspense fallback={<Splash message="Loading the design system…" />}>
                  <StyleGuideScreen />
                </Suspense>
              }
            />

            {/* Links written before courses existed, kept working: the query
              string is what carries a shared session, so it has to survive the
              hop rather than being dropped at the door. */}
            {LEGACY_SCREENS.map((screen) => (
              <Route
                key={screen}
                path={`/${screen}`}
                element={<CourseRedirect screen={screen} keepSearch />}
              />
            ))}
            <Route path="/read/:id" element={<LegacyPassageRedirect />} />

            <Route path="*" element={<CourseRedirect />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </ServicesContext>
  );
}

/** One-segment paths the app used before courses. */
const LEGACY_SCREENS = ['browse', 'read', 'progress', 'session', 'settings'] as const;

/**
 * Sends a path with no course on it into one — the learner's last, or the
 * widest scope of the first pack loaded.
 *
 * This is also what `/` is: the app has no course-less home, so the entry point
 * is a redirect rather than a screen, and the preference exists purely so that
 * redirect lands where the learner left off.
 */
function CourseRedirect({
  screen,
  keepSearch = false,
}: {
  readonly screen?: string;
  readonly keepSearch?: boolean;
}) {
  const { services, preferences } = useServices();
  const location = useLocation();
  const options = courseOptions(services.repository);
  const course = resolveCourse(options, preferences.targetLanguage, preferences.level);
  const search = keepSearch ? location.search : '';

  return <Navigate replace to={`${coursePath(course, screen)}${search}`} />;
}

/** `/read/700001` → `/es/all/read/700001`, keeping the passage. */
function LegacyPassageRedirect() {
  const { id } = useParams();
  return <CourseRedirect screen={`read/${id ?? ''}`} />;
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
