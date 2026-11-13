import type { History } from '@weasel-js/history';
import { trialHistoryOf, useTrialHistory } from '@weasel-js/labkit';
import { useMemo } from 'react';

/** Hands a page's history to the lab around it, whose Undo and Redo, and their keys, then step it. */
export function HistorySlot({ history }: { history: History }) {
  useTrialHistory(useMemo(() => trialHistoryOf(history), [history]));
  return null;
}
