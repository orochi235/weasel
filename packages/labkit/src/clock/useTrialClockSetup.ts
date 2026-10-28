import { holdAt, shownInPass } from '@weasel-js/clock';
import { useLatest } from '@weasel-js/core';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from 'zustand/react';
import type { Instrument } from '../instrument/types';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { ClockRegistryContext } from './contexts';
import {
  type ClockCapability,
  type ClockPosition,
  clockPosition,
  createTrialClock,
  declaredClock,
  shownAt,
  type TrialClockHandle,
} from './trialClock';

interface Held {
  handle: TrialClockHandle;
  /** Where a reopened clock stood, when its first span could not hold it. */
  reopenAt: number | null;
}

const shape = (s: ClockCapability): string =>
  `${s.duration}|${s.origin ?? 0}|${s.loop ?? false}|${s.speed}`;

function open(spec: ClockCapability, at: ClockPosition | undefined): Held {
  const handle = createTrialClock(spec, at);
  const { clock } = handle;
  const duration = spec.duration ?? Number.POSITIVE_INFINITY;
  const saved = at ? shownAt(at, spec.origin ?? 0, duration, clock.loop) : null;
  const shown = shownInPass(clock.origin, clock.elapsed, clock.duration, clock.loop);
  return { handle, reopenAt: saved !== null && shown !== saved ? saved : null };
}

/**
 * The clock `make` opens while `live`, made in a layout effect so a render
 * makes none and StrictMode's second effect pass reuses the first one's.
 * `seeded`: a clock was made earlier in this mount.
 */
function useOwnClock(live: boolean, make: (seeded: boolean) => Held | null): Held | null {
  const [held, setHeld] = useState<Held | null>(null);
  const made = useRef<Held | null>(null);
  const seeded = useRef(false);
  const latestMake = useLatest(make);
  useLayoutEffect(() => {
    if (!live) {
      made.current = null;
      setHeld(null);
      return;
    }
    if (!made.current) {
      made.current = latestMake.current(seeded.current);
      seeded.current = true;
    }
    setHeld(made.current);
  }, [live, latestMake]);
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
 * `record.clock` seeds the first clock of a mount only; a later write to it,
 * this tab's or another's, leaves the clock where it stands.
 */
export function useTrialClockSetup({
  instrument,
  config,
  record,
  store,
  target,
}: Args): TrialClockHandle | null {
  const clocks = useContext(ClockRegistryContext);
  const updateTrialClock = useStore(store, (s) => s.updateTrialClock);
  const onLab = instrument.clock === 'lab';
  const spec = declaredClock(instrument, config);
  if (onLab && !clocks?.shared)
    throw new Error(
      `[labkit] instrument "${instrument.name}" plays on the lab's clock, and its <Lab> declares no \`clock\``,
    );

  const declaredSpec = useLatest(spec);
  const seed = useLatest(record.clock);
  const held = useOwnClock(spec !== null, (seeded) => {
    const declared = declaredSpec.current;
    return declared ? open(declared, seeded ? undefined : seed.current) : null;
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
    return holdAt(held.handle, held.reopenAt).release;
  }, [held]);

  return handle;
}
