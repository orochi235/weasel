export interface BackgroundClickCtx {
  selection: {
    clear: () => void;
    /** Clear only within the active isolation scope. */
    clearScoped: () => void;
  };
  /** Called when text-edit needs to finalize the in-flight text edit
   *  before the mode exits. */
  commitText: () => void;
}

/** Per-mode composition table from the spec. `exit` is the callback that
 *  performs the mode exit (machine.exitMode + any side effects). */
export function handleBackgroundClick(
  activeModeId: string,
  ctx: BackgroundClickCtx,
  exit: () => void,
): void {
  switch (activeModeId) {
    case 'normal':
      ctx.selection.clear();
      return;
    case 'path-edit':
      return;
    case 'isolation':
      ctx.selection.clearScoped();
      return;
    case 'text-edit':
      ctx.commitText();
      exit();
      return;
    case 'free-transform':
    case 'crop':
      return;
    default:
      // Unknown mode: conservative default — do nothing.
      return;
  }
}
