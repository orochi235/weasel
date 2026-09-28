/**
 * `useDebugDepSource` — wires the `debug` dep: the sink of the canvas this
 * registrar belongs to, so actions report to the same debug overlay tools do
 * through `ToolCtx.debug`. Resolved at invocation, because the canvas creates
 * its sink after this registers and swaps it whenever `debug` changes.
 */
import { useDepSource } from '@weasel-js/routing/react';
import type { CanvasExtensionApi } from '../canvasExtension';

export function useDebugDepSource(canvasApiRef: React.RefObject<CanvasExtensionApi | null>): void {
  useDepSource('debug', () => canvasApiRef.current?.getDebug() ?? undefined);
}
