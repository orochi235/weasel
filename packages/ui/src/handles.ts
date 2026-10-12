import { tokenPx } from '@weasel-js/theme';
import type { ResolvedTheme } from '@weasel-js/theme';

/**
 * The handle sizes the theme publishes. For a diamond's edge: the default rank,
 * the inert one a locked or pinned point wears, and the emphasized one for a
 * handle that is its own category. For a round handle's diameter: an anchor's,
 * and the smaller one a control handle wears.
 */
export const HANDLE_SIZE_TOKENS = [
  '--wzl-handle-size', '--wzl-handle-size-sm', '--wzl-handle-size-lg',
  '--wzl-handle-dot-size', '--wzl-handle-dot-size-sm',
] as const;

/** One of {@link HANDLE_SIZE_TOKENS}. */
export type HandleSizeToken = (typeof HANDLE_SIZE_TOKENS)[number];

/**
 * A handle's edge or diameter in px, for code that draws a handle instead of styling one.
 *
 * CSS reaches `--wzl-handle-*` directly; SVG geometry attributes and canvas
 * cannot, so they come through here and the number stays written once, in the
 * theme definition.
 */
export function handleSize(token: HandleSizeToken, resolved?: ResolvedTheme): number {
  return tokenPx(token, resolved);
}

/** Half a handle's size — what an SVG rect centered on a point offsets by, and a circle's radius. */
export function handleHalf(token: HandleSizeToken, resolved?: ResolvedTheme): number {
  return handleSize(token, resolved) / 2;
}
