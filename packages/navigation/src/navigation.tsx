/* eslint-disable react-refresh/only-export-components -- a seam exports its hooks
   and its components together, so one import names everything that touches the router. */
/**
 * Navigation, as the app uses it: string addresses in, string addresses out.
 *
 * Every screen and component navigates through this module, and nothing else
 * names the router, the same way `services.ts` is the only place that names a
 * storage or speech vendor. Addresses are built by each screen's URL codec
 * (`coursePath`, `sessionPath` and the rest), which are the typed layer, so the
 * router underneath only has to move between strings.
 *
 * The hooks read a {@link Navigation} from context. {@link AppRouter} fills it
 * from TanStack Router; {@link MemoryNavigation} fills it from an in-memory
 * history, synchronously, for tests and previews. Routes are declared as data
 * (`{ '/:language/:level': <HomeScreen /> }`) for both, so the app's route table
 * names no router either. The query string belongs to the codecs: TanStack
 * carries it untouched, which keeps every shared link byte-for-byte what its
 * codec wrote.
 */

import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useLocation as useRouterLocation,
  useParams as useRouterParams,
  useRouter,
} from '@tanstack/react-router';

export interface AppLocation {
  readonly pathname: string;
  /** With its leading `?`, or `''`. */
  readonly search: string;
  /** With its leading `#`, or `''`. */
  readonly hash: string;
}

export interface NavigateOptions {
  /** Replace the current history entry instead of adding one. */
  readonly replace?: boolean;
}

/** An address from a URL codec, or `-1` for one step back in history. */
export type Navigate = (to: string | -1, options?: NavigateOptions) => void;

/** Everything a screen may know or do about where it is. */
export interface Navigation {
  readonly location: AppLocation;
  /** The matched route's parameters, such as `language` or `missionId`. */
  readonly params: Readonly<Record<string, string | undefined>>;
  readonly navigate: Navigate;
  /** The real `href` for an address: what a link's `<a>` carries. */
  readonly href: (to: string) => string;
}

const NavigationContext = createContext<Navigation | null>(null);

function useNavigation(): Navigation {
  const navigation = use(NavigationContext);
  if (!navigation) throw new Error('Navigation is used outside AppRouter or MemoryNavigation');
  return navigation;
}

export function useNavigate(): Navigate {
  return useNavigation().navigate;
}

/** Where a component outside any router is: nowhere in particular. */
const NOWHERE: AppLocation = { pathname: '/', search: '', hash: '' };
const NO_PARAMS: Readonly<Record<string, string | undefined>> = {};

/**
 * Reading where you are works anywhere, so a component that only consults the
 * address (the current course, say) also renders outside a router, as it did
 * before this seam. Moving requires one.
 */
export function useLocation(): AppLocation {
  return use(NavigationContext)?.location ?? NOWHERE;
}

/** The matched route's parameters, such as `language`, `level` or `missionId`. */
export function useRouteParams(): Readonly<Record<string, string | undefined>> {
  return use(NavigationContext)?.params ?? NO_PARAMS;
}

/** The query string, and a way to replace it without leaving the screen. */
export function useSearchParams(): readonly [
  URLSearchParams,
  (next: URLSearchParams | string, options?: NavigateOptions) => void,
] {
  const { location, navigate } = useNavigation();
  const { pathname, search } = location;
  /*
   * The same object until the query changes, as React Router's was: screens
   * memoize on `params`, and a fresh one each render recomputed all of it.
   */
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const setParams = useCallback(
    (next: URLSearchParams | string, options?: NavigateOptions) => {
      const query = String(next).replace(/^\?/, '');
      navigate(query ? `${pathname}?${query}` : pathname, options);
    },
    [navigate, pathname],
  );
  return [params, setParams];
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** An address from a URL codec. */
  readonly to: string;
  /** Replace the current history entry, as switching a tab does. */
  readonly replace?: boolean;
  readonly children?: ReactNode;
}

/**
 * An in-app link: a real `<a href>` (so it can be opened in a new tab, copied or
 * read by an assistive technology), followed without a page load.
 */
export function Link({ to, replace = false, onClick, target, ...props }: LinkProps) {
  const { navigate, href } = useNavigation();

  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || event.button !== 0 || modified) return;
    if (target && target !== '_self') return;
    event.preventDefault();
    navigate(to, { replace });
  };

  return <a href={href(to)} target={target} onClick={follow} {...props} />;
}

/** Leaves for another address as soon as it renders, replacing this entry. */
export function Redirect({ to }: { readonly to: string }) {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    navigate(to, { replace: true });
  });
  return null;
}

