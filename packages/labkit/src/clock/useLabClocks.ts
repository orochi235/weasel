import { type ClockRegistry, createClockRegistry } from '@weasel-js/clock';
import { useClockLoop } from '@weasel-js/clock/react';
import type { RecordCache } from '@weasel-js/storage';
import { useEffect, useState } from 'react';
import { valueRecord } from '../state/labRecords';
import {
  type ClockCapability,
  type ClockPosition,
  clockPosition,
  createTrialClock,
} from './trialClock';

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
    const lab = clocks.shared;
    if (!lab) return;
    return lab.clock.subscribe(() =>
      records.set(LAB_CLOCK_RECORD, clockPosition(lab.clock, spec?.duration)),
    );
  }, [clocks, spec, records]);
  useClockLoop(clocks);
  return clocks;
}
