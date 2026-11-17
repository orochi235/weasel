/** What an edit opening sets up besides the overlay itself: the face loads it waits on, the selection it opens
 *  with, and its `::selection` colors. */
import type { ResolvedTextStyle, StyledRun } from '@weasel-js/text';
import { resolveRunFace } from '@weasel-js/text';
import { cssFontFamilyLoading } from '@weasel-js/font';
import { parsesAsColor } from '@weasel-js/paint';
import { charOffsetToDomPosition } from './domRuns';

/**
 * The loads the overlay's faces are still waiting on — the node's and each
 * run's, a bold or italic run in the node's family included — or `null` when
 * every one is in hand.
 */
export function holdForFaces(style: ResolvedTextStyle, runs: readonly StyledRun[]): Promise<unknown> | null {
  const faces = new Map<string, ReturnType<typeof resolveRunFace>>();
  for (const r of [{ text: '' }, ...runs]) {
    const face = resolveRunFace(r, style);
    faces.set(`${face.fontFamily}|${face.fontWeight}|${face.fontStyle}`, face);
  }
  const pending = [...faces.values()]
    .map((f) => cssFontFamilyLoading(f.fontFamily, f.fontWeight, f.fontStyle))
    .filter((p) => p !== null);
  return pending.length === 0 ? null : Promise.all(pending);
}

/** The selection an edit opens with: the whole text, or a caret `caret`
 *  characters in, clamped to the end. */
export function openingRange(overlay: HTMLElement, caret: number | 'all'): Range {
  const range = document.createRange();
  if (caret === 'all') {
    range.selectNodeContents(overlay);
    return range;
  }
  const at = charOffsetToDomPosition(overlay, caret);
  if (at) range.setStart(at.node, at.offset);
  range.collapse(true);
  return range;
}

/**
 * Inject a `<style>` element scoped to `overlayClass` so the edit overlay's
 * `::selection` matches the configured colors, or `null` when none are set.
 * A value that is not a CSS color is left out with a warning: it comes from
 * stored document data and is written into a page-wide stylesheet.
 */
export function installSelectionStyle(
  overlayClass: string,
  style: ResolvedTextStyle,
): HTMLStyleElement | null {
  const decls: string[] = [];
  const background = selectionColorOf('selectionBackground', style.selectionBackground);
  if (background !== null) decls.push(`background: ${background};`);
  const color = selectionColorOf('selectionColor', style.selectionColor);
  if (color !== null) decls.push(`color: ${color};`);
  if (decls.length === 0) return null;
  const el = document.createElement('style');
  el.textContent = `.${overlayClass}::selection { ${decls.join(' ')} }`;
  document.head.appendChild(el);
  return el;
}

function selectionColorOf(key: string, value: string | null | undefined): string | null {
  if (value == null) return null;
  if (parsesAsColor(value)) return value;
  console.warn(`weasel text edit: ${key} ${JSON.stringify(value)} is not a CSS color, so the selection does not use it`);
  return null;
}