/**
 * Routes as data: a pattern in the app's `:param` spelling, with a trailing `/*`
 * for "anything below", mapped to what renders there. The key `*` alone is what
 * renders when nothing matches.
 */
export type RouteTable = Readonly<Record<string, ReactNode>>;

/** Wraps every screen; renders the matched one where it places a {@link RouteOutlet}. */
export type RouteLayout = ComponentType;

export interface RouterOptions {
  readonly routes: RouteTable;
  readonly layout?: RouteLayout;
}

/** Where a layout places the matched screen. */
const OutletContext = createContext<ReactNode | undefined>(undefined);

export function RouteOutlet() {
  const memory = use(OutletContext);
  return memory === undefined ? <Outlet /> : memory;
}

/* ----------------------------------------------------------------------------
 * TanStack Router, for the app.
 * ------------------------------------------------------------------------- */

/** The app's router, on the browser's history, under the app's base path. */
export function AppRouter({
  routes,
  layout,
  basepath,
}: RouterOptions & { readonly basepath: string }) {
  const [router] = useState(() => buildRouter({ routes, ...(layout ? { layout } : {}), basepath }));
  return <RouterProvider router={router} />;
}

/** Fills the context from TanStack, once per route change. */
function TanStackNavigation({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const { pathname, searchStr, hash } = useRouterLocation();
  const params = useRouterParams({ strict: false }) as Record<string, string | undefined>;
  const navigation = useMemo<Navigation>(
    () => ({
      location: { pathname, search: searchStr, hash: hash ? `#${hash}` : '' },
      params,
      navigate: (to, options) => {
        if (to === -1) router.history.back();
        else void router.navigate({ href: to, replace: options?.replace ?? false });
      },
      href: (to) => router.buildLocation({ href: to } as never).publicHref,
    }),
    [router, pathname, searchStr, hash, params],
  );
  return <NavigationContext value={navigation}>{children}</NavigationContext>;
}

/** `:language` → `$language`, and `*` → TanStack's splat `$`. */
function routerSegment(segment: string): string {
  return segment === '*' ? '$' : segment.replace(/^:/, '$');
}

const segmentsOf = (pattern: string) => pattern.split('/').filter(Boolean);
const startsWith = (path: readonly string[], prefix: readonly string[]) =>
  prefix.length > 0 &&
  prefix.length < path.length &&
  prefix.every((segment, index) => path[index] === segment);

type AnyRoute = ReturnType<typeof createRoute>;

/**
 * The flat table as TanStack's tree. A pattern that is a prefix of others becomes
 * their parent, rendering its own screen as an index child. That nesting is what
 * lets `/:language/:level` outrank `/:language/:level/*` for `/es/a1`: as
 * siblings, TanStack's splat matches the empty remainder and wins.
 */
function routeTree(
  parent: AnyRoute,
  entries: readonly (readonly [readonly string[], ReactNode])[],
): AnyRoute[] {
  return entries
    .filter(([path]) => !entries.some(([other]) => startsWith(path, other)))
    .map(([path, element]) => {
      const below = entries
        .filter(([other]) => startsWith(other, path))
        .map(([other, screen]) => [other.slice(path.length), screen] as const);
      const route = createRoute({
        getParentRoute: () => parent,
        path: `/${path.map(routerSegment).join('/')}`,
        component: below.length ? () => <Outlet /> : () => element,
      }) as unknown as AnyRoute;
      if (!below.length) return route;
      const index = createRoute({
        getParentRoute: () => route,
        path: '/',
        component: () => element,
      }) as unknown as AnyRoute;
      return route.addChildren([index, ...routeTree(route, below)]) as unknown as AnyRoute;
    });
}

/*
 * The query string as one opaque value, so the router round-trips it exactly
 * instead of decoding and re-encoding it (which would turn `size=items:5` into
 * `size=items%3A5` and change every shared link).
 */
const RAW = '_';
const parseSearch = (search: string) => {
  const raw = search.replace(/^\?/, '');
  return raw ? { [RAW]: raw } : {};
};
const stringifySearch = (search: Record<string, unknown>) => {
  const raw = search[RAW];
  return typeof raw === 'string' && raw ? `?${raw}` : '';
};

function buildRouter({
  routes,
  layout: Layout,
  basepath,
}: RouterOptions & { readonly basepath: string }) {
  const notFound = routes['*'] ?? null;
  const root = createRootRoute({
    component: () => <TanStackNavigation>{Layout ? <Layout /> : <Outlet />}</TanStackNavigation>,
    notFoundComponent: () => notFound,
  });
  const children = routeTree(
    root as unknown as AnyRoute,
    Object.entries(routes)
      .filter(([pattern]) => pattern !== '*')
      .map(([pattern, element]) => [segmentsOf(pattern), element] as const),
  );
  return createRouter({
    routeTree: root.addChildren(children),
    history: createBrowserHistory(),
    basepath,
    parseSearch,
    stringifySearch,
    defaultNotFoundComponent: () => notFound,
  });
}

/* ----------------------------------------------------------------------------
 * In memory, for tests and previews: synchronous, and no router at all.
 * ------------------------------------------------------------------------- */

/**
 * Splits an address into the three parts a location has. By hand rather than
 * with `URL`, so a test that stubs `URL` (for object URLs, say) still navigates.
 */
function locationOf(address: string): AppLocation {
  const hashAt = address.indexOf('#');
  const beforeHash = hashAt < 0 ? address : address.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : address.slice(hashAt);
  const searchAt = beforeHash.indexOf('?');
  const pathname = searchAt < 0 ? beforeHash : beforeHash.slice(0, searchAt);
  const search = searchAt < 0 ? '' : beforeHash.slice(searchAt);
  return { pathname: pathname || '/', search: search === '?' ? '' : search, hash };
}

/** An address resolved against the current one: a bare `?query` keeps the path. */
function resolve(to: string, from: string): string {
  if (to.startsWith('/')) return to;
  const { pathname } = locationOf(from);
  return to.startsWith('?') || to.startsWith('#') ? `${pathname}${to}` : `${pathname}/${to}`;
}

/**
 * How well `pattern` fits `pathname`, with its parameters, or `undefined` for no
 * fit. Static segments outrank parameters, which outrank a trailing splat, the
 * same order the app's router ranks them in.
 */
export function matchRoute(
  pattern: string,
  pathname: string,
): { readonly score: number; readonly params: Record<string, string> } | undefined {
  const want = pattern.split('/').filter(Boolean);
  const have = pathname.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  let score = 0;
  for (let index = 0; index < want.length; index += 1) {
    const segment = want[index]!;
    if (segment === '*') {
      // At least one segment: `/:language/:level/*` is "something below a
      // course", never the course itself.
      if (have.length <= index) return undefined;
      params['*'] = have.slice(index).join('/');
      return { score: score + 1, params };
    }
    const actual = have[index];
    if (actual === undefined) return undefined;
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(actual);
      score += 2;
    } else if (segment === actual) {
      score += 3;
    } else {
      return undefined;
    }
  }
  return want.length === have.length ? { score, params } : undefined;
}

