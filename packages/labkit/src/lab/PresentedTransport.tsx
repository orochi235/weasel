import { TrialTransport } from '../clock/TrialTransport';
import { usePresentedTransport } from './presentation';

/** How long an ended run holds on its last frame before it plays again. */
const REPLAY_HOLD_MS = 3000;

/** The play controls laid over trial `trialId` while its lab presents it. */
export function PresentedTransport({ trialId }: { trialId: string }) {
  if (!usePresentedTransport(trialId)) return null;
  return (
    <TrialTransport
      trialId={trialId}
      keys
      replay={REPLAY_HOLD_MS}
      className="lk-presented-transport"
    />
  );
}
