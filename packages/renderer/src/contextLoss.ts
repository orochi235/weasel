/**
 * Listens where a WebGL context announces its loss and restore: the context's
 * own canvas, which the renderer need not own the size of. `lost` holds from
 * the loss until the restore; `onLost` runs as it is set and `onRestored` once
 * it has cleared.
 */
export class ContextLossWatch {
  lost = false;
  private readonly target: EventTarget;
  private readonly onLost: (e: Event) => void;
  private readonly onRestored: () => void;

  constructor(target: EventTarget, onRestored: () => void, lost = false, onLost?: () => void) {
    this.target = target;
    this.lost = lost;
    this.onLost = (e) => {
      e.preventDefault();
      this.lost = true;
      onLost?.();
    };
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
  events: Partial<EventTarget> | null, onRestored: () => void, lost = false, onLost?: () => void,
): ContextLossWatch | null {
  if (!events || typeof events.addEventListener !== 'function') return null;
  return new ContextLossWatch(events as EventTarget, onRestored, lost, onLost);
}
