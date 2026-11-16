import type { ReactNode } from 'react';
import { type MountTrialHistory, TrialHistoryContext } from '../trial/trialHistory';
import { type ChordTarget, useLabChords } from './labChords';

/** A lab with no trials: its page, where a history mounts in the trial's place, and that history's chords. */
export function TriallessPage({
  lone,
  children,
}: {
  lone: { mount: MountTrialHistory | null; chords: ChordTarget | null };
  children: ReactNode;
}) {
  useLabChords(null, lone.chords);
  return (
    <TrialHistoryContext.Provider value={lone.mount}>
      <div className="lk-lab__page">{children}</div>
    </TrialHistoryContext.Provider>
  );
}
