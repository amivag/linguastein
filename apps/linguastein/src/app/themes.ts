/** This app's theme plugins. Core appearance code never imports this catalog. */
import { defineThemeCatalog } from '../appearance';
export const APP_THEMES = defineThemeCatalog(
  [
    { id: 'indigo', label: 'Indigo', description: 'Cool indigo with a warm amber second voice.' },
    { id: 'teal', label: 'Teal', description: 'Green-cast greys and a deep teal accent.' },
    { id: 'plum', label: 'Plum', description: 'Violet greys and a fuchsia accent.' },
    { id: 'sand', label: 'Sand', description: 'Warm paper and bronze, with a cool highlight.' },
    {
      id: 'slate',
      label: 'Slate',
      description: 'Neutral greys, a clear blue accent and a magenta second voice.',
    },
    {
      id: 'rose',
      label: 'Rose',
      description: 'Warm pink-shaded neutrals, a deep rose accent and a teal highlight.',
    },
    {
      id: 'olive',
      label: 'Olive',
      description: 'Green-shaded neutrals, a deep olive accent and a violet highlight.',
    },
  ],
  'indigo',
);