/**
 * Navigation over an in-memory history starting at `route`, rendering the best
 * match from `routes` wherever `layout` places a {@link RouteOutlet}.
 */
export function MemoryNavigation({
  route,
  routes = {},
  layout: Layout,
}: Partial<RouterOptions> & { readonly route: string }) {
  const [history, setHistory] = useState({ entries: [route], index: 0 });
  const address = history.entries[history.index] ?? '/';

  /*
   * Stable while the address is, like the router's: screens memoize on what the
   * hooks return, and fresh objects each render would recompute all of it.
   */
  const { navigation, outlet } = useMemo(() => {
    const location = locationOf(address);
    let best: { score: number; params: Record<string, string>; element: ReactNode } | undefined;
    for (const [pattern, element] of Object.entries(routes)) {
      if (pattern === '*') continue;
      const match = matchRoute(pattern, location.pathname);
      if (match && (!best || match.score > best.score)) best = { ...match, element };
    }
    const value: Navigation = {
      location,
      params: best?.params ?? {},
      navigate: (to, options) =>
        setHistory((current) => {
          if (to === -1) return { ...current, index: Math.max(0, current.index - 1) };
          const target = resolve(to, current.entries[current.index] ?? '/');
          if (options?.replace) {
            const entries = [...current.entries];
            entries[current.index] = target;
            return { entries, index: current.index };
          }
          const entries = [...current.entries.slice(0, current.index + 1), target];
          return { entries, index: entries.length - 1 };
        }),
      href: (to) => to,
    };
    return { navigation: value, outlet: best ? best.element : (routes['*'] ?? null) };
  }, [address, routes]);

  return (
    <NavigationContext value={navigation}>
      <OutletContext value={outlet}>{Layout ? <Layout /> : <RouteOutlet />}</OutletContext>
    </NavigationContext>
  );
}
