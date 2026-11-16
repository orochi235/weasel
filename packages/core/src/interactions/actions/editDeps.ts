/**
 * The deps behind the clipboard and Slice.
 */
import type { Point2, WorldPoint } from '@weasel-js/routing';

/**
 * Clipboard dep — the imperative surface `@weasel-js/editing`'s `useClipboardOps` returns.
 *
 * Consumers publish their live clipboard through `useDepSource('clipboard',
 * …)` from inside the `<DepRegistryProvider>` (i.e. under `<SceneCanvas>`).
 * The kit deliberately does not build one for them: `useClipboardOps` needs
 * an adapter and a selection reader that only the consumer can supply.
 */
export interface ClipboardDep {
  copy(): void;
  paste(at?: WorldPoint): void;
  isEmpty(): boolean;
}

/**
 * The commit behind the Slice action. `commit` receives the cut as a polyline
 * of at least two points (world coords): the drag's two ends for a straight
 * cut, its whole trail for a freehand one, the placed points for a
 * click-by-click one, whose last point equals its first when it closes into
 * a loop. `<SceneCanvas>` publishes one over its scene (`useSliceDepSource`);
 * a consumer replaces it with `useDepSource('slice', …)`.
 */
export interface SliceDep {
  commit(cut: ReadonlyArray<Point2>): void;
}
