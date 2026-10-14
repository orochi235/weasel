import { createElement, useMemo, useState } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '@weasel-js/renderer';
import type { ToolKeybinding } from '@weasel-js/routing';
import { worldToScreen } from 'core/viewport/viewTransform';
import { viewToTransform } from 'core/viewport/view';
import { polylineFromPoints } from '@weasel-js/geom';
import { OVERLAY_ROLE_STROKES } from 'canvas/overlayRoleStrokes';
import { MeasureIcon } from '../../../icons';
import { createMeasureActions, MEASURE_ACTION_IDS } from './measureActions';
import { createMeasurementStore, type MeasurementStore } from './measurement';

/** Options for `useMeasureTool`. */
export interface UseMeasureToolOptions {
  /** Where the tool keeps its measurement. Pass one to read it from outside
   *  the canvas — a readout, a panel. Default: a store of the tool's own. */
  store?: MeasurementStore;
  /** Override the default keybinding (`{ key: 'M' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
}

/** Screen-px half-length of the ticks across each end of the line. */
const TICK_PX = 5;

/** The measured line and a tick across each end, in screen space. */
function measureLayer(store: MeasurementStore): RenderLayer<unknown> {
  return {
    id: 'measure-line',
    label: 'Measure — line',
    space: 'screen',
    subscribe: store.subscribe,
    draw: (_data, view) => {
      const m = store.get();
      if (!m) return [];
      const t = viewToTransform(view);
      const [ax, ay] = worldToScreen(m.start.x, m.start.y, t);
      const [bx, by] = worldToScreen(m.end.x, m.end.y, t);
      const stroke = OVERLAY_ROLE_STROKES['measure'];
      const len = Math.hypot(bx - ax, by - ay);
      // The ticks run across the line; with no length yet they stand upright.
      const nx = len > 0 ? -(by - ay) / len : 0;
      const ny = len > 0 ? (bx - ax) / len : 1;
      const tick = (x: number, y: number): DrawCommand => ({
        kind: 'path',
        path: polylineFromPoints([
          { x: x - nx * TICK_PX, y: y - ny * TICK_PX },
          { x: x + nx * TICK_PX, y: y + ny * TICK_PX },
        ]),
        stroke,
      });
      const out: DrawCommand[] = [tick(ax, ay), tick(bx, by)];
      if (len > 0) out.unshift({ kind: 'path', path: polylineFromPoints([{ x: ax, y: ay }, { x: bx, y: by }]), stroke });
      return out;
    },
  };
}

/**
 * Measure tool. A drag measures from press to release in world units — both
 * ends through the `snap` dep, Shift holding the angle to 15° steps — and the
 * measurement stays on the canvas until the next drag, Escape, or a switch to
 * another tool. `measure.moveBy` moves the selection by the measured offset
 * and `measure.rotateBy` turns it about its center by the measured angle, each
 * as one undo step; they are the tool's own actions, so a readout can bind
 * buttons to them through the actions registry.
 */
export function useMeasureTool(options: UseMeasureToolOptions = {}): Tool {
  const [ownStore] = useState(createMeasurementStore);
  const store = options.store ?? ownStore;
  const actions = useMemo(() => createMeasureActions(store), [store]);
  const overlay = useMemo(() => measureLayer(store), [store]);

  const { keybinding } = options;
  return useMemo(() => defineTool({
    id: 'measure',
    capabilities: ['navigation'],
    hookName: 'useMeasureTool',
    cursor: 'crosshair',
    presentation: { label: 'Measure', icon: createElement(MeasureIcon), group: 'view' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'M' } }),
    actions,
    overlay,
    onDeactivate: () => store.set(null),
    bindings: [
      { spec: { kind: 'drag', mods: { shift: 'optional' } }, actionId: MEASURE_ACTION_IDS.measure },
      { spec: { kind: 'key', key: 'Escape' }, actionId: MEASURE_ACTION_IDS.clear },
    ],
  }), [actions, overlay, keybinding, store]);
}
