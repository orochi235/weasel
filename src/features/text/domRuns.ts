/**
 * Pure DOM ↔ `StyledRun[]` serializers for the contenteditable overlay
 * used by `useTextEdit`. The overlay's children are a flat sequence of
 * `<span data-run>` elements, each carrying one run's text and inline
 * styles. Newlines inside a run are literal `\n` characters; the overlay
 * has `white-space: pre-wrap` so they render as line breaks.
 */

import type { Paint } from 'core/paint-types';
import type { StyledRun } from './runs';

function solidColor(p: Paint | undefined): string | null {
  if (!p) return null;
  if ('color' in p) return p.color;
  return null;
}

/** Build a flat sequence of `<span data-run>` children from `runs`, replacing any existing children of `parent`. */
export function runsToDom(runs: readonly StyledRun[], parent: HTMLElement): void {
  parent.replaceChildren();
  for (const run of runs) {
    const span = document.createElement('span');
    span.setAttribute('data-run', '');
    span.textContent = run.text;
    if (run.bold) span.style.fontWeight = '700';
    if (run.italic) span.style.fontStyle = 'italic';
    if (run.fontSize != null) span.style.fontSize = `${run.fontSize}px`;
    if (run.fontFamily != null) span.style.fontFamily = run.fontFamily;
    const color = solidColor(run.fill);
    if (color != null) span.style.color = color;
    parent.appendChild(span);
  }
}
