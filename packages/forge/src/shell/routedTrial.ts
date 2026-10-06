import type { TrialRecord } from '@weasel-js/labkit';

/** The trial the URL's params belong to: the focused trial when it shows `route`, else the first that does. */
export function routedTrial<T extends Pick<TrialRecord, 'id' | 'instrumentName'>>(
  trials: readonly T[],
  focusedTrialId: string | null,
  route: string,
): T | undefined {
  return (
    trials.find((t) => t.id === focusedTrialId && t.instrumentName === route) ??
    trials.find((t) => t.instrumentName === route)
  );
}
