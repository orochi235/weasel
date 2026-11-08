/**
 * A multiple-mode `ToggleBar`'s sweep: a drag across its segments sets each
 * one it reaches to what the press set the pressed one to. A pointer-only
 * dispatcher of its own on the bar's row runs it, so the drag is settled by
 * the gesture system like any other: a segment running a drag of its own, or
 * a nested surface, takes the press instead.
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
import { useMemo, type ReactElement, type RefObject } from 'react';

/** The attribute naming a segment's index, which is what a sweep reaches. */
export const SWEEP_INDEX_ATTR = 'data-sweep-index';

/** The press a {@link ToggleBar} sweep would start from. */
export interface ToggleBarSweepPress<V> {
  /** The segment pressed. */
  value: V;
  /** Its state as pressed. The sweep sets every segment it reaches to the opposite of `'on'`. */
  state: 'on' | 'off' | 'mixed';
  modifiers: ModifierState;
}

/** What turns a `ToggleBar`'s sweep on: always, or per press. */
export type ToggleBarSweep<V> = boolean | ((press: ToggleBarSweepPress<V>) => boolean);

export interface ToggleSweepProps<V> {
  rootRef: RefObject<HTMLElement | null>;
  values: readonly V[];
  /** Whether segment `index` can be swept: not disabled. */
  sweepable(index: number): boolean;
  stateOf(index: number): ToggleBarSweepPress<V>['state'];
  value: readonly V[];
  onChange(next: V[]): void;
  sweep: ToggleBarSweep<V>;
  /** Called as a sweep ends, so the click the release makes is not taken for a toggle. */
  swept(): void;
}

const CHANNELS = { pointer: true, wheel: false, pinch: false, contextMenu: false, ingest: false, carry: false } as const;
const NO_ENTRIES = new Map();

function Dispatch<V>(props: ToggleSweepProps<V>): null {
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
      const state = p.stateOf(key);
      if (typeof p.sweep === 'function' && !p.sweep({ value: p.values[key]!, state, modifiers: ctx.modifiers })) return null;
      const initial = [...p.value];
      const latch = state !== 'on';
      let working = initial;
      return {
        enter: ({ key: index }) => {
          const v = latest.current.values[index]!;
          if (working.includes(v) === latch) return;
          working = latch ? [...working, v] : working.filter((w) => w !== v);
          latest.current.onChange(working);
        },
        end: (how) => {
          latest.current.swept();
          if (how === 'cancel' && working !== initial) latest.current.onChange(initial);
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

/** Mounts the sweep's dispatcher on a `ToggleBar`'s row. Renders nothing. */
export function ToggleSweep<V>(props: ToggleSweepProps<V>): ReactElement {
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
