import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';
import { IMPLICIT_TAGS, NORMAL, type CapabilityTag } from '@weasel-js/modes';

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
  /** Whether a path is currently in anchor-edit mode. Read by the
   *  `editingAnchors:` selector, which gates the path-edit chrome.
   *
   *  This is deliberately a fact about state, not about permission: the
   *  anchor overlay and the anchor hit-test must agree, and the thing they
   *  must agree on is "is there an edited path right now", which no
   *  capability or mode id answers. A mode that allows `edits-anchors`
   *  with nothing being edited should draw no anchors. Absent is treated
   *  as false. */
  readonly editingAnchors?: boolean;
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
  /** Optional — omitted means "no path is being anchor-edited". */
  editingAnchors?: boolean;
}

/**
 * Capability set to assume when no mode registry is wired.
 *
 * "No modes configured" means *everything the default mode permits*, not
 * *nothing permitted*. The empty set is the wrong default: it makes every
 * `capability:` rule evaluate false, so a kit default written the
 * recommended way (capability rules outlive new modes; mode rules have to
 * be edited) would silently hide its chrome for every consumer that hasn't
 * opted into modality. `NORMAL.allows` plus the implicit tags is what a
 * mode-less canvas actually behaves like.
 */
export const DEFAULT_ALLOWED_CAPABILITIES: ReadonlySet<CapabilityTag> = new Set<CapabilityTag>([
  ...NORMAL.allows,
  ...IMPLICIT_TAGS,
]);

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
    editingAnchors: args.editingAnchors,
  };
}
