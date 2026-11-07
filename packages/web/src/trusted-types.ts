/**
 * The one Trusted Types policy this app needs.
 *
 * The content security policy (`@platform/build`) requires Trusted Types for
 * script sinks, so assigning a string to `innerHTML`, `eval` or a script URL
 * throws. The app itself uses none of them. Registering the service worker is
 * the exception: `navigator.serviceWorker.register` is a script-URL sink, and
 * `workbox-window` passes it a plain string.
 *
 * A `default` policy is what the browser consults for a plain string. This one
 * allows a script URL only from this origin and defines nothing else, so HTML
 * and script strings stay blocked.
 */

interface PolicyFactory {
  createPolicy(
    name: string,
    rules: { readonly createScriptURL: (input: string) => string },
  ): unknown;
}

export function installTrustedTypesPolicy(scope: typeof globalThis = globalThis): void {
  const factory = (scope as { trustedTypes?: PolicyFactory }).trustedTypes;
  if (!factory) return;
  factory.createPolicy('default', {
    createScriptURL(input) {
      const url = new URL(input, scope.location.href);
      if (url.origin !== scope.location.origin) {
        throw new TypeError(`Script URL from another origin refused: ${url.origin}`);
      }
      return url.href;
    },
  });
}
