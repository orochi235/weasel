import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';
import type { CapabilityTag } from '@weasel-js/modes';

/**
 * Live state read by rule evaluation. Built once per frame on the consuming
 * surface — chrome-caps, the affordance pipeline, the dispatcher's
 * eligibility filter — and discarded.
 *
 * Adding a new field is additive: existing rules don't change, new
 * selector atoms can read it.
 */
export interface RuleCtx {
  readonly focused: boolean;
  readonly selection: readonly NodeId[];
  readonly multiActive: boolean;
  readonly modifiers: ModifierState;
  readonly action: { readonly kind: string | null; readonly id: string | null };
  readonly hover: NodeId | null;
  readonly view: View;
  /** Active mode id. `'normal'` when no non-default mode is engaged. */
  readonly mode: string;
  /** Capability tags allowed by the active mode (the union of
   *  `ModeDefinition.allows` plus implicit tags). The `capability:`
   *  selector reads this to determine whether a tag is permitted. */
  readonly allowedCapabilities: ReadonlySet<CapabilityTag>;
  /** Whether the current selection may be resized. `<SceneCanvas>` folds
   *  `selectTool.resize.resizable` over the selection (true only when every
   *  selected node is resizable). Read by the `resizable:` selector to gate
   *  `selection.resize-handles`. Absent (legacy ctx builders) is treated as
   *  resizable — back-compat: handles show unless a consumer opts a node out. */
  readonly selectionResizable?: boolean;
}

export interface BuildRuleCtxArgs {
  focused: boolean;
  selection: readonly NodeId[];
  multiActive: boolean;
  modifiers: ModifierState;
  action: { kind: string | null; id: string | null };
  hover: NodeId | null;
  view: View;
  mode: string;
  allowedCapabilities: ReadonlySet<CapabilityTag>;
  /** Optional — omitted means "resizable" (handles show). See {@link RuleCtx}. */
  selectionResizable?: boolean;
}

export function buildRuleCtx(args: BuildRuleCtxArgs): RuleCtx {
  return {
    focused: args.focused,
    selection: args.selection,
    multiActive: args.multiActive,
    modifiers: args.modifiers,
    action: args.action,
    hover: args.hover,
    view: args.view,
    mode: args.mode,
    allowedCapabilities: args.allowedCapabilities,
    selectionResizable: args.selectionResizable,
  };
}
