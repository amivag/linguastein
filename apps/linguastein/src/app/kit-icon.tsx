import type { KitIconName } from '@platform/ui';
import { Icon } from '../components/Icon';

/**
 * How the UI kit draws its few glyphs in this app: with the app's own icon set,
 * so a sheet's close button matches every other control around it.
 */
export function kitIcon(name: KitIconName) {
  return <Icon name={name} />;
}
