import type { PaintResources } from 'core/paintKinds';

/** A {@link PaintResources} with the end of its lifetime in the owner's hands. */
export interface OwnedPaintResources extends PaintResources {
  /** Run every registered release, once. Idempotent. */
  release(): void;
}

/** A fresh paint-resource lifetime. The renderer opens one per context
 *  generation and releases it on dispose or context restore. */
export function createPaintResources(): OwnedPaintResources {
  let releases: Array<() => void> | null = [];
  return {
    onRelease(release) {
      if (releases) releases.push(release);
      else release();
    },
    release() {
      const pending = releases;
      releases = null;
      for (const release of pending ?? []) release();
    },
  };
}
