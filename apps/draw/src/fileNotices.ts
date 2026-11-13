import { toast } from '@weasel-js/ui/components/Toast';
import { reportFileWarnings, sessionSaveReporter } from '@weasel-js/editor';

/** Tells the user what an SVG Open, Import, or Save left out. One toast: the next one replaces it. */
export function reportSvgWarnings(did: 'Opened' | 'Imported' | 'Saved', warnings: readonly string[]): void {
  reportFileWarnings(did, warnings, 'svg-warnings');
}

/** Tells the user a picked file was not read, and `why`, so nothing was opened or imported. */
export function reportSvgUnread(did: 'opened' | 'imported', name: string, why: string): void {
  toast.danger(`“${name}” was not ${did}`, { id: 'svg-unreadable', description: why });
}

/** Tells the user a Save produced no file. */
export function reportSaveFailure(err: unknown): void {
  toast.danger('The SVG was not saved', {
    id: 'svg-save-failed',
    description: err instanceof Error ? err.message : String(err),
  });
}

/** Tells the user an export produced no file. */
export function reportExportFailure(format: 'PNG' | 'PDF', err: unknown): void {
  toast.danger(`The ${format} was not exported`, {
    id: 'export-failed',
    description: err instanceof Error ? err.message : String(err),
  });
}

/**
 * Report each save of the drawing to the browser's store. The first failure
 * of a run raises a toast that stays up; the next save that lands takes it
 * down.
 */
export const reportSessionSave: (saved: boolean) => void = sessionSaveReporter({
  id: 'session-save-failed',
  title: 'This drawing is not being kept in the browser',
  description: 'The browser refused to store it. Use Save to keep a copy as an SVG file.',
});
