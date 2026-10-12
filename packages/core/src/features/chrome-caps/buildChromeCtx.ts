/**
 * Pure assembler for {@link ChromeCtx}. Sources are passed as plain values
 * rather than the live objects they come from, which keeps `chrome-caps`
 * from depending on React or the dispatcher's concrete type.
 */

import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';
import type { ChromeCtx } from './types';

/** The pieces of live canvas state a `ChromeCtx` is assembled from. */
export interface BuildChromeCtxArgs {
  focused: boolean;
  selection: readonly NodeId[];
  multiActive: boolean;
  modifiers: ModifierState;
  action: { kind: string | null; id: string | null };
  hover: NodeId | null;
  view: View;
}

/** Gather the current canvas state into the context that chrome-visibility
 *  rules are evaluated against. Rebuilt per frame. */
export function buildChromeCtx(args: BuildChromeCtxArgs): ChromeCtx {
  return {
    focused: args.focused,
    selection: args.selection,
    multiActive: args.multiActive,
    modifiers: args.modifiers,
    action: args.action,
    hover: args.hover,
    view: args.view,
  };
}
