import { type RefObject, useContext, useEffect, useState } from 'react';
import { LoupeCaptureContext } from './captureContext';
import { trialPayload } from './capturePayload';
import type { LabConditions } from './conditions';
import { createPixelsSource, type PixelsSource } from './pixelsSource';

/**
 * The workshop's Pixels source, capturing whichever trial lies under a lens as it renders against the lab now; null
 * where no dev server takes captures. Every attached lens looks again whenever a trial's inputs change.
 */
export function usePixelsSource(lab: RefObject<LabConditions>): PixelsSource | null {
  const capture = useContext(LoupeCaptureContext);
  const [source] = useState(() =>
    capture
      ? createPixelsSource({
          base: capture.base,
          payloadFor: (hit, dpr, c) => trialPayload(capture.trials.get(hit.trialId), lab.current, hit, dpr, c),
          revision: capture.revision.get,
          subscribeRevision: capture.revision.subscribe,
        })
      : null,
  );
  useEffect(() => (source && capture ? capture.trials.subscribe(() => source.remeasure()) : undefined), [source, capture]);
  return source;
}
