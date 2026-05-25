/**
 * Pure assembler for {@link ChromeCtx}.
 *
 * Called once per frame on the rendering side from whichever surface
 * needs to evaluate visibility rules — `composeAffordanceLayer`,
 * `createSelectionOverlayLayer`, the dispatcher overlay layer, etc.
 *
 * Sources are passed as plain getters / values rather than the live
 * objects they come from. This keeps `chrome-caps` from depending on
 * React, the dispatcher's concrete type, or `ChromeState`'s bounds
 * machinery — the same builder works from a test harness, a Storybook
 * fixture, or `<SceneCanvas>`.
 */

import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';
import type { ChromeCtx } from './types';

export interface BuildChromeCtxArgs {
  focused: boolean;
  selection: readonly NodeId[];
  multiActive: boolean;
  modifiers: ModifierState;
  action: { kind: string | null; id: string | null };
  hover: NodeId | null;
  view: View;
  /**
   * @deprecated Removed from ChromeCtx in Phase 2 of the mode-aware
   * dispatch refactor. Accepted here for backward-compat during the
   * migration; carried on the returned ctx via a non-typed property
   * that the deprecated `suppressed(id)` atom reads via cast.
   */
  suppressedIds?: ReadonlySet<string>;
}

export function buildChromeCtx(args: BuildChromeCtxArgs): ChromeCtx {
  const ctx: ChromeCtx & { suppressedIds?: ReadonlySet<string> } = {
    focused: args.focused,
    selection: args.selection,
    multiActive: args.multiActive,
    modifiers: args.modifiers,
    action: args.action,
    hover: args.hover,
    view: args.view,
  };
  if (args.suppressedIds) ctx.suppressedIds = args.suppressedIds;
  return ctx;
}
