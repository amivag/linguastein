/**
 * A short, local record of what went wrong, so a phone with no console can still
 * produce a bug report.
 *
 * Nothing here leaves the device. There is no server to send to, and the privacy
 * promise in Settings says so. The learner reads the record in Settings → About
 * and copies it into a report if they choose to. When a reporting service exists,
 * it becomes another sink beside `localStorage`; the capture stays as it is.
 *
 * Kept to the last few entries and to messages and stacks, never to state: a
 * stack names source files, not anything the learner typed or practised.
 */

import { storageKey } from './identity';

export type ErrorSource = 'interface' | 'uncaught' | 'rejection' | 'policy';

export interface ErrorRecord {
  /** ISO time, so a report can be matched against a build date. */
  readonly at: string;
  readonly source: ErrorSource;
  readonly message: string;
  readonly detail?: string;
}

const KEY = storageKey('errors');
const LIMIT = 20;
const DETAIL_LIMIT = 2000;

/** The recorded errors, oldest first. Empty where storage is unavailable. */
export function recentErrors(): readonly ErrorRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing recorded can be cleared where nothing could be recorded.
  }
}

/** Keeps one error. Never throws: this runs when things are already wrong. */
export function recordError(source: ErrorSource, error: unknown, detail?: string): void {
  const { message, stack } = describe(error);
  const extra = detail ?? stack;
  const record: ErrorRecord = {
    at: new Date().toISOString(),
    source,
    message,
    ...(extra ? { detail: extra.slice(0, DETAIL_LIMIT) } : {}),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([...recentErrors(), record].slice(-LIMIT)));
  } catch {
    // Storage full or refused. The console still has it.
  }
}

/**
 * Records what escapes every other handler: uncaught errors, unhandled
 * rejections, and anything the content security policy blocks. Returns the
 * function that removes the listeners again.
 */
export function installErrorCapture(scope: Window = window): () => void {
  const onError = (event: ErrorEvent) => {
    recordError('uncaught', event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    recordError('rejection', event.reason);
  };
  const onViolation = (event: SecurityPolicyViolationEvent) => {
    recordError(
      'policy',
      `Blocked by ${event.effectiveDirective}`,
      [event.blockedURI, event.sourceFile && `${event.sourceFile}:${event.lineNumber}`]
        .filter(Boolean)
        .join(' at '),
    );
  };

  scope.addEventListener('error', onError);
  scope.addEventListener('unhandledrejection', onRejection);
  scope.document.addEventListener('securitypolicyviolation', onViolation);
  return () => {
    scope.removeEventListener('error', onError);
    scope.removeEventListener('unhandledrejection', onRejection);
    scope.document.removeEventListener('securitypolicyviolation', onViolation);
  };
}

/** The plain-text report a learner can paste into an issue. */
export function errorReport(build: string, records: readonly ErrorRecord[]): string {
  const lines = [build, typeof navigator === 'undefined' ? '' : navigator.userAgent, ''];
  for (const record of records) {
    lines.push(`${record.at} [${record.source}] ${record.message}`);
    if (record.detail) lines.push(record.detail, '');
  }
  return lines.join('\n').trim();
}

function describe(error: unknown): { readonly message: string; readonly stack?: string } {
  if (error instanceof Error) {
    return {
      message: `${error.name}: ${error.message}`,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { message: typeof error === 'string' ? error : safeString(error) };
}

function safeString(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is ErrorRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ErrorRecord).at === 'string' &&
    typeof (value as ErrorRecord).message === 'string'
  );
}
