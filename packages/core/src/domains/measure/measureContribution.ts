import { hitPredicate } from '@weasel-js/gestures';
import type { Scene } from 'core/scene/types';
import type { SurfaceContribution } from 'canvas/surfaceContribution';
import type { Measurements } from './measurements';
import { measureCommands } from './measureCommands';
import { measureDragAction, measurePickAction } from './measureGestures';
import { MEASURE_AFFORDANCE_KIND, measurementsLayer } from './measureLayer';
import { MEASURE_ACTION_IDS } from './actionIds';

const onMeasurement = hitPredicate((hit) => (hit as { kind?: string } | null | undefined)?.kind === MEASURE_AFFORDANCE_KIND);

const MODS_ANY = { shift: 'optional', alt: 'optional', meta: 'optional', ctrl: 'optional' } as const;

/**
 * A scene's measurements on a canvas, whatever tool is active: the layer
 * that shows the picked one and claims presses on measurements, a click on
 * one to pick it and a drag to edit it, and the commands — Move by, Rotate
 * by, Delete, Clear — a readout binds buttons to. Install it with
 * `<SceneCanvas ambient={[…]}>`; `useMeasureTool` adds the measuring itself.
 */
export function measurementsContribution(
  scene: Scene<unknown, string, unknown>,
  ms: Measurements,
): SurfaceContribution {
  const layer = measurementsLayer(scene, ms);
  return {
    id: 'weasel-measure',
    eligibility: { claimed: true },
    attach: (api) => {
      const off = api.registerLayer(layer);
      api.requestRedraw();
      return off;
    },
    actions: [...measureCommands(ms), measurePickAction(ms), measureDragAction(ms)],
    bindings: [
      { spec: { kind: 'click', target: { kindOf: onMeasurement }, mods: MODS_ANY }, actionId: MEASURE_ACTION_IDS.pick, opts: { id: 'weasel-measure.click' } },
      { spec: { kind: 'drag', target: { kindOf: onMeasurement }, mods: MODS_ANY }, actionId: MEASURE_ACTION_IDS.drag, opts: { id: 'weasel-measure.drag' } },
    ],
  };
}
