/**
 * A segmented bar's sweep: a drag across its segments sets each one it
 * reaches to what the press set the pressed one to, through the bar's
 * selection model; pressed with Alt, it solos the segments it reaches
 * (ui-input's `soloSweepFrom`). A pointer-only dispatcher of its own on the bar's row runs
 * it, so the drag is settled by the gesture system like any other: a segment
 * running a drag of its own, or a nested surface, takes the press instead.
 */
import { ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, useAction, useActionsRegistry, useGestureDispatcher } from '@weasel-js/routing/react';
import { createSweepAction, type ModifierState } from '@weasel-js/routing';
import { useLatest } from '@weasel-js/react';
import { useEffect, useMemo, useRef, type ReactElement, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { createLiveSelectionModel, soloSweepFrom, sweepFrom, type SelectionModel, type SelectState } from '@weasel-js/ui-input';

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
  swept(how: 'commit' | 'cancel'): void;
}

/** A click guard for a bar with a sweep: `swept` as a sweep ends, and `sweeping()` is true until the click its
 *  release makes has passed. A canceled sweep's pointer may still be down, so its guard holds until that release,
 *  or until the next press or key. */
export function useSweepGuard(): { swept: (how?: 'commit' | 'cancel') => void; sweeping: () => boolean } {
  const just = useRef(false);
  const listening = useRef<(() => void) | null>(null);
  useEffect(() => () => listening.current?.(), []);
  return {
    swept: (how = 'commit') => {
      listening.current?.();
      just.current = true;
      const clear = (): void => { just.current = false; };
      if (how === 'commit') {
        setTimeout(clear, 0);
        return;
      }
      const released = (): void => { stop(); setTimeout(clear, 0); };
      const pressed = (): void => { stop(); clear(); };
      const keyed = (event: KeyboardEvent): void => {
        if (event.repeat || event.key === 'Escape' || MODIFIER_KEYS.has(event.key)) return;
        pressed();
      };
      const stop = (): void => {
        if (listening.current === stop) listening.current = null;
        document.removeEventListener('pointerup', released, true);
        document.removeEventListener('pointercancel', released, true);
        document.removeEventListener('pointerdown', pressed, true);
        document.removeEventListener('keydown', keyed, true);
      };
      document.addEventListener('pointerup', released, true);
      document.addEventListener('pointercancel', released, true);
      document.addEventListener('pointerdown', pressed, true);
      document.addEventListener('keydown', keyed, true);
      listening.current = stop;
    },
    sweeping: () => just.current,
  };
}

const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Meta', 'Shift']);

const CHANNELS = { pointer: true, wheel: false, pinch: false, contextMenu: false, ingest: false, carry: false } as const;
const NO_ENTRIES = new Map();

function Dispatch<V>(props: SegmentSweeperProps<V>): null {
  const latest = useLatest(props);
  const registry = useActionsRegistry();
  const action = useMemo(() => createSweepAction<number>({
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
      // Each step reports through the bar's latest model, and renders before the next, so its handler sees the
      // value it now holds even when one move reaches several segments.
      const model = createLiveSelectionModel(() => latest.current.model, () => latest.current.values.length);
      const run = ctx.modifiers.alt
        ? soloSweepFrom(model, key, p.values.length, p.sweepable)
        : sweepFrom(model, key);
      let over = false;
      const finish = (how: 'commit' | 'cancel'): void => {
        if (over) return;
        over = true;
        window.removeEventListener('keydown', onKey, true);
        latest.current.swept(how);
        if (how === 'cancel') run.revert();
      };
      // The dispatcher hears no keys here, so the sweep takes its own Escape, and stops it there as a drag's does.
      const onKey = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape' || event.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        finish('cancel');
      };
      window.addEventListener('keydown', onKey, true);
      return {
        enter: ({ key: index }) => { if (!over) flushSync(() => run.reach(index)); },
        end: finish,
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
