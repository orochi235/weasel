import { defaultToastQueue, toast } from '@weasel-js/ui/components/Toast';
import { reportFileWarnings } from '@editor/index';

/** Tells the user what an SVG Open, Import, or Save left out. One toast: the next one replaces it. */
export function reportSvgWarnings(did: 'Opened' | 'Imported' | 'Saved', warnings: readonly string[]): void {
  reportFileWarnings(did, warnings, 'svg-warnings');
}

/** Tells the user a Save produced no file. */
export function reportSaveFailure(err: unknown): void {
  toast.danger('The SVG was not saved', {
    id: 'svg-save-failed',
    description: err instanceof Error ? err.message : String(err),
  });
}

const SESSION_TOAST = 'session-save-failed';
let sessionFailing = false;

/**
 * Report each save of the drawing to the browser's store. The first failure
 * of a run raises a toast that stays up; the next save that lands takes it
 * down.
 */
export function reportSessionSave(saved: boolean): void {
  if (saved === !sessionFailing) return;
  sessionFailing = !saved;
  if (saved) {
    defaultToastQueue.dismiss(SESSION_TOAST);
    return;
  }
  toast.danger('This drawing is not being kept in the browser', {
    id: SESSION_TOAST,
    description: 'The browser refused to store it. Use Save to keep a copy as an SVG file.',
    ttlMs: null,
  });
}
