import { holdAt, type PlayheadHold } from '@weasel-js/clock';
import { useContext, useEffect, useRef } from 'react';
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
  type TrialClockHandle,
} from './trialClock';

interface Held {
  handle: TrialClockHandle;
  /** The four fields `declare` takes up, as last declared. */
  declared: string;
  /** Where a reopened clock stood, when its first span could not hold it. */
  reopenAt: number | null;
}

/** The time `position` showed, under the origin it ran at. */
const shownAt = (position: ClockPosition, spec: ClockCapability): number =>
  (position.origin ?? spec.origin ?? 0) + position.elapsed;

const shape = (s: ClockCapability): string =>
  `${s.duration}|${s.origin ?? 0}|${s.loop ?? false}|${s.speed}`;

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
 * `record.clock` seeds the first clock of a mount only.
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
  const raw = instrument.clock;
  const onLab = raw === 'lab';
  const spec = typeof raw === 'function' ? raw(config) : onLab ? null : raw;
  const held = useRef<Held | null>(null);
  const seeded = useRef(false);

  let handle: TrialClockHandle | null = null;
  if (onLab) {
    if (!clocks?.shared)
      throw new Error(
        `[labkit] instrument "${instrument.name}" plays on the lab's clock, and its <Lab> declares no \`clock\``,
      );
    handle = clocks.shared;
  } else if (!spec) {
    held.current = null;
  } else {
    if (!held.current) {
      const at = seeded.current ? undefined : record.clock;
      const made = createTrialClock(spec, at);
      const saved = at ? shownAt(at, spec) : null;
      held.current = {
        handle: made,
        declared: shape(spec),
        reopenAt: saved !== null && made.clock.origin + made.clock.elapsed !== saved ? saved : null,
      };
    }
    seeded.current = true;
    handle = held.current.handle;
  }

  const declaredShape = spec ? shape(spec) : null;
  useEffect(() => {
    const entry = held.current;
    if (!entry || !spec || declaredShape === null || entry.declared === declaredShape) return;
    entry.declared = declaredShape;
    entry.handle.declare(spec);
  }, [declaredShape, spec]);

  useEffect(() => {
    if (!handle || !clocks) return;
    return clocks.register(record.id, handle, onLab ? undefined : target);
  }, [clocks, handle, record.id, target, onLab]);

  const declaredSpec = useRef<ClockCapability | null>(null);
  declaredSpec.current = spec;
  // The position this hook last wrote, or seeded from; any other is a load from outside, as a snapshot's.
  const written = useRef<ClockPosition | undefined>(record.clock);
  useEffect(() => {
    if (!handle || onLab) return;
    const { clock } = handle;
    return clock.subscribe(() => {
      const position = clockPosition(
        clock,
        declaredSpec.current?.duration,
        declaredSpec.current?.origin,
      );
      written.current = position;
      updateTrialClock(record.id, position);
    });
  }, [handle, onLab, record.id, updateTrialClock]);

  const loaded = record.clock;
  const loadHold = useRef<PlayheadHold | null>(null);
  useEffect(() => {
    if (!handle || onLab || !loaded || loaded === written.current) return;
    written.current = loaded;
    const declaredNow = declaredSpec.current;
    if (!declaredNow) return;
    loadHold.current?.release();
    loadHold.current = holdAt(handle, shownAt(loaded, declaredNow));
  }, [handle, onLab, loaded]);
  useEffect(
    () => () => {
      loadHold.current?.release();
      loadHold.current = null;
    },
    [handle],
  );

  useEffect(() => {
    const entry = held.current;
    if (!handle || onLab || !entry || entry.handle !== handle || entry.reopenAt === null) return;
    return holdAt(handle, entry.reopenAt).release;
  }, [handle, onLab]);

  return handle;
}
