/**
 * Character offsets in the edit overlay's DOM, counted the way `domToRuns`
 * reads its text: every text node's characters, plus one newline for each
 * break element a browser or a paste can leave behind.
 */

/** One stretch of the overlay's text, in document order. */
export type OverlayPiece =
  | { text: Text }
  /** A newline with no text node of its own: a `<br>`, or the boundary a block opens. */
  | { br: Element }
  | { block: Element };

/** Elements whose boundary reads as a newline. */
export const BLOCK_TAGS: ReadonlySet<string> = new Set(['DIV', 'P']);

/**
 * `parent`'s text as pieces. A block (`<div>`, `<p>`) reads as a newline
 * before its contents unless it opens the text, which is how a browser renders
 * the boundary. `domToRuns` and both offset walkers below read through here,
 * so a caret offset and the committed text cannot count a break differently.
 */
export function overlayPieces(parent: Element): OverlayPiece[] {
  const out: OverlayPiece[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node as Text).data.length > 0) out.push({ text: node as Text });
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.tagName === 'BR') { out.push({ br: node }); return; }
    if (BLOCK_TAGS.has(node.tagName) && out.length > 0) out.push({ block: node });
    for (const child of node.childNodes) visit(child);
  };
  for (const child of parent.childNodes) visit(child);
  return out;
}

const indexIn = (el: Element): number => Array.prototype.indexOf.call(el.parentNode!.childNodes, el);

/** The DOM position just past a break piece, where the next character goes. */
function afterBreak(piece: { br: Element } | { block: Element }): { node: Node; offset: number } {
  return 'br' in piece
    ? { node: piece.br.parentNode!, offset: indexIn(piece.br) + 1 }
    : { node: piece.block, offset: 0 };
}

/**
 * The DOM position of plain-text character position `offset`: a text node
 * and an offset into it wherever one holds the position, otherwise an element
 * and a child index (just past a `<br>` that ends the text). Offsets beyond
 * the text clamp to its end. Returns `{ node: parent, offset: 0 }` for an
 * overlay with no text.
 */
export function charOffsetToDomPosition(
  parent: HTMLElement,
  offset: number,
): { node: Node; offset: number } | null {
  let remaining = offset;
  let end: { node: Node; offset: number } = { node: parent, offset: 0 };
  /** Set while the position sits just past a break, with no text met since. */
  let pending: { node: Node; offset: number } | null = null;
  for (const piece of overlayPieces(parent)) {
    if ('text' in piece) {
      const len = piece.text.data.length;
      if (remaining <= len) return { node: piece.text, offset: remaining };
      remaining -= len;
      end = { node: piece.text, offset: len };
      pending = null;
      continue;
    }
    if (remaining === 0) {
      return pending ?? ('br' in piece
        ? { node: piece.br.parentNode!, offset: indexIn(piece.br) }
        : afterBreak(piece));
    }
    remaining -= 1;
    end = afterBreak(piece);
    pending = remaining === 0 ? end : null;
  }
  return end;
}

/**
 * Inverse of `charOffsetToDomPosition`: the characters that precede the DOM
 * position `(node, offset)`.
 *
 * When `node` is an element the DOM offset indexes *child nodes*, not
 * characters — `(overlay, 0)` is the start of the text and `(overlay,
 * childNodes.length)` its end. That shape is not exotic: `Range.
 * selectNodeContents`, which `useTextEdit` uses for its select-all caret,
 * produces exactly it. So an element position is resolved by counting the
 * pieces that end at or before the boundary point.
 */
export function domPositionToCharOffset(
  parent: HTMLElement,
  node: Node,
  offset: number,
): number {
  const pieces = overlayPieces(parent);
  let total = 0;
  if (node.nodeType === Node.TEXT_NODE) {
    for (const piece of pieces) {
      if (!('text' in piece)) { total += 1; continue; }
      if (piece.text === node) return total + offset;
      total += piece.text.data.length;
    }
    return total;
  }
  const point = document.createRange();
  point.setStart(node, Math.max(0, Math.min(offset, node.childNodes.length)));
  point.collapse(true);
  for (const piece of pieces) {
    if ('text' in piece) {
      // A text node cannot contain the point, so it is wholly before or after.
      if (point.comparePoint(piece.text, 0) < 0) total += piece.text.data.length;
    } else {
      const past = afterBreak(piece);
      if (point.comparePoint(past.node, past.offset) <= 0) total += 1;
    }
  }
  return total;
}
