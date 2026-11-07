/**
 * The navigation seam: what every screen relies on, whichever router fills it.
 *
 * `MemoryNavigation` is what component tests run in, so its matching and history
 * have to behave like the app's. `AppRouter` is the app's own TanStack router;
 * the cases here pin the two things the seam promises on top of TanStack: an
 * exact course route outranks the course's catch-all, and the query string
 * survives exactly as the codec wrote it.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AppRouter,
  Link,
  matchRoute,
  MemoryNavigation,
  RouteOutlet as OutletProbe,
  useLocation,
  useNavigate,
  useRouteParams,
  useSearchParams,
} from '../../src/app/navigation';

function Where() {
  const { pathname, search } = useLocation();
  return <output aria-label="where">{`${pathname}${search}`}</output>;
}

function Params() {
  return <output aria-label="params">{JSON.stringify(useRouteParams())}</output>;
}

const where = () => screen.getByRole('status', { name: 'where' }).textContent;

describe('matchRoute', () => {
  it('reads parameters, and ranks static segments over parameters over a splat', () => {
    expect(matchRoute('/:language/:level', '/es/a1')).toEqual({
      score: 4,
      params: { language: 'es', level: 'a1' },
    });
    expect(matchRoute('/:language/:level/study', '/es/a1/study')!.score).toBeGreaterThan(
      matchRoute('/:language/:level/*', '/es/a1/study')!.score,
    );
  });

  it('never lets a splat match nothing, so a course is not its own 404', () => {
    expect(matchRoute('/:language/:level/*', '/es/a1')).toBeUndefined();
    expect(matchRoute('/:language/:level/*', '/es/a1/a/b')?.params['*']).toBe('a/b');
  });

  it('refuses a path longer or shorter than the pattern', () => {
    expect(matchRoute('/user', '/user/x')).toBeUndefined();
    expect(matchRoute('/read/:id', '/read')).toBeUndefined();
  });
});

describe('MemoryNavigation', () => {
  function Mover() {
    const navigate = useNavigate();
    return (
      <>
        <button onClick={() => navigate('/es/a1/study?tab=missions')}>push</button>
        <button onClick={() => navigate('/es/a1/progress', { replace: true })}>replace</button>
        <button onClick={() => navigate(-1)}>back</button>
      </>
    );
  }

  const routes = {
    '/:language/:level': <p>home</p>,
    '/:language/:level/study': <Params />,
    '/:language/:level/*': <p>course 404</p>,
    '*': <p>404</p>,
  };

  function Layout() {
    return (
      <>
        <Where />
        <Mover />
        {/* The outlet, as App's layout places it. */}
        <OutletProbe />
      </>
    );
  }

  it('renders the best match, with its parameters, and falls back to the 404', () => {
    const { unmount } = render(
      <MemoryNavigation route="/es/a1/study" routes={routes} layout={Layout} />,
    );
    expect(screen.getByRole('status', { name: 'params' })).toHaveTextContent(
      '{"language":"es","level":"a1"}',
    );
    unmount();

    render(<MemoryNavigation route="/es/a1/nonsense" routes={routes} layout={Layout} />);
    expect(screen.getByText('course 404')).toBeInTheDocument();
  });

  it('pushes, replaces and goes back like a browser history', async () => {
    const user = userEvent.setup();
    render(<MemoryNavigation route="/es/a1" routes={routes} layout={Layout} />);

    await user.click(screen.getByRole('button', { name: 'push' }));
    expect(where()).toBe('/es/a1/study?tab=missions');

    await user.click(screen.getByRole('button', { name: 'replace' }));
    expect(where()).toBe('/es/a1/progress');

    await user.click(screen.getByRole('button', { name: 'back' }));
    // The study entry was replaced, so one step back is home.
    expect(where()).toBe('/es/a1');
  });
});

describe('Link', () => {
  it('is a real link that navigates in place, unless a modifier asks for a new tab', async () => {
    const user = userEvent.setup();
    render(
      <MemoryNavigation
        route="/es/a1"
        routes={{ '*': null }}
        layout={() => (
          <>
            <Where />
            <Link to="/es/a1/study">Study</Link>
          </>
        )}
      />,
    );
    const link = screen.getByRole('link', { name: 'Study' });

    expect(link).toHaveAttribute('href', '/es/a1/study');
    await user.keyboard('{Control>}');
    await user.click(link);
    await user.keyboard('{/Control}');
    expect(where()).toBe('/es/a1');

    await user.click(link);
    expect(where()).toBe('/es/a1/study');
  });
});

describe('useSearchParams', () => {
  it('reads the query and replaces it on the same path', async () => {
    function Search() {
      const [params, setParams] = useSearchParams();
      return (
        <button onClick={() => setParams(new URLSearchParams({ q: 'gato' }), { replace: true })}>
          {params.get('q') ?? 'none'}
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <MemoryNavigation
        route="/es/a1?q=perro"
        layout={() => (
          <>
            <Where />
            <Search />
          </>
        )}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'perro' }));
    expect(where()).toBe('/es/a1?q=gato');
  });
});

describe('outside any router', () => {
  it('reads as nowhere in particular, so address-reading components still render', () => {
    render(
      <>
        <Where />
        <Params />
      </>,
    );

    expect(where()).toBe('/');
    expect(screen.getByRole('status', { name: 'params' })).toHaveTextContent('{}');
  });
});

describe('AppRouter', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  const routes = {
    '/:language/:level': <Params />,
    '/:language/:level/*': <p>course 404</p>,
    '/': <p>root</p>,
    '*': <p>404</p>,
  };

  function Layout() {
    return (
      <>
        <Where />
        <OutletProbe />
      </>
    );
  }

  it('prefers the exact course route to the course catch-all', async () => {
    window.history.replaceState({}, '', '/es/a1');
    render(<AppRouter basepath="/" routes={routes} layout={Layout} />);

    expect(await screen.findByRole('status', { name: 'params' })).toHaveTextContent(
      '{"language":"es","level":"a1"}',
    );
  });

  it('keeps a query string exactly as it was written', async () => {
    window.history.replaceState({}, '', '/es/a1/session?preset=verbs&size=items:5');
    render(<AppRouter basepath="/" routes={routes} layout={Layout} />);

    expect(await screen.findByText('course 404')).toBeInTheDocument();
    expect(where()).toBe('/es/a1/session?preset=verbs&size=items:5');
  });

  it('answers an address no route claims with the 404', async () => {
    window.history.replaceState({}, '', '/nowhere');
    render(<AppRouter basepath="/" routes={routes} layout={Layout} />);

    expect(await screen.findByText('404')).toBeInTheDocument();
  });
});
