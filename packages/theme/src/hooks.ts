/**
 * Consumer override hooks: custom properties kit CSS reads with a fallback and
 * **the built-in theme does not declare**. Setting one on any container
 * restyles the components below it; leaving it unset takes the fallback. A
 * theme built with `defineTheme` may pin one, and a container below it still
 * overrides the pin.
 *
 * They stay out of `tokens.css` on purpose: a `:root` declaration would win
 * over the in-CSS fallback, so the two would have to agree forever. Adding a
 * hook means adding it to its family in `hooks/`; `scripts/check-token-reads.ts`
 * reads the joined list.
 */

import { FRAME_HOOKS } from './hooks/frame.ts';
import { CONTROL_HOOKS } from './hooks/controls.ts';
import { PANEL_HOOKS } from './hooks/panels.ts';

/** One override hook, as the manifest describes it. */
export interface TokenHook {
  /** Without the `--wzl-` prefix, matching a token's name in a definition. */
  readonly name: string;
  /** DTCG type. */
  readonly type: string;
  /** The fallback every read of it carries — the value in force when nothing
   *  sets it. */
  readonly value: string;
  readonly description: string;
}

export const TOKEN_HOOKS: readonly TokenHook[] = [...FRAME_HOOKS, ...CONTROL_HOOKS, ...PANEL_HOOKS];
