/**
 * The router tests run in, behind the same seam the app uses.
 *
 * A test starts at an address (`route`) and, when the screen under test reads
 * route parameters, declares the routes it needs in JSX with `Routes` and
 * `Route` from this module, using the app's `:param` spelling. Only this file
 * and `src/app/navigation.tsx` know which router sits underneath.
 */

import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

export { Route, Routes } from 'react-router';

export function TestRouter({
  route,
  children,
}: {
  readonly route: string;
  readonly children?: ReactNode;
}) {
  return <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;
}
