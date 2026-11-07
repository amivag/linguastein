/** The app's composed axes; pre-paint and runtime share their configuration. */
import { CONTRAST_AXIS } from './contrast';
import { INTENSITY_AXIS } from './intensity';
import { READING_SIZE_AXIS } from './reading-size';
import { PALETTE_AXIS, THEME_AXIS } from './themes';
import { serializeAxes, type AxisMetadata } from '@platform/appearance';
export type { PrePaintAxis } from '@platform/appearance';

export const APPEARANCE_AXES: readonly AxisMetadata[] = [
  THEME_AXIS,
  PALETTE_AXIS,
  CONTRAST_AXIS,
  INTENSITY_AXIS,
  READING_SIZE_AXIS,
];
export function prePaintAxes() {
  return serializeAxes(APPEARANCE_AXES);
}
