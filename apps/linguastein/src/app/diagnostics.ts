/**
 * This app's on-device error log (`@platform/web`), under its own storage key.
 *
 * Nothing leaves the device: Settings → About reads the record and copies it into
 * a report when the learner chooses to.
 */

import { createErrorLog } from '@platform/web';
import { storageKey } from './identity';

const log = createErrorLog({ key: storageKey('errors') });

export const { recentErrors, clearErrors, recordError, installErrorCapture } = log;
export { errorReport, type ErrorRecord, type ErrorSource } from '@platform/web';
