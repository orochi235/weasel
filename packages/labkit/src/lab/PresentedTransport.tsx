import { useEffect, useRef, useState } from 'react';
import { TrialTransport } from '../clock/TrialTransport';
import { usePresentedTransport } from './presentation';

/** How long an ended run holds on its last frame before it plays again. */
const REPLAY_HOLD_MS = 3000;

/** The play controls laid over trial `trialId` while its lab presents it,
 *  hidden while the presented box is narrower than they allow. */
export function PresentedTransport({ trialId }: { trialId: string }) {
  const options = usePresentedTransport(trialId);
  const shown = options !== null;
  const minWidth = options?.minWidth ?? 0;
  const ref = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const box = ref.current?.closest<HTMLElement>('[data-lk-presented]');
    if (!box) return;
    const update = (): void => setNarrow(box.getBoundingClientRect().width < minWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, [shown, minWidth]);
  if (!options) return null;
  return (
    <div
      ref={ref}
      className={
        narrow ? 'lk-presented-transport lk-presented-transport--narrow' : 'lk-presented-transport'
      }
    >
      <TrialTransport
        trialId={trialId}
        keys
        replay={REPLAY_HOLD_MS}
        {...(options.formatRate ? { formatRate: options.formatRate } : {})}
      />
    </div>
  );
}
