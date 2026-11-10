import { ActionDisabledReason } from '@weasel-js/core';

/** Display strings for the closed `ActionDisabledReason` enum: what a
 *  palette row or a disabled button says about why it cannot run. Kept in ui
 *  rather than the kit so wording stays with the chrome. */
export const DEFAULT_REASON_LABELS: Readonly<Record<string, string>> = {
  [ActionDisabledReason.SelectionRequired]: 'Selection required',
  [ActionDisabledReason.SceneEmpty]: 'Scene is empty',
  [ActionDisabledReason.NotApplicable]: 'Not applicable here',
  [ActionDisabledReason.Locked]: 'Contains a locked item',
  [ActionDisabledReason.PredicateThrew]: '(predicate threw)',
};

/** What `labels` says for `reason`, else the reason itself. */
export function reasonLabel(reason: string, labels: Readonly<Record<string, string>> = DEFAULT_REASON_LABELS): string {
  return Object.hasOwn(labels, reason) ? labels[reason]! : reason;
}
