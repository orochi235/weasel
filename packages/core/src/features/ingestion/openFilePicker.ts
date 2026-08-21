/**
 * `openFilePicker` — tiny DOM helper opening the OS file dialog and resolving
 * the chosen `File[]` ([] on cancel). Pairs with `CanvasExtensionApi.ingest`:
 *
 * ```ts
 * const files = await openFilePicker({ accept: 'image/*', multiple: true });
 * canvasRef.current?.ingest(files);
 * ```
 *
 * Must be called from a user-activation context (a click handler) — browsers
 * block programmatic `input.click()` otherwise.
 */
export interface OpenFilePickerOptions {
  /** `<input accept>` filter, e.g. `'image/*'` or `'.csv,text/csv'`. */
  accept?: string;
  /** Allow multi-select. Default false. */
  multiple?: boolean;
}

/** Show the browser's file picker and resolve with what the user chose —
 *  empty when they cancel. Must be called from a user gesture. */
export function openFilePicker(opts: OpenFilePickerOptions = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    if (opts.accept) input.accept = opts.accept;
    if (opts.multiple) input.multiple = true;
    document.body.appendChild(input);
    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])), { once: true });
    // Fired by browsers that support it when the dialog is dismissed. When
    // unsupported, the input simply leaks until the page unloads — acceptable
    // for a hidden element; no timer heuristics.
    input.addEventListener('cancel', () => finish([]), { once: true });
    input.click();
  });
}
