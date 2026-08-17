/**
 * Where dataset bytes come from. The browser reads them over HTTP from
 * `public/`; tests and CLI tooling read them from disk or memory. Nothing above
 * this interface knows the difference.
 */

export interface DatasetSource {
  /** Human-readable root, used in validation messages. */
  readonly name: string;
  /** Resolves a path relative to the source root and returns its contents. */
  read(path: string): Promise<string>;
}

export function httpDatasetSource(baseUrl: string): DatasetSource {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return {
    name: root,
    async read(path) {
      const response = await fetch(`${root}${path}`);
      if (!response.ok) {
        throw new Error(`failed to load ${path}: ${response.status} ${response.statusText}`);
      }
      return response.text();
    },
  };
}

export function memoryDatasetSource(
  files: Readonly<Record<string, string>>,
  name = 'memory',
): DatasetSource {
  return {
    name,
    read(path) {
      const content = files[path];
      return content === undefined
        ? Promise.reject(new Error(`missing file: ${path}`))
        : Promise.resolve(content);
    },
  };
}
