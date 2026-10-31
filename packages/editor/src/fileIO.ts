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

/**
 * Pop a hidden file input; resolve with the chosen file, or null if the user
 * cancelled. The input is created and removed per call.
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    document.body.appendChild(input);
    const settle = (file: File | null): void => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => settle(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => settle(null));
    input.click();
  });
}
