/**
 * What has to be in place before any other module runs.
 *
 * Imported first by `main.tsx`, for its side effects. ES modules evaluate in
 * import order, and some modules validate stored settings with Zod while they
 * load, so a call placed in `main.tsx`'s body would come too late for them.
 */

import { config as zodConfig } from 'zod';
import { installErrorCapture } from './diagnostics';
import { installTrustedTypesPolicy } from '@platform/web';

// First, so a failure anywhere below is still kept for Settings → About.
installErrorCapture();
// Before anything can reach a Trusted Types sink; see `trusted-types.ts`.
installTrustedTypesPolicy();
// The content security policy forbids `eval`. Without this, Zod probes for it
// with `new Function` on its first parse, and every load reports a violation.
zodConfig({ jitless: true });
