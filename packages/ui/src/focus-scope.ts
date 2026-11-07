/** One keyboard/focus owner per document, including dialogs rendered through portals. */
const FOCUSABLE =
  'a[href],button,input,select,textarea,[tabindex],[contenteditable],summary,audio[controls],video[controls]';
const LAYER = '--focus-layer';

function attribute(element: Element, name: string, value: string | null) {
  if (element.getAttribute(name) === value) return;
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
function available(element: HTMLElement): boolean {
  if (
    !element.isConnected ||
    element.matches(':disabled') ||
    element.closest('[hidden],[inert],[aria-hidden="true"]')
  )
    return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (
      style?.display === 'none' ||
      style?.visibility === 'hidden' ||
      style?.visibility === 'collapse'
    )
      return false;
    if (current.tagName === 'DETAILS' && !current.hasAttribute('open')) {
      const summary = [...current.children].find((child) => child.tagName === 'SUMMARY');
      if (!summary?.contains(element)) return false;
    }
  }
  return true;
}
function tabStops(container: HTMLElement): HTMLElement[] {
  const candidates = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    const nested = element.closest('[role="dialog"],[role="alertdialog"]');
    if (nested && nested !== container && container.contains(nested)) return false;
    const editable =
      element.hasAttribute('contenteditable') &&
      element.getAttribute('contenteditable') !== 'false';
    return (
      available(element) &&
      element.getAttribute('type') !== 'hidden' &&
      (element.tabIndex >= 0 || (editable && !element.hasAttribute('tabindex')))
    );
  });
  return candidates
    .filter((element) => {
      if (
        element.tagName !== 'INPUT' ||
        element.getAttribute('type') !== 'radio' ||
        !element.getAttribute('name')
      )
        return true;
      const radio = element as HTMLInputElement;
      const group = candidates.filter(
        (other) =>
          other.tagName === 'INPUT' &&
          other.getAttribute('type') === 'radio' &&
          other.getAttribute('name') === radio.name &&
          (other as HTMLInputElement).form === radio.form,
      ) as HTMLInputElement[];
      return (group.find((other) => other.checked) ?? group[0]) === radio;
    })
    .sort(
      (a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity),
    );
}
export interface FocusScope {
  readonly id: object;
  readonly parent: object | null;
  readonly container: HTMLElement;
  readonly layer: HTMLElement;
  readonly close: () => void;
}
interface Entry extends FocusScope {
  returnTo: HTMLElement | null;
  lastFocused: HTMLElement | null;
  readonly tabIndex: string | null;
  readonly modal: string | null;
  readonly layerValue: string;
  readonly layerPriority: string;
}
interface HiddenState {
  readonly inert: string | null;
  readonly ariaHidden: string | null;
}
const documents = new WeakMap<Document, FocusCoordinator>();

