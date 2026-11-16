import { ActionDisabledReason } from '@weasel-js/routing';

/** Display strings for the closed `ActionDisabledReason` enum: what a
 *  palette row or a disabled button says about why it cannot run. Kept in ui
 *  rather than the kit so wording stays with the chrome; spread it into a map
 *  of your own to reword some reasons and keep the rest. */
export const DEFAULT_REASON_LABELS: Readonly<Record<string, string>> = {
  [ActionDisabledReason.SelectionRequired]: 'Selection required',
  [ActionDisabledReason.SceneEmpty]: 'Scene is empty',
  [ActionDisabledReason.NotApplicable]: 'Not applicable here',
  [ActionDisabledReason.Locked]: 'Contains a locked item',
  [ActionDisabledReason.PredicateThrew]: '(predicate threw)',
};

/**
 * The words chrome shows for why an action cannot run: `labels[reason]`, else
 * `reason` itself, so a consumer's own reason string still reads. `reason` is
 * what {@link useActionStates} reports as `ActionState.reason`, an
 * `ActionDisabledReason` or any string an action's `enabled` returned; pass
 * `labels` to change the wording, starting from {@link DEFAULT_REASON_LABELS}.
 *
 * @example
 * ```tsx
 * const [state] = useActionStates([item]);
 * return (
 *   <ActionButton
 *     label="Delete"
 *     disabled={!state.enabled}
 *     {...(state.reason !== undefined ? { disabledReason: reasonLabel(state.reason) } : {})}
 *     onPress={run}
 *   />
 * );
 * ```
 */
export function reasonLabel(reason: string, labels: Readonly<Record<string, string>> = DEFAULT_REASON_LABELS): string {
  return Object.hasOwn(labels, reason) ? labels[reason]! : reason;
}
