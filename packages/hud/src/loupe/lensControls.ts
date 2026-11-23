import { LOUPE_FACTOR_STOPS, type LoupeMode, type LoupeModel } from '@weasel-js/loupe';
import type { LoupeBaseOptions } from './createLoupe';
import type { Hud } from '../hud';
import type { WindowWidget } from '../widgets/window/window';
import { createModeSwitch } from './modeSwitch';
import { createZoomTrack } from './zoomTrack';

/** What a lens's controls read and set. */
export interface LensControlsHost {
  hud: Hud;
  win: WindowWidget;
  round: boolean;
  stops: readonly number[];
  mode(): LoupeMode;
  setMode(mode: LoupeMode): void;
  factor(): number;
  setFactor(factor: number): void;
  requestRedraw(): void;
}

/** Puts a lens's mode switch and zoom on its HUD, above its window. Returns their removal. */
export function addLensControls(host: LensControlsHost): () => void {
  const { hud, win, round } = host;
  const redrawn = <A extends unknown[]>(f: (...a: A) => void) => (...a: A) => { f(...a); host.requestRedraw(); };
  const widgets = [
    createModeSwitch(`${win.id}:mode`, { win, round, mode: host.mode, setMode: redrawn(host.setMode) }),
    createZoomTrack(`${win.id}:zoom`, { win, round, stops: host.stops, factor: host.factor, setFactor: redrawn(host.setFactor) }),
  ];
  for (const w of widgets) {
    const press = w.onPointer.bind(w);
    w.onPointer = (evt) => { press(evt); host.requestRedraw(); };
    hud.add(w);
  }
  return () => { for (const w of widgets) hud.remove(w); };
}

/** {@link addLensControls} for a loupe: they set its model, and report a change it made to `opts`. */
export function addLoupeControls(
  opts: Pick<LoupeBaseOptions, 'hud' | 'requestRedraw' | 'zoomStops' | 'onModeChange' | 'onFactorChange'>,
  win: WindowWidget, model: LoupeModel, round: boolean,
): () => void {
  return addLensControls({
    hud: opts.hud, win, round, stops: opts.zoomStops ?? LOUPE_FACTOR_STOPS, requestRedraw: opts.requestRedraw,
    mode: () => model.mode,
    setMode: (m) => { if (m === model.mode) return; model.setMode(m); opts.onModeChange?.(m); },
    factor: () => model.factor,
    setFactor: (f) => { if (f === model.factor) return; model.setFactor(f); opts.onFactorChange?.(model.factor); },
  });
}
