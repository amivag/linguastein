/**
 * CSS-module class lookup for tests.
 *
 * `noUncheckedIndexedAccess` types every class as `string | undefined`, which
 * matchers reject. Rather than loosening the compiler for the whole project or
 * scattering `!` through the suite, this resolves the class and fails loudly if
 * it has been renamed — which is the failure a test wants anyway: a silently
 * `undefined` class name would make an assertion pass against nothing.
 */
export function css(styles: Record<string, string | undefined>, name: string): string {
  const value = styles[name];
  if (!value) throw new Error(`no such CSS module class: ${name}`);
  return value;
}
