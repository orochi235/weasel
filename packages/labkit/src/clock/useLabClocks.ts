import type { RecordCache } from '@weasel-js/storage';
import { useEffect, useState } from 'react';
import { valueRecord } from '../state/labRecords';
import { type ClockRegistry, createClockRegistry } from './clockRegistry';
import {
  type ClockCapability,
  type ClockPosition,
  clockPosition,
  createTrialClock,
} from './trialClock';
import { useClockLoop } from './useClockLoop';

const LAB_CLOCK_RECORD = valueRecord(null, 'lk-lab-clock');

/** A lab's clocks, run by its one frame loop. With `spec`, the registry holds
 *  the lab's own clock, reopened where `records` kept it and kept there since. */
export function useLabClocks(
  spec: ClockCapability | undefined,
  records: RecordCache,
): ClockRegistry {
  const [clocks] = useState(() =>
    createClockRegistry(
      spec
        ? createTrialClock(spec, records.get(LAB_CLOCK_RECORD) as ClockPosition | undefined)
        : null,
    ),
  );
  useEffect(() => {
    const lab = clocks.lab;
    if (!lab) return;
    return lab.clock.subscribe(() =>
      records.set(LAB_CLOCK_RECORD, clockPosition(lab.clock, spec?.duration)),
    );
  }, [clocks, spec, records]);
  useClockLoop(clocks);
  return clocks;
}
