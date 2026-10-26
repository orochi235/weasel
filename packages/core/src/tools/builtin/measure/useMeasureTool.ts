import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { ToolKeybinding } from '@weasel-js/routing';
import type { Measurements } from 'domains/measure/measurements';
import { measureCreateAction, measurePickAtAction } from 'domains/measure/measureGestures';
import { MEASURE_ACTION_IDS } from 'domains/measure/actionIds';
import { icon } from '../../../icons.gen';

/** Options for `useMeasureTool`. */
export interface UseMeasureToolOptions {
  /** Where the measurements go and which one is picked — the same object the
   *  canvas's `measurementsContribution` and a readout are given. */
  measurements: Measurements;
  /** The angle step, in radians, Shift holds a measurement to. Default 15°.
   *  Read on every pointer move, so a change mid-drag applies at once. */
  angleStep?: number;
  /** Override the default keybinding (`{ key: 'M' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
}

/**
 * Measure tool. A drag adds a measurement from press to release in world
 * units — both ends through the `snap` dep, Shift holding the angle to
 * `angleStep` — as one undo step, and picks it. A click picks the
 * measurement under it, Escape drops the pick, and Delete removes the
 * current measurement. The measurements are scene nodes on an annotation
 * layer, so they stay when the tool changes; editing them under any tool,
 * and the commands that transform by them, come from
 * `measurementsContribution`, which the canvas installs beside this tool.
 */
export function useMeasureTool(options: UseMeasureToolOptions): Tool {
  const { measurements: ms, keybinding } = options;
  const actions = useMemo(() => [measureCreateAction(ms), measurePickAtAction(ms)], [ms]);
  const angleStep = useLatest(options.angleStep);

  return useMemo(() => defineTool({
    id: 'measure',
    capabilities: ['navigation'],
    hookName: 'useMeasureTool',
    cursor: 'crosshair',
    presentation: { label: 'Measure', icon: icon('measure'), group: 'view' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'M' } }),
    actions,
    onActivate: () => ms.measuring.set(true),
    onDeactivate: () => {
      ms.measuring.set(false);
      ms.draft.set(null);
    },
    bindings: [
      { spec: { kind: 'click' }, actionId: MEASURE_ACTION_IDS.pickAt, opts: { id: 'measure.pick' } },
      {
        spec: { kind: 'drag', mods: { shift: 'optional' } },
        actionId: MEASURE_ACTION_IDS.measure,
        opts: { id: 'measure.drag', params: () => (angleStep.current === undefined ? {} : { angleStep: angleStep.current }) },
      },
      { spec: { kind: 'key', key: 'Escape' }, actionId: MEASURE_ACTION_IDS.unpick, opts: { id: 'measure.unpick' } },
      { spec: { kind: 'key', key: 'Delete' }, actionId: MEASURE_ACTION_IDS.delete, opts: { id: 'measure.delete' } },
      { spec: { kind: 'key', key: 'Backspace' }, actionId: MEASURE_ACTION_IDS.delete, opts: { id: 'measure.backspace' } },
    ],
  }), [actions, keybinding, ms, angleStep]);
}
