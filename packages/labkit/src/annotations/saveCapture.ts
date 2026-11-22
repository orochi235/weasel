import { copyText } from '@weasel-js/react';
import type { CaptureResult } from './types';

function fileName(result: CaptureResult): string {
  return `${result.target.replace(/[^a-z0-9._-]+/gi, '-')}.${result.format}`;
}

/** A blob the person asked for, handed to the browser's own save flow. The
 *  object URL is revoked on the next turn — revoking it synchronously races
 *  the navigation the click starts. */
export function downloadCapture(result: CaptureResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(result);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const CLIPBOARD_REFUSED = 'The browser would not let the page write to the clipboard.';

/** PNG goes to the clipboard as an image. SVG goes as text: `image/svg+xml`
 *  needs Chromium's `web ` prefix and nothing else reads it, while the markup
 *  is what a person pasting a vector export actually wants.
 *
 *  Call it inside the click, with the capture still pending: the write starts
 *  at once, holding the capture's promise, since a browser refuses one started
 *  after the click's activation has lapsed (Safari after any await). */
export async function copyCapture(
  pending: Promise<CaptureResult>,
  format: CaptureResult['format'],
): Promise<void> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard?.write || typeof ClipboardItem === 'undefined') {
    // A text write has an older route that takes a string, which needs the capture first.
    const result = await pending;
    if (format === 'svg' && (await copyText(await result.blob.text()))) return;
    throw new Error(CLIPBOARD_REFUSED);
  }
  const mime = format === 'svg' ? 'text/plain' : 'image/png';
  const blob = pending.then(async (r) =>
    format === 'svg' ? new Blob([await r.blob.text()], { type: mime }) : r.blob,
  );
  const written = clipboard.write([new ClipboardItem({ [mime]: blob })]);
  // The capture's own failure says more than the write's refusal of it.
  written.catch(() => {});
  await pending;
  try {
    await written;
  } catch {
    throw new Error(CLIPBOARD_REFUSED);
  }
}
