/** Trigger a browser download of `blob` as a file named `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the click has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** How long after the window regains focus a pick may still report its file. */
const PICK_SETTLE_MS = 500;

/**
 * Pop a hidden file input; resolve with the chosen file, or null if the user
 * canceled. The input is created and removed per call. Where the browser
 * fires no `cancel`, the window regaining focus with no file chosen counts as one.
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    document.body.appendChild(input);
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (file: File | null): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };
    // Some browsers deliver `change` a moment after the focus returns.
    const onFocus = (): void => {
      timer = setTimeout(() => settle(input.files?.[0] ?? null), PICK_SETTLE_MS);
    };
    input.addEventListener('change', () => settle(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => settle(null));
    window.addEventListener('focus', onFocus, { once: true });
    input.click();
  });
}
