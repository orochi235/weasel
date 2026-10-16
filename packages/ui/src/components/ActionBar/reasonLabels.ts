import { ActionDisabledReason } from '@weasel-js/core';

/** Display strings for the closed `ActionDisabledReason` enum: what a
 *  palette row or a disabled button says about why it cannot run. Kept in ui
 *  rather than the kit so wording stays with the chrome. */
export const DEFAULT_REASON_LABELS: Readonly<Record<string, string>> = {
  [ActionDisabledReason.SelectionRequired]: 'Selection required',
  [ActionDisabledReason.SceneEmpty]: 'Scene is empty',
  [ActionDisabledReason.NotApplicable]: 'Not applicable here',
  [ActionDisabledReason.PredicateThrew]: '(predicate threw)',
};
