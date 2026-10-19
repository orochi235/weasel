import { defaultToastQueue, toast } from '@weasel-js/ui/components/Toast';

/** How many distinct warnings a toast quotes before it counts the rest. */
const QUOTED = 3;

/** What a toast says about what an SVG could not carry: how many, and the first few once each. */
export function describeSvgWarnings(
  did: 'Opened' | 'Imported' | 'Saved',
  warnings: readonly string[],
): { title: string; description: string } {
  const distinct = [...new Set(warnings)];
  const quoted = distinct.slice(0, QUOTED);
  const rest = distinct.length - quoted.length;
  return {
    title: distinct.length === 1 ? `${did} with 1 warning` : `${did} with ${distinct.length} warnings`,
    description: [...quoted, ...(rest > 0 ? [`and ${rest} more`] : [])].join('; '),
  };
}

/** Tells the user what an Open, Import, or Save left out. One toast: the next one replaces it. */
export function reportSvgWarnings(did: 'Opened' | 'Imported' | 'Saved', warnings: readonly string[]): void {
  if (warnings.length === 0) return;
  const { title, description } = describeSvgWarnings(did, warnings);
  toast.warning(title, { id: 'svg-warnings', description });
}

/** Tells the user a Save produced no file. */
export function reportSaveFailure(err: unknown): void {
  toast.error('The SVG was not saved', {
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
  toast.error('This drawing is not being kept in the browser', {
    id: SESSION_TOAST,
    description: 'The browser refused to store it. Use Save to keep a copy as an SVG file.',
    ttlMs: null,
  });
}
