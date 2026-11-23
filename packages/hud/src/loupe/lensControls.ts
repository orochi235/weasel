import { LOUPE_FACTOR_STOPS, type LoupeAimMode, type LoupeMode, type LoupeModel } from '@weasel-js/loupe';
import type { LoupeBaseOptions } from './createLoupe';
import type { Hud } from '../hud';
import type { WindowWidget } from '../widgets/window/window';
import { createModeSwitch } from './modeSwitch';
import { createZoomTrack } from './zoomTrack';
import { createPinHandle } from './pinHandle';
import { ringBoundsOf } from './rimTracks';
import type { GlyphSource } from '../glyph';
import type { IconSpec } from '@weasel-js/icons';

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
  aimMode(): LoupeAimMode;
  aim(): { x: number; y: number };
  pinAt(p: { x: number; y: number }): void;
  setAimMode(mode: LoupeAimMode): void;
  /** Puts the aim back as it is now, when called. */
  keepAim(): () => void;
  icons?: GlyphSource;
  modeIcons?: Partial<Record<LoupeMode, IconSpec>>;
  pinIcon?: IconSpec;
}

/** A lens's controls on its HUD: told where the pointer is, they show only near it. */
export interface LensControls {
  /** The pointer is at `p`, in the HUD's px. */
  pointerAt(p: { x: number; y: number }): void;
  remove(): void;
}

/** Px past the ring the pointer may be and still keep the controls up. */
const NEAR = 32;

/** Puts a lens's mode switch, zoom and pin on its HUD, above its window. They show while the pointer is near the ring,
 *  having moved or pressed there (a touch counts), or while the lens is being moved, and hide once it moves away. */
export function addLensControls(host: LensControlsHost): LensControls {
  const { hud, win, round } = host;
  let near = false;
  const shown = () => near || win.moving;
  const redrawn = <A extends unknown[]>(f: (...a: A) => void) => (...a: A) => { f(...a); host.requestRedraw(); };
  const widgets = [
    createModeSwitch(`${win.id}:mode`, {
      win, round, shown, mode: host.mode, setMode: redrawn(host.setMode),
      ...(host.icons ? { icons: host.icons } : {}), ...(host.modeIcons ? { modeIcons: host.modeIcons } : {}),
    }),
    createZoomTrack(`${win.id}:zoom`, { win, round, shown, stops: host.stops, factor: host.factor, setFactor: redrawn(host.setFactor) }),
    createPinHandle(`${win.id}:pin`, {
      win, round, shown, aimMode: host.aimMode, aim: host.aim, pinAt: redrawn(host.pinAt), setAimMode: redrawn(host.setAimMode),
      keepAim: () => redrawn(host.keepAim()),
      ...(host.icons ? { icons: host.icons } : {}), ...(host.pinIcon ? { pinIcon: host.pinIcon } : {}),
    }),
  ];
  for (const w of widgets) {
    const press = w.onPointer.bind(w);
    w.onPointer = (evt) => { press(evt); host.requestRedraw(); };
    hud.add(w);
  }
  return {
    pointerAt(p) {
      const r = ringBoundsOf(win.bounds);
      const next = p.x >= r.x - NEAR && p.x <= r.x + r.width + NEAR && p.y >= r.y - NEAR && p.y <= r.y + r.height + NEAR;
      if (next === near) return;
      near = next;
      host.requestRedraw();
    },
    remove() { for (const w of widgets) hud.remove(w); },
  };
}

/** {@link addLensControls} for a loupe: they set its model, and report a change it made to `opts`. */
export function addLoupeControls(
  opts: Pick<LoupeBaseOptions,
    'hud' | 'requestRedraw' | 'zoomStops' | 'onModeChange' | 'onFactorChange' | 'onAimModeChange' | 'icons' | 'modeIcons' | 'pinIcon'>,
  win: WindowWidget, model: LoupeModel, round: boolean,
): LensControls {
  return addLensControls({
    hud: opts.hud, win, round, stops: opts.zoomStops ?? LOUPE_FACTOR_STOPS, requestRedraw: opts.requestRedraw,
    ...(opts.icons ? { icons: opts.icons } : {}), ...(opts.modeIcons ? { modeIcons: opts.modeIcons } : {}),
    ...(opts.pinIcon ? { pinIcon: opts.pinIcon } : {}),
    aimMode: () => model.aimMode,
    aim: () => model.aim,
    pinAt: (p) => { const was = model.aimMode; model.pinAt(p); if (model.aimMode !== was) opts.onAimModeChange?.(model.aimMode); },
    setAimMode: (m) => { if (m === model.aimMode) return; model.setAimMode(m); opts.onAimModeChange?.(m); },
    keepAim: () => {
      const pin = model.pin;
      return () => {
        const was = model.aimMode;
        if (pin) model.holdPin(pin);
        else model.setAimMode('follow');
        if (model.aimMode !== was) opts.onAimModeChange?.(model.aimMode);
      };
    },
    mode: () => model.mode,
    setMode: (m) => { if (m === model.mode) return; model.setMode(m); opts.onModeChange?.(m); },
    factor: () => model.factor,
    setFactor: (f) => { if (f === model.factor) return; model.setFactor(f); opts.onFactorChange?.(model.factor); },
  });
}
