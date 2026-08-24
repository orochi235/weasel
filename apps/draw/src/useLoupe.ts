import { useEffect, useRef, useState } from 'react';
import type { RenderLayer, SceneCanvasApi } from '@weasel-js/core';
import type { Hud } from '@weasel-js/hud';
import { createLoupe, type LoupeHandle, type LoupeMode } from '@weasel-js/hud';

export interface LoupeController {
  visible: boolean;
  mode: LoupeMode;
  factor: number;
  /** Hex under the aim point, read off the framebuffer. Null until the
   *  pointer has moved over the canvas with the loupe showing. */
  color: string | null;
  toggle(): void;
  setMode(mode: LoupeMode): void;
  setFactor(factor: number): void;
}

export function useLoupe(
  ref: { current: SceneCanvasApi | null },
  hud: Hud,
  source: RenderLayer<unknown>[],
): LoupeController {
  const handle = useRef<LoupeHandle | null>(null);
  const [visible, setVisible] = useState(false);
  const [mode, setModeState] = useState<LoupeMode>('vector');
  const [factor, setFactorState] = useState(8);
  const [color, setColor] = useState<string | null>(null);

  // One stable layer delegating to the current `source`. Depending on
  // `source` directly would rebuild the loupe — losing position, size and
  // visibility — whenever the app re-memoizes a layer.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const stableSource = useRef<RenderLayer<unknown>[]>([{
    id: 'loupe-source',
    label: 'Loupe source',
    space: 'screen',
    draw: (data, view, dims) => sourceRef.current.flatMap((l) => l.draw(data, view, dims)),
  }]).current;

  useEffect(() => {
    const api = ref.current;
    if (!api?.element) return;
    const loupe = createLoupe({
      hud,
      element: api.element,
      source: stableSource,
      requestRedraw: () => api.requestRedraw(),
      onColorChange: setColor,
      onClose: () => { handle.current?.window.setHidden(true); setVisible(false); },
    });
    loupe.window.setHidden(true);
    handle.current = loupe;
    return () => { loupe.dispose(); handle.current = null; };
  }, [hud, ref, stableSource]);

  return {
    visible, mode, factor, color,
    toggle() {
      const loupe = handle.current;
      if (!loupe) return;
      const next = !visible;
      loupe.window.setHidden(!next);
      setVisible(next);
    },
    setMode(next) { handle.current?.setMode(next); setModeState(next); },
    setFactor(next) { handle.current?.setFactor(next); setFactorState(next); },
  };
}
