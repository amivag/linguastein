import { useEffect, useState } from 'react';
import { readTokens, type Token } from '../../styles/tokens';

/**
 * The design tokens, re-read whenever the document's theme actually changes.
 *
 * The obvious implementation — an effect keyed on the theme *preference* — is
 * wrong twice, and both ways were observed rather than reasoned about:
 *
 * 1. **Ordering.** `applyTheme` runs in an effect in `App`, and a child's
 *    effects run before its parent's. So this component read the stylesheets
 *    before `data-theme` had been swapped, and every value it displayed was one
 *    theme behind — switching to Light left the whole page listing the dark
 *    palette.
 * 2. **Coverage.** Under `theme: 'system'` the preference does not change when
 *    the OS flips between light and dark. The document does. Keying on the
 *    preference means the page would not notice at all.
 *
 * Observing the attribute fixes both, because the attribute is the thing the
 * values actually depend on. It is also the same source of truth the pre-paint
 * script in `index.html` writes, so there is one answer to "which theme is on".
 */
export function useTokens(): readonly Token[] {
  const [tokens, setTokens] = useState<readonly Token[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTokens(readTokens());

    read();

    const observer = new MutationObserver(read);
    observer.observe(root, { attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return tokens;
}
