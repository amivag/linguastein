/** App binding; copy src/appearance unchanged and supply another namespace. */
import { APP } from '../app/identity';
import { createAppearance } from '@platform/appearance';
export * from '@platform/appearance';
export const appearance = createAppearance({ namespace: APP.id });
export const defineAxis = appearance.defineAxis;
