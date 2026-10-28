import { holdElapsed } from '@weasel-js/clock';
import { useLatest } from '@weasel-js/core';
import { createEmitter } from '@weasel-js/registry';
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useStore } from 'zustand/react';
import type { Instrument } from '../instrument/types';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { ClockRegistryContext, PENDING_CLOCK } from './contexts';
import {
  type ClockCapability,
  type ClockPosition,
  clockPosition,
  createTrialClock,
  declaredClock,
  type TrialClockHandle,
} from './trialClock';

interface Held {
  handle: TrialClockHandle;
  /** Where a reopened clock stood, when its first run could not reach it. */
  reopenAt: ClockPosition | null;
}

const shape = (s: ClockCapability): string =>
  `${s.duration}|${s.origin ?? 0}|${s.loop ?? false}|${s.speed}`;

function open(spec: ClockCapability, at: ClockPosition | undefined): Held {
  const handle = createTrialClock(spec, at);
  return { handle, reopenAt: at && handle.clock.elapsed !== at.elapsed ? at : null };
}

/** Where {@link useSeededClock} keeps its clock, outside React state. Shaped
 *  for `useSyncExternalStore`. */
function createSlot() {
  let held: Held | null = null;
  const changed = createEmitter();
  return {
    get: (): Held | null => held,
    set(next: Held | null): void {
      if (next === held) return;
      held = next;
      changed.emit();
    },
    subscribe: changed.subscribe,
  };
}

/**
 * The clock `make` opens while `live`, made in a layout effect so a render
 * makes none and StrictMode's second effect pass reuses the first one's. It
 * opens at `seed` when it is the first of the mount, or when `seed` changed
 * while there was none (a snapshot load turning it back on); else fresh.
 */
function useSeededClock(
  live: boolean,
  seed: ClockPosition | undefined,
  make: (at: ClockPosition | undefined) => Held | null,
): Held | null {
  const [slot] = useState(createSlot);
  const held = useSyncExternalStore(slot.subscribe, slot.get);
  /** The seed as the last clock was dropped; null before the mount's first. */
  const dropped = useRef<{ seed: ClockPosition | undefined } | null>(null);
  const latest = useLatest({ make, seed });
  useLayoutEffect(() => {
    const { make, seed } = latest.current;
    if (!live) {
      if (slot.get()) dropped.current = { seed };
      slot.set(null);
      return;
    }
    if (slot.get()) return;
    slot.set(make(dropped.current === null || dropped.current.seed !== seed ? seed : undefined));
  }, [live, latest, slot]);
  return live ? held : null;
}

interface Args {
  instrument: Instrument;
  config: unknown;
  record: TrialRecord;
  store: LabStore;
  /** The element showing the clock, which gates the shared frame loop. */
  target: () => Element | null;
}

/**
 * The trial's clock, from the instrument's `clock` (a function of `config` is
 * called every render). It is made when a declaration appears, kept across
 * edits that keep one (`declare` only), and dropped when it goes `null`.
 * `record.clock` seeds the first clock of a mount, and a later one when it was
 * written while there was none; a write while there is one, this tab's or
 * another's, leaves the clock where it stands. `provided` is what the trial
 * puts in `TrialClockContext`: the handle, or {@link PENDING_CLOCK} for a
 * declared clock not made yet, which it is for the trial's first render.
 */
export function useTrialClockSetup({ instrument, config, record, store, target }: Args): {
  handle: TrialClockHandle | null;
  provided: TrialClockHandle | typeof PENDING_CLOCK | null;
} {
  const clocks = useContext(ClockRegistryContext);
  const updateTrialClock = useStore(store, (s) => s.updateTrialClock);
  const onLab = instrument.clock === 'lab';
  const spec = declaredClock(instrument, config);
  if (onLab && !clocks?.shared)
    throw new Error(
      `[labkit] instrument "${instrument.name}" plays on the lab's clock, and its <Lab> declares no \`clock\``,
    );

  const declaredSpec = useLatest(spec);
  const held = useSeededClock(spec !== null, record.clock, (at) => {
    const declared = declaredSpec.current;
    return declared ? open(declared, at) : null;
  });
  const handle = onLab ? (clocks?.shared ?? null) : (held?.handle ?? null);

  const declaredShape = spec ? shape(spec) : null;
  const lastDeclared = useRef<{ handle: TrialClockHandle; shape: string } | null>(null);
  useLayoutEffect(() => {
    if (!held || !spec || declaredShape === null) return;
    const last = lastDeclared.current;
    lastDeclared.current = { handle: held.handle, shape: declaredShape };
    if (last?.handle !== held.handle || last.shape === declaredShape) return;
    held.handle.declare(spec);
  }, [held, declaredShape, spec]);

  useEffect(() => {
    if (!handle || !clocks) return;
    return clocks.register(record.id, handle, onLab ? undefined : target);
  }, [clocks, handle, record.id, target, onLab]);

  useEffect(() => {
    if (!handle || onLab) return;
    const { clock } = handle;
    return clock.subscribe(() =>
      updateTrialClock(
        record.id,
        clockPosition(clock, declaredSpec.current?.duration, declaredSpec.current?.origin),
      ),
    );
  }, [handle, onLab, record.id, updateTrialClock, declaredSpec]);

  useEffect(() => {
    if (!held || held.reopenAt === null) return;
    return holdElapsed(held.handle, held.reopenAt).release;
  }, [held]);

  const pending = !onLab && spec !== null && held === null;
  return { handle, provided: pending ? PENDING_CLOCK : handle };
}
