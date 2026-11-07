/** Metadata is supplied by each app (and may combine several theme modules). */
export interface ThemeDefinition<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly description: string;
}
export function defineThemeCatalog<const Id extends string>(
  entries: readonly ThemeDefinition<Id>[],
  defaultId: NoInfer<Id>,
) {
  const options = Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
  const ids: readonly Id[] = Object.freeze(options.map((entry) => entry.id));
  if (ids.length === 0 || new Set(ids).size !== ids.length)
    throw new Error('A theme catalog needs unique ids');
  if (
    options.some(
      (entry) => !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.id) || !entry.label.trim(),
    )
  ) {
    throw new Error('A theme needs a CSS-safe id and a label');
  }
  if (!ids.includes(defaultId)) throw new Error('The default theme must be registered');
  const is = (value: unknown): value is Id =>
    typeof value === 'string' && (ids as readonly string[]).includes(value);
  return Object.freeze({
    ids,
    options,
    defaultId,
    is,
    resolve: (value: unknown): Id => (is(value) ? value : defaultId),
  });
}
