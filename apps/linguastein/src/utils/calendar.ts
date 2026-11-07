/**
 * What the app means by "a day".
 *
 * A one-liner with three callers, which is exactly why it is not written three
 * times: the learner's week on the home screen, the two-day requirement a batch
 * graduates on, and anything later that counts days. If one of those used UTC
 * and another local time, a learner practising at nine in the evening in Chicago
 * would be on two different days depending on which panel they looked at.
 *
 * Local rather than UTC, deliberately. A day is a human unit — the evening you
 * sat down — not an interval on a clock in Greenwich. The domain layer stays
 * pure and takes this as an injected `DayOf`, so the timezone is read here, at
 * the edge, and nowhere else.
 *
 * A plain `number` rather than the domain's `Timestamp`: `src/utils` sits *below*
 * `src/domain` (which imports `utils/random`), so importing a domain type here
 * would invert the dependency for no gain.
 */
export function localDay(at: number): string {
  return new Date(at).toDateString();
}
