/**
 * The query in the address, both directions in one module — the shape
 * `browse-url.ts`, `study-url.ts` and `session-url.ts` all take.
 *
 * Shared rather than owned by Home, and that is the point. A lookup is going to
 * appear on more than one screen — the same box on Browse would search inside
 * that sheet — so the spelling lives here from the start and each screen only
 * decides what to *do* with the text. Home looks it up; a section would look it
 * up narrowed to itself.
 *
 * `q` deliberately, because `writeItemFilter` already spells `ItemFilter.search`
 * that way. One name for "the text a learner typed" means a query survives being
 * moved from one screen to another, and the alternative — a second parameter
 * meaning almost the same thing — is exactly the drift that made `?pos=` worth
 * centralising. What differs between screens is the treatment, never the key.
 */

export const SEARCH_PARAM = 'q';

/**
 * Writes the query **verbatim**, and that is the load-bearing part.
 *
 * The obvious version trims on the way out. It cannot work, and the reason is
 * worth writing down because Browse has the same bug today: when the URL is the
 * input's value, trimming it there means a trailing space is thrown away between
 * one keystroke and the next, so the *next* letter lands against the previous
 * word. `cerveza agua` is typed and `cervezaagua` arrives — a search box in which
 * no learner can type a phrase.
 *
 * So the parameter carries what was typed, and trimming belongs to whoever
 * *searches* with it. A whitespace-only value is still dropped: nothing was
 * asked, and a bare screen should have a bare URL.
 */
export function writeSearchQuery(params: URLSearchParams, query: string | undefined): void {
  if (query && query.trim() !== '') params.set(SEARCH_PARAM, query);
  else params.delete(SEARCH_PARAM);
}

/**
 * The query a URL asks for, exactly as typed, or `''`.
 *
 * Never `undefined`: "nothing typed" and "no parameter" are the same state to
 * every screen that reads this, and an optional string would make each of them
 * pick a spelling for it. Untrimmed for the reason {@link writeSearchQuery}
 * gives — a caller deciding whether to *search* trims; a caller filling the box
 * must not.
 */
export function parseSearchQuery(params: URLSearchParams): string {
  return params.get(SEARCH_PARAM) ?? '';
}
