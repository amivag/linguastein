/**
 * Reading the design tokens back out of the stylesheets that declare them.
 *
 * The style guide could have held its own list of every token, and that list
 * would have been wrong within a week — a token added to `primitives.css` or a
 * colour role added to a theme would simply not appear, and nobody would notice
 * because the page would still look complete. So the page does not have a list.
 * It asks the document what is declared, and asks the computed style what each
 * one currently resolves to.
 *
 * That makes the guide a *view* of the design system rather than a copy of it:
 * add `--space-8` and it shows up, rename a role and the old name disappears,
 * switch theme and every value re-reads.
 *
 * Both halves are DOM reads, so both belong in an effect rather than in render —
 * the React Compiler rules are on, and a stylesheet is mutable state as far as
 * they are concerned.
 */

/** A token, as declared and as it currently resolves. */
export interface Token {
  /** Including the leading `--`, so it can be pasted into `var()`. */
  readonly name: string;
  /** What `getComputedStyle` makes of it under the active theme. */
  readonly value: string;
}

/**
 * Every custom property any loaded stylesheet declares on a `:root`-ish
 * selector, in declaration order, deduplicated.
 *
 * Declaration order matters: `primitives.css` groups spacing, then shape, then
 * type, and that grouping is editorial — it is the order someone chose to
 * explain the system in. Sorting the names would throw it away and leave
 * `--text-2xl` before `--text-base`.
 *
 * Only `:root` and `[data-theme=…]` rules are read. A component's own module
 * declares locals like `--button-bg`, which are implementation detail of that
 * component and not part of the shared vocabulary.
 */
export function declaredTokens(prefix = '--'): readonly string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // A cross-origin stylesheet refuses `cssRules`. The app loads none, but a
      // browser extension can inject one, and it must not break the page.
      continue;
    }
    collect(rules, prefix, names, seen);
  }

  return names;
}

/**
 * Walks a rule list, descending into `@media` and `@supports`.
 *
 * `CSSStyleRule` is checked *before* `CSSGroupingRule`, and the order is
 * load-bearing rather than stylistic: since CSS nesting shipped, `CSSStyleRule`
 * inherits from `CSSGroupingRule`, so a grouping-first branch matches every
 * ordinary rule, recurses into its empty `cssRules` and never reads a single
 * declaration. It returned nothing at all, which is the worst way for this to
 * fail — an empty style guide looks like a page that has not loaded rather than
 * like a bug.
 *
 * A style rule is still descended into afterwards, because a nested rule can
 * declare tokens too.
 */
function collect(rules: CSSRuleList, prefix: string, names: string[], seen: Set<string>): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      if (isRootRule(rule.selectorText)) {
        for (const property of Array.from(rule.style)) {
          if (!property.startsWith(prefix) || seen.has(property)) continue;
          seen.add(property);
          names.push(property);
        }
      }
      collect(rule.cssRules, prefix, names, seen);
      continue;
    }
    if (rule instanceof CSSGroupingRule) collect(rule.cssRules, prefix, names, seen);
  }
}

/**
 * Whether a selector declares the shared vocabulary rather than a component's
 * private one. `:root`, `[data-theme='dark']`, and the `:root, [data-theme=…]`
 * pair the dark theme uses so the app renders before the theme script runs.
 */
function isRootRule(selector: string): boolean {
  return selector
    .split(',')
    .some((part) => /^\s*(:root|\[data-theme(=|\])[^\]]*\]?)\s*$/.test(part));
}

/** Resolves names against the document root under whatever theme is active. */
export function resolveTokens(names: readonly string[]): readonly Token[] {
  const computed = getComputedStyle(document.documentElement);
  return names.map((name) => ({ name, value: computed.getPropertyValue(name).trim() }));
}

/** Declared and resolved in one step — what the style guide actually wants. */
export function readTokens(prefix = '--'): readonly Token[] {
  return resolveTokens(declaredTokens(prefix));
}

/**
 * Tokens whose name starts with one of `prefixes`, keeping declaration order.
 *
 * Prefix rather than an explicit list, so a group grows on its own: adding
 * `--radius-2xl` puts it in the shape group without an edit here. The catch is
 * that a group has to be *namespaced* to be discoverable, which is a reason to
 * keep naming tokens by their role.
 */
export function group(tokens: readonly Token[], ...prefixes: string[]): readonly Token[] {
  return tokens.filter((token) => prefixes.some((prefix) => token.name.startsWith(prefix)));
}

/** Everything not claimed by a listed group, so nothing can go unshown. */
export function ungrouped(
  tokens: readonly Token[],
  claimed: readonly (readonly string[])[],
): readonly Token[] {
  const prefixes = claimed.flat();
  return tokens.filter((token) => !prefixes.some((prefix) => token.name.startsWith(prefix)));
}
