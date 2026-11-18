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
 *  is what a person pasting a vector export actually wants. */
export async function copyCapture(result: CaptureResult): Promise<void> {
  if (result.format === 'svg') {
    if (!(await copyText(await result.blob.text()))) throw new Error(CLIPBOARD_REFUSED);
    return;
  }
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error(CLIPBOARD_REFUSED);
  await clipboard.write([new ClipboardItem({ 'image/png': result.blob })]);
}
