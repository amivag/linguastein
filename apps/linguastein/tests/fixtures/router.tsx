/**
 * The router tests run in, behind the same seam the app uses.
 *
 * A test starts at an address (`route`) and, when the screen under test reads
 * route parameters, declares the routes it needs in JSX with `Routes` and
 * `Route` from this module, in the app's `:param` spelling. They are markers:
 * `TestRouter` reads them into a route table for `MemoryNavigation` and renders
 * the matched screen where the `Routes` element stood, so nothing here names a
 * router.
 */

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  use,
  type ReactElement,
  type ReactNode,
} from 'react';
import { MemoryNavigation, RouteOutlet } from '@platform/navigation';

interface RouteProps {
  readonly path: string;
  readonly element?: ReactNode;
}

/** One route: `path` in `:param` spelling, `*` for "anything else". */
export function Route(_: RouteProps): null {
  return null;
}

/** Where the matched route renders. */
export function Routes(_: { readonly children?: ReactNode }): null {
  return null;
}

/** The test's own tree, with each `Routes` replaced by the router's outlet. */
const Tree = createContext<ReactNode>(null);

function TreeLayout() {
  return <>{use(Tree)}</>;
}

/** Collects `Route` declarations from every `Routes` in `node`, and swaps in outlets. */
function extract(node: ReactNode, routes: Record<string, ReactNode>): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<{ children?: ReactNode }>;
    if (element.type === Routes) {
      Children.forEach(element.props.children, (route) => {
        if (isValidElement(route) && route.type === Route) {
          const { path, element: screen } = route.props as RouteProps;
          routes[path] = screen ?? null;
        }
      });
      return <RouteOutlet />;
    }
    if (element.props.children === undefined) return element;
    return cloneElement(element, undefined, extract(element.props.children, routes));
  });
}

export function TestRouter({
  route,
  children,
}: {
  readonly route: string;
  readonly children?: ReactNode;
}) {
  const routes: Record<string, ReactNode> = {};
  const tree = extract(children, routes);
  return (
    <Tree value={tree}>
      <MemoryNavigation route={route} routes={routes} layout={TreeLayout} />
    </Tree>
  );
}
