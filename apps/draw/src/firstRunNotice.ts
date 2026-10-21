import { toast } from '@weasel-js/ui/components/Toast';

export const FIRST_RUN_KEY = 'weaseldraw:first-run-notice-v1';

/** Tells a first-time user what state the app is in and where their drawing
 *  lives. Shown once per browser; it stays up until dismissed. */
export function showFirstRunNotice(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): void {
  try {
    if (storage.getItem(FIRST_RUN_KEY) !== null) return;
    storage.setItem(FIRST_RUN_KEY, '1');
  } catch {
    // No store to remember in: show it, since saving is the thing it warns about.
  }
  toast.info('WeaselDraw is an alpha', {
    id: 'first-run',
    description: 'Your drawing is kept in this browser only. Use Save to keep a copy as an SVG file.',
    ttlMs: null,
  });
}
