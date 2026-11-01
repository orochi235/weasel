import { useEffect, useRef } from 'react';
import { drawOneLayer, useLatest } from '@weasel-js/core';
import type { RenderLayer, SceneCanvasApi } from '@weasel-js/core';
import type { Hud } from '../hud';
import { createLoupe, type LoupeHandle, type LoupeMode } from '../loupe/createLoupe';

/** What the lens is told to be: whoever owns these drives it. */
export interface LoupeSettings {
  visible: boolean;
  mode: LoupeMode;
  factor: number;
}

/** What the lens reports back. */
export interface LoupeEvents {
  /** The hex under the aim point, read off the framebuffer. */
  onColorChange(hex: string): void;
  /** Called with the hex a click inside the lens picked. */
  onPick?(hex: string): void;
  /** The lens was closed from its own chrome. */
  onClose(): void;
}

/** A loupe over `ref`'s canvas, kept to `settings`. Mount only once `ref` is populated: `createLoupe` reads it in a
 *  mount effect and does not retry. */
export function useLoupe(
  ref: { current: SceneCanvasApi | null },
  hud: Hud,
  source: RenderLayer<unknown>[],
  settings: LoupeSettings,
  events: LoupeEvents,
): void {
  const handle = useRef<LoupeHandle | null>(null);

  // One stable layer delegating to the current `source`. Depending on
  // `source` directly would rebuild the loupe — losing position, size and
  // visibility — whenever the app re-memoizes a layer.
  const sourceRef = useLatest(source);

  // Same reason as `source`: fresh handlers or settings each render must not
  // rebuild the loupe and lose its position and size.
  const eventsRef = useLatest(events);
  const settingsRef = useLatest(settings);
  const stableSource = useRef<RenderLayer<unknown>[]>([{
    id: 'loupe-source',
    label: 'Loupe source',
    space: 'screen',
    // Through `drawOneLayer`, not `l.draw`: a source layer's `space` is its
    // own to declare, and calling `draw` directly drops a world layer's view
    // transform on the floor. The shim stays `'screen'` because its children
    // now carry their own.
    draw: (data, view, dims) => sourceRef.current.flatMap((l) => drawOneLayer(l, data, view, dims)),
  }]).current;

  useEffect(() => {
    const api = ref.current;
    if (!api?.surface) return;
    const { mode, factor, visible } = settingsRef.current;
    const loupe = createLoupe({
      hud,
      canvas: api.surface,
      ...(api.element ? { input: api.element } : {}),
      source: stableSource,
      mode,
      factor,
      requestRedraw: () => api.requestRedraw(),
      contentVersion: () => api.getPaintedVersion(),
      onColorChange: (hex) => eventsRef.current.onColorChange(hex),
      onPick: (hex) => eventsRef.current.onPick?.(hex),
      onClose: () => eventsRef.current.onClose(),
    });
    loupe.window.setHidden(!visible);
    handle.current = loupe;
    return () => { loupe.dispose(); handle.current = null; };
  }, [hud, eventsRef, settingsRef, ref, stableSource]);

  const { visible, mode, factor } = settings;
  useEffect(() => { handle.current?.window.setHidden(!visible); }, [visible]);
  useEffect(() => { handle.current?.setMode(mode); }, [mode]);
  useEffect(() => { handle.current?.setFactor(factor); }, [factor]);
}
