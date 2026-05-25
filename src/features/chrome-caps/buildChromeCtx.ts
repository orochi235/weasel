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

const EMPTY_SUPPRESSED: ReadonlySet<string> = new Set();

export interface BuildChromeCtxArgs {
  focused: boolean;
  selection: readonly NodeId[];
  multiActive: boolean;
  modifiers: ModifierState;
  action: { kind: string | null; id: string | null };
  hover: NodeId | null;
  view: View;
  suppressedIds?: ReadonlySet<string>;
}

export function buildChromeCtx(args: BuildChromeCtxArgs): ChromeCtx {
  return {
    focused: args.focused,
    selection: args.selection,
    multiActive: args.multiActive,
    modifiers: args.modifiers,
    action: args.action,
    hover: args.hover,
    view: args.view,
    suppressedIds: args.suppressedIds ?? EMPTY_SUPPRESSED,
  };
}
