/**
 * The dep behind the clipboard.
 */
import type { WorldPoint } from '@weasel-js/routing';

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
