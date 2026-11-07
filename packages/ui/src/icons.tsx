/**
 * The few glyphs the kit itself draws, supplied by the app.
 *
 * The kit never names an icon library: each app already has one, behind its own
 * seam, with its own stroke and size tokens, and a second set inside the kit
 * would look different from everything around it. An app passes `icon` to
 * {@link UiProvider} once; without one, a plain text glyph stands in, so a kit
 * component still renders (in a test, say).
 *
 * Every kit glyph is decorative: the control it sits in carries the name.
 */

import { createContext, use, type ReactNode } from 'react';

/** Every glyph a kit component asks for. */
export const KIT_ICONS = ['close'] as const;
export type KitIconName = (typeof KIT_ICONS)[number];

export type RenderKitIcon = (name: KitIconName) => ReactNode;

const FALLBACK: Readonly<Record<KitIconName, string>> = { close: '×' };

const IconContext = createContext<RenderKitIcon>((name) => (
  <span aria-hidden="true">{FALLBACK[name]}</span>
));

/** The app's side of the kit: how to draw the kit's glyphs. */
export function UiProvider({
  icon,
  children,
}: {
  readonly icon: RenderKitIcon;
  readonly children: ReactNode;
}) {
  return <IconContext value={icon}>{children}</IconContext>;
}

/** One kit glyph, drawn by whatever the app provided. */
export function KitIcon({ name }: { readonly name: KitIconName }) {
  return use(IconContext)(name);
}
