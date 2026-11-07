/**
 * Navigation, as the app uses it: string addresses in, string addresses out.
 *
 * Every screen and component navigates through this module and nothing else
 * names the router, the same way `services.ts` is the only place that names a
 * storage or speech vendor. Addresses are built by each screen's URL codec
 * (`coursePath`, `sessionPath` and the rest), which are the typed layer, so the
 * router underneath only has to move between strings. Swapping it touches this
 * file, the route table in `App.tsx` and the test router, and nothing else.
 */

/* eslint-disable react-refresh/only-export-components -- a seam exports its hooks
   and its Link together, so one import names everything that touches the router. */
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import {
  Link as RouterLink,
  useLocation as useRouterLocation,
  useNavigate as useRouterNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from 'react-router';

export interface AppLocation {
  readonly pathname: string;
  /** With its leading `?`, or `''`. */
  readonly search: string;
  readonly hash: string;
}

export interface NavigateOptions {
  /** Replace the current history entry instead of adding one. */
  readonly replace?: boolean;
}

/** An address from a URL codec, or `-1` for one step back in history. */
export type Navigate = (to: string | -1, options?: NavigateOptions) => void;

export function useNavigate(): Navigate {
  const navigate = useRouterNavigate();
  return (to, options) => {
    if (to === -1) void navigate(-1);
    else void navigate(to, options?.replace ? { replace: true } : undefined);
  };
}

export function useLocation(): AppLocation {
  const { pathname, search, hash } = useRouterLocation();
  return { pathname, search, hash };
}

/** The matched route's parameters, such as `language`, `level` or `missionId`. */
export function useRouteParams(): Readonly<Record<string, string | undefined>> {
  return useRouterParams();
}

/** The query string, and a way to replace it without leaving the screen. */
export function useSearchParams(): readonly [
  URLSearchParams,
  (next: URLSearchParams | string, options?: NavigateOptions) => void,
] {
  const [params, setParams] = useRouterSearchParams();
  return [params, (next, options) => setParams(next, options?.replace ? { replace: true } : {})];
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** An address from a URL codec. */
  readonly to: string;
  /** Replace the current history entry, as switching a tab does. */
  readonly replace?: boolean;
  readonly children?: ReactNode;
}

/** An in-app link: a real `<a href>`, handled without a page load. */
export function Link({ to, replace = false, ...props }: LinkProps) {
  return <RouterLink to={to} replace={replace} {...props} />;
}
