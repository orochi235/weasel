/**
 * The edit overlay's reading direction and alignment, set so the browser
 * resolves both the way `layoutRuns` does for the canvas.
 */
import { paragraphDirection, resolveAlign, type ResolvedTextStyle } from '@weasel-js/text';

/**
 * A stated direction goes on the overlay as CSS `direction`. `auto` becomes
 * `unicode-bidi: plaintext`, CSS's spelling of "each paragraph reads the way
 * its first strong character does", under which `start` and `end` follow each
 * paragraph too, so those are left for the browser to resolve.
 */
export function applyOverlayDirection(el: HTMLElement, style: ResolvedTextStyle): void {
  const auto = style.direction === 'auto';
  el.style.direction = auto ? '' : style.direction;
  el.style.setProperty('unicode-bidi', auto ? 'plaintext' : '');
  const justify = style.align === 'justify';
  const edge = style.direction === 'auto'
    ? (justify ? 'start' : style.align)
    : resolveAlign(style.align, style.direction);
  el.style.textAlign = justify ? 'justify' : edge;
  // Pinned, so a justified paragraph's last line sits where the canvas puts it.
  el.style.setProperty('text-align-last', justify ? edge : '');
}

/** The absolute edge the overlay's text is set from, by its first paragraph. */
export function overlayAlignEdge(el: HTMLElement, style: ResolvedTextStyle): 'left' | 'center' | 'right' {
  return resolveAlign(style.align, paragraphDirection(el.textContent ?? '', style.direction));
}
