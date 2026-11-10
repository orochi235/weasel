/**
 * The scroll of an overlay whose node clips its text at the box: the box is a
 * scroll container, and this keeps its offset where the canvas would show the
 * text, and brings the caret into view after the user moves it.
 */
import type { TextEditScreenPose } from './textEditTypes';

/** What a reveal needs of the placed box, all pre-scale. */
export interface ScrollFrame {
  width: number;
  height: number;
  inset: NonNullable<TextEditScreenPose['clip']>;
  zoom: number;
  frame?: TextEditScreenPose['frame'];
  /** The height of a line, which the caret's must fit in the box. */
  lineHeight: number;
}

export interface OverlayScroll {
  /**
   * Where the canvas would show the text: `(x, y)` scrolled into the box.
   * The user's own scroll is kept as an offset from it, so a center- or
   * bottom-aligned text that grows moves as the canvas would move it.
   */
  rebase(x: number, y: number, frame: ScrollFrame): void;
  /** The box no longer scrolls: back to the top left. */
  reset(): void;
  /** Bring the caret into the box, if a key, a press, or an edit has moved
   *  it since the edit opened. Run on every selection change, and after an
   *  edit re-places the overlay. */
  reveal(): void;
  /** Focus the overlay, where focusing would scroll its box to the start. */
  focus(): void;
  dispose(): void;
}

export function overlayScroll(box: HTMLElement, overlay: HTMLElement): OverlayScroll {
  let frame: ScrollFrame | null = null;
  let base = { x: 0, y: 0 };
  let offset = { x: 0, y: 0 };
  // Until the user touches the text, it stays where the canvas showed it: the
  // caret it opens with is not a reason to move it, and Chromium scrolls a
  // freshly focused box by itself.
  let armed = false;
  const arm = () => { armed = true; };
  const read = () => { offset = { x: box.scrollLeft - base.x, y: box.scrollTop - base.y }; };
  const onScroll = () => {
    if (!frame) return;
    if (armed) return read();
    box.scrollLeft = base.x + offset.x;
    box.scrollTop = base.y + offset.y;
  };
  box.addEventListener('scroll', onScroll);
  box.addEventListener('wheel', arm, { passive: true });
  for (const type of ['keydown', 'pointerdown', 'beforeinput']) overlay.addEventListener(type, arm);

  const api: OverlayScroll = {
    rebase(x, y, next) {
      const moved = !frame || x !== base.x || y !== base.y;
      frame = next;
      if (!moved) return;
      base = { x, y };
      box.scrollLeft = x + offset.x;
      box.scrollTop = y + offset.y;
      read();
    },
    reset() {
      frame = null;
      base = { x: 0, y: 0 };
      offset = { x: 0, y: 0 };
      if (box.scrollLeft !== 0) box.scrollLeft = 0;
      if (box.scrollTop !== 0) box.scrollTop = 0;
    },
    reveal() {
      if (!frame || !armed) return;
      const at = caretInBox(box, overlay, frame);
      if (!at) return;
      const { width, height, inset, lineHeight } = frame;
      const top = at.y - lineHeight / 2, bottom = at.y + lineHeight / 2;
      // A caret already in the box stays put; one outside it comes in as far
      // as the text's own inset, so it does not sit on the edge.
      if (top < 0) box.scrollTop -= inset.top - top;
      else if (bottom > height) box.scrollTop += bottom - (height - inset.bottom);
      if (at.x < 0) box.scrollLeft -= inset.left - at.x;
      else if (at.x > width) box.scrollLeft += at.x - (width - inset.right);
      read();
    },
    focus() {
      const { scrollLeft, scrollTop } = box;
      overlay.focus();
      box.scrollLeft = scrollLeft;
      box.scrollTop = scrollTop;
    },
    dispose() {
      box.removeEventListener('scroll', onScroll);
      box.removeEventListener('wheel', arm);
      document.removeEventListener('selectionchange', reveal);
      for (const type of ['keydown', 'pointerdown', 'beforeinput']) overlay.removeEventListener(type, arm);
    },
  };
  const reveal = () => api.reveal();
  document.addEventListener('selectionchange', reveal);
  return api;
}

/**
 * The selection's focus, in the box's own pre-transform pixels from its
 * visible corner, or `null` when it is not in the overlay or has no box.
 * Taken through the centers of both rects, which a turned frame keeps.
 */
function caretInBox(box: HTMLElement, overlay: HTMLElement, f: ScrollFrame): { x: number; y: number } | null {
  const sel = window.getSelection();
  const node = sel?.focusNode;
  if (!sel || !node || !overlay.contains(node)) return null;
  const r = caretRect(node, sel.focusOffset);
  const b = box.getBoundingClientRect();
  if (!r || (b.width === 0 && b.height === 0)) return null;
  const dx = r.left + r.width / 2 - (b.left + b.width / 2);
  const dy = r.top + r.height / 2 - (b.top + b.height / 2);
  const [a, bb, c, d] = f.frame ?? [1, 0, 0, 1];
  const det = (a * d - bb * c) * f.zoom;
  if (det === 0) return null;
  return {
    x: f.width / 2 + (d * dx - c * dy) / det,
    y: f.height / 2 + (a * dy - bb * dx) / det,
  };
}

/** The rect of a collapsed range at `(node, offset)`; at an empty line, where
 *  that has none, the box of the element there. */
function caretRect(node: Node, offset: number): DOMRect | null {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const own = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
  if (own && (own.width > 0 || own.height > 0)) return own;
  if (!(node instanceof Element)) return null;
  const at = node.childNodes[offset] ?? node.childNodes[offset - 1] ?? node;
  const r = (at instanceof Element ? at : node).getBoundingClientRect();
  return r && (r.width > 0 || r.height > 0) ? r : null;
}