class FocusCoordinator {
  private readonly entries: Entry[] = [];
  private readonly hidden = new Map<HTMLElement, HiddenState>();
  private observer: MutationObserver | undefined;
  private focusing = false;
  constructor(private readonly document: Document) {}
  private get active() {
    return this.entries.at(-1);
  }
  private descendant(entry: Entry, ancestor: object): boolean {
    let parent = entry.parent;
    while (parent) {
      if (parent === ancestor) return true;
      parent = this.entries.find((candidate) => candidate.id === parent)?.parent ?? null;
    }
    return false;
  }
  register(scope: FocusScope): () => void {
    const focused = this.document.activeElement;
    const before = this.entries.findIndex((entry) => this.descendant(entry, scope.id));
    const entry: Entry = {
      ...scope,
      returnTo:
        before >= 0
          ? this.entries[before]!.returnTo
          : focused instanceof this.document.defaultView!.HTMLElement
            ? focused
            : null,
      lastFocused: null,
      tabIndex: scope.container.getAttribute('tabindex'),
      modal: scope.container.getAttribute('aria-modal'),
      layerValue: scope.layer.style.getPropertyValue(LAYER),
      layerPriority: scope.layer.style.getPropertyPriority(LAYER),
    };
    if (entry.tabIndex === null) entry.container.tabIndex = -1;
    if (before < 0) this.entries.push(entry);
    else this.entries.splice(before, 0, entry);
    if (this.entries.length === 1) {
      this.document.addEventListener('keydown', this.keydown);
      this.document.addEventListener('focusin', this.focusin);
      const Observer = this.document.defaultView?.MutationObserver;
      if (Observer) {
        this.observer = new Observer(() => this.sync());
        this.observer.observe(this.document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            'hidden',
            'inert',
            'aria-hidden',
            'disabled',
            'style',
            'class',
            'tabindex',
            'open',
          ],
        });
      }
    }
    this.sync();
    return () => this.remove(entry);
  }
  private focus(
    entry: Entry,
    preferred: HTMLElement | null = entry.lastFocused,
    preventScroll = true,
  ) {
    const target =
      preferred && entry.container.contains(preferred) && available(preferred)
        ? preferred
        : (tabStops(entry.container)[0] ?? entry.container);
    this.focusing = true;
    try {
      target.focus({ preventScroll });
    } finally {
      this.focusing = false;
    }
  }
  private readonly focusin = (event: FocusEvent) => {
    const active = this.active;
    if (!active) return;
    const target = event.target as HTMLElement;
    if (active.container.contains(target) && available(target)) active.lastFocused = target;
    else if (!this.focusing) this.focus(active);
  };
  private readonly keydown = (event: KeyboardEvent) => {
    const active = this.active;
    if (!active || event.defaultPrevented || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      active.close();
      return;
    }
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const stops = tabStops(active.container);
    const index = stops.indexOf(this.document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? index <= 0
        ? stops.length - 1
        : index - 1
      : (index + 1) % stops.length;
    this.focus(active, stops[next] ?? active.container, false);
  };
  private sync() {
    const active = this.active;
    const disabled = new Set<HTMLElement>();
    if (active) {
      // Preserve the entire active overlay (including its clickable backdrop),
      // while making every branch outside that path inert and inaccessible.
      for (
        let current: HTMLElement | null = active.layer;
        current && current !== this.document.body;
        current = current.parentElement
      ) {
        for (const sibling of current.parentElement?.children ?? []) {
          if (sibling !== current && sibling instanceof this.document.defaultView!.HTMLElement)
            disabled.add(sibling);
        }
      }
    }
    for (const [element, previous] of this.hidden)
      if (!disabled.has(element)) {
        attribute(element, 'inert', previous.inert);
        attribute(element, 'aria-hidden', previous.ariaHidden);
        this.hidden.delete(element);
      }
    this.entries.forEach((entry, index) => {
      if (entry.layer.style.getPropertyValue(LAYER) !== String(index))
        entry.layer.style.setProperty(LAYER, String(index));
      attribute(entry.container, 'aria-modal', entry === active ? 'true' : 'false');
    });
    // Move focus before hiding the old branch; browsers reject aria-hidden on
    // an ancestor that still holds keyboard focus.
    if (
      active &&
      (!active.container.contains(this.document.activeElement) ||
        !available(this.document.activeElement as HTMLElement))
    )
      this.focus(active);
    for (const element of disabled) {
      if (!this.hidden.has(element))
        this.hidden.set(element, {
          inert: element.getAttribute('inert'),
          ariaHidden: element.getAttribute('aria-hidden'),
        });
      attribute(element, 'inert', '');
      attribute(element, 'aria-hidden', 'true');
    }
  }
  private remove(entry: Entry) {
    const top = this.active === entry;
    const index = this.entries.indexOf(entry);
    if (index < 0) return;
    this.entries.splice(index, 1);
    for (const remaining of this.entries)
      if (remaining.returnTo && entry.layer.contains(remaining.returnTo))
        remaining.returnTo = entry.returnTo;
    attribute(entry.container, 'tabindex', entry.tabIndex);
    attribute(entry.container, 'aria-modal', entry.modal);
    if (entry.layerValue)
      entry.layer.style.setProperty(LAYER, entry.layerValue, entry.layerPriority);
    else entry.layer.style.removeProperty(LAYER);
    this.sync();
    if (this.entries.length === 0) {
      this.document.removeEventListener('keydown', this.keydown);
      this.document.removeEventListener('focusin', this.focusin);
      this.observer?.disconnect();
      documents.delete(this.document);
    }
    if (!top) return;
    if (this.active) this.focus(this.active, entry.returnTo);
    else {
      const main = this.document.querySelector<HTMLElement>('main');
      const target =
        entry.returnTo && available(entry.returnTo)
          ? entry.returnTo
          : main && available(main)
            ? main
            : this.document.body;
      const prior = target.getAttribute('tabindex');
      if (!target.hasAttribute('tabindex') && target.tabIndex < 0) target.tabIndex = -1;
      target.focus({ preventScroll: true });
      attribute(target, 'tabindex', prior);
    }
  }
}
export function registerFocusScope(scope: FocusScope): () => void {
  const document = scope.container.ownerDocument;
  let coordinator = documents.get(document);
  if (!coordinator) {
    coordinator = new FocusCoordinator(document);
    documents.set(document, coordinator);
  }
  return coordinator.register(scope);
}
