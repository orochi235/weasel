import { useSyncExternalStore, type ReactElement } from 'react';
import {
  actionItems,
  currentMeasureId,
  MEASURE_ACTION_IDS,
  measurementOf,
  useActionsRegistry,
  type Action,
  type ActionItem,
  type Measurements,
  type Scene,
} from '@weasel-js/core';
import { decimal, qty } from '@weasel-js/quantity';
import { useActionStates } from '../ActionBar/useActionStates';
import { DEFAULT_REASON_LABELS } from '../ActionBar/reasonLabels';
import { BarActionButton } from '../Bar/BarAction';
import s from './MeasureReadout.module.css';

const COMMANDS: readonly [string, string][] = [
  [MEASURE_ACTION_IDS.moveBy, 'Move by'],
  [MEASURE_ACTION_IDS.rotateBy, 'Rotate by'],
  [MEASURE_ACTION_IDS.delete, 'Delete'],
  [MEASURE_ACTION_IDS.clear, 'Clear all'],
];

const AT = decimal({ places: 2, grouping: false });
const format = (n: number): string => qty(n, AT).text;
const NONE: readonly Action[] = Object.freeze([]);
const noSubscribe = (): (() => void) => () => {};

/** Props for {@link MeasureReadout}. */
export interface MeasureReadoutProps {
  /** The scene the measurements are nodes of. */
  scene: Scene<unknown, string, unknown>;
  /** The same object `useMeasureTool` and `measurementsContribution` are given. */
  measurements: Measurements;
  /** Additional class for the root, to place it. */
  className?: string;
}

function useCommands(): { items: ActionItem[]; trigger: (id: string) => void } {
  const registry = useActionsRegistry();
  const all = useSyncExternalStore(
    registry ? registry.subscribe : noSubscribe,
    registry ? registry.list : () => NONE,
    registry ? registry.list : () => NONE,
  );
  const items = COMMANDS.flatMap(([id]) => all.filter((a) => a.id === id).flatMap(actionItems));
  return { items, trigger: (id) => { registry?.trigger(id); } };
}

/**
 * The measurement readout: a chip pinned to the bottom of the nearest
 * positioned ancestor, showing the measurement a measure drag is drawing,
 * else the picked one, else the newest — its distance, offset, and angle in
 * world units — with Move by, Rotate by, Delete, and Clear all from the
 * actions registry. A command that cannot run says why in its tooltip. The
 * angle reads like a protractor, counterclockwise-positive: a line rising to
 * the right at 30° reads 30°, and Rotate by turns the selection that way.
 */
export function MeasureReadout({ scene, measurements: ms, className }: MeasureReadoutProps): ReactElement | null {
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);
  // Read through `currentMeasureId` below; subscribed so a new pick re-renders.
  useSyncExternalStore(ms.picked.subscribe, ms.picked.get, ms.picked.get);
  const draft = useSyncExternalStore(ms.draft.subscribe, ms.draft.get, ms.draft.get);
  const { items, trigger } = useCommands();
  const states = useActionStates(items);
  const id = currentMeasureId(scene, ms);
  const m = draft ?? (id === null ? null : measurementOf(scene.get(id)));
  if (!m) return null;
  const cells: [string, string][] = [
    ['Distance', format(m.distance)],
    ['ΔX', format(m.dx)],
    ['ΔY', format(m.dy)],
    ['Angle', `${format((m.angle * 180) / Math.PI)}°`],
  ];
  return (
    <div className={[s.readout, className].filter(Boolean).join(' ')} role="group" aria-label="Measurement">
      <div className={s.actions} role="toolbar" aria-label="Measurement commands">
        {COMMANDS.map(([cmd, label]) => {
          const i = items.findIndex((it) => it.action.id === cmd);
          if (i < 0) return null;
          const state = states[i]!;
          return (
            <BarActionButton
              key={cmd}
              label={label}
              labeled
              disabled={!state.enabled}
              {...(state.reason !== undefined ? { disabledReason: DEFAULT_REASON_LABELS[state.reason] ?? state.reason } : {})}
              onPress={() => trigger(cmd)}
            />
          );
        })}
      </div>
      {cells.map(([name, value]) => (
        <span key={name} className={s.cell}>
          <span className={s.name}>{name}</span>
          <span className={s.value}>{value}</span>
        </span>
      ))}
    </div>
  );
}
