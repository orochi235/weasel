/**
 * A segmented bar's sweep: a drag across its segments sets each one it
 * reaches to what the press set the pressed one to, through the bar's
 * selection model. A pointer-only dispatcher of its own on the bar's row runs
 * it, so the drag is settled by the gesture system like any other: a segment
 * running a drag of its own, or a nested surface, takes the press instead.
 */
import {
  ActionsProvider,
  ActiveToolContextProvider,
  DepRegistryProvider,
  sweepAction,
  useAction,
  useActionsRegistry,
  useGestureDispatcher,
  type ModifierState,
} from '@weasel-js/core';
import { useLatest } from '@weasel-js/react';
import { useMemo, useRef, type ReactElement, type RefObject } from 'react';
import { sweepFrom, type SelectionModel, type SelectState } from '@weasel-js/ui-input';

/** The attribute naming a segment's index, which is what a sweep reaches. */
export const SWEEP_INDEX_ATTR = 'data-sweep-index';

/** The press a segmented bar's sweep would start from. */
export interface SegmentSweepPress<V> {
  /** The segment pressed. */
  value: V;
  /** Its state as pressed. The sweep sets every segment it reaches to the opposite of `'on'`. */
  state: SelectState;
  modifiers: ModifierState;
}

/** What turns a segmented bar's sweep on: always, or per press. */
export type SegmentSweep<V> = boolean | ((press: SegmentSweepPress<V>) => boolean);

export interface SegmentSweeperProps<V> {
  rootRef: RefObject<HTMLElement | null>;
  values: readonly V[];
  /** Whether segment `index` can be swept: not disabled. */
  sweepable(index: number): boolean;
  model: SelectionModel;
  sweep: SegmentSweep<V>;
  /** Called as a sweep ends, so the click the release makes is not taken for a press. */
  swept(): void;
}

/** A click guard for a bar with a sweep: `swept` as a sweep ends, and `sweeping()` is true until the click its
 *  release makes has passed. */
export function useSweepGuard(): { swept: () => void; sweeping: () => boolean } {
  const just = useRef(false);
  return {
    swept: () => {
      just.current = true;
      setTimeout(() => { just.current = false; }, 0);
    },
    sweeping: () => just.current,
  };
}

const CHANNELS = { pointer: true, wheel: false, pinch: false, contextMenu: false, ingest: false, carry: false } as const;
const NO_ENTRIES = new Map();

function Dispatch<V>(props: SegmentSweeperProps<V>): null {
  const latest = useLatest(props);
  const registry = useActionsRegistry();
  const action = useMemo(() => sweepAction<number>({
    surface: () => latest.current.rootRef.current,
    keyOf: (el) => {
      const raw = el.getAttribute(SWEEP_INDEX_ATTR);
      const index = raw === null ? NaN : Number(raw);
      return Number.isInteger(index) && latest.current.sweepable(index) ? index : undefined;
    },
    begin: ({ key, ctx }) => {
      const p = latest.current;
      const state = p.model.stateOf(key);
      if (typeof p.sweep === 'function' && !p.sweep({ value: p.values[key]!, state, modifiers: ctx.modifiers })) return null;
      const run = sweepFrom(p.model, key);
      return {
        enter: ({ key: index }) => run.reach(index),
        end: (how) => {
          latest.current.swept();
          if (how === 'cancel') run.revert();
        },
      };
    },
  }), [latest]);
  useAction(action);
  useGestureDispatcher({
    canvasRef: props.rootRef,
    actions: registry!,
    entriesById: NO_ENTRIES,
    keyboard: false,
    hears: 'own',
    controls: 'take',
    channels: CHANNELS,
  });
  return null;
}

/** Mounts the sweep's dispatcher on a segmented bar's row. Renders nothing. */
export function SegmentSweeper<V>(props: SegmentSweeperProps<V>): ReactElement {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Dispatch {...props} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}
