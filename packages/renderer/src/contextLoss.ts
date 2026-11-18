/**
 * Listens where a WebGL context announces its loss and restore: the context's
 * own canvas, which the renderer need not own the size of. `lost` holds from
 * the loss until the restore, and `onRestored` runs once it has cleared.
 */
export class ContextLossWatch {
  lost = false;
  private readonly target: EventTarget;
  private readonly onLost = (e: Event): void => {
    e.preventDefault();
    this.lost = true;
  };
  private readonly onRestored: () => void;

  constructor(target: EventTarget, onRestored: () => void) {
    this.target = target;
    this.onRestored = () => {
      this.lost = false;
      onRestored();
    };
    target.addEventListener('webglcontextlost', this.onLost);
    target.addEventListener('webglcontextrestored', this.onRestored);
  }

  detach(): void {
    this.target.removeEventListener('webglcontextlost', this.onLost);
    this.target.removeEventListener('webglcontextrestored', this.onRestored);
  }
}

/** A watch on `events`, or null when it is nothing that can be listened to. */
export function watchContextLoss(
  events: Partial<EventTarget> | null, onRestored: () => void,
): ContextLossWatch | null {
  if (!events || typeof events.addEventListener !== 'function') return null;
  return new ContextLossWatch(events as EventTarget, onRestored);
}
