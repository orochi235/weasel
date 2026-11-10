/**
 * Where the edit overlay sits, every frame: over the node's text box, in its
 * face and size, aligned as the canvas aligns it. A node that clips its text
 * gets a box of its own that scrolls the overlay inside it.
 */
import { numericWeight, scriptMetricsFor, verticalAlignOffset, type ResolvedTextStyle } from '@weasel-js/text';
import { ZOOM_PROPERTY } from './domRuns';
import { baselineDrop } from './overlayBaseline';
import { overlayAlignEdge } from './overlayDirection';
import { applyOverlayTransform, overlayTop, overlayTransform } from './overlayFrame';
import { overlayScroll, type OverlayScroll } from './overlayScroll';
import type { TextEditClipRect, TextEditScreenPose } from './textEditTypes';

/** The overlay's two parents: the box `getClipRect` names, and inside it the
 *  box a clipping node scrolls its text in. */
export interface OverlayBoxes {
  clip: HTMLDivElement;
  scroll: HTMLDivElement;
  scroller: OverlayScroll;
  /** Take the boxes, the overlay with them, out of the container. */
  remove(): void;
}

/** Put `overlay` in its parents, in `container`. Both pass pointer input
 *  through, except where a clipping node's box scrolls. */
export function mountOverlayBoxes(container: HTMLElement, overlay: HTMLElement): OverlayBoxes {
  const clip = bareBox();
  const scroll = bareBox();
  clip.appendChild(scroll);
  scroll.appendChild(overlay);
  container.appendChild(clip);
  const scroller = overlayScroll(scroll, overlay);
  return {
    clip, scroll, scroller,
    remove() {
      scroller.dispose();
      clip.remove();
    },
  };
}

function bareBox(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.margin = '0';
  el.style.padding = '0';
  el.style.border = '0';
  el.style.pointerEvents = 'none';
  return el;
}

const ALIGN_ANCHOR = { left: 0, center: 0.5, right: 1 } as const;

/** What both ways of placing the overlay share: its size of type. */
interface Type {
  lineHeight: number;
  /** How far a node-level script raises the line, in pre-scale pixels. */
  shift: number;
}

export function placeOverlay(
  el: HTMLDivElement,
  boxes: OverlayBoxes,
  pose: TextEditScreenPose | null,
  clip: TextEditClipRect | null,
  style: ResolvedTextStyle,
): void {
  if (!pose) {
    el.style.display = 'none';
    return;
  }
  // `clip` rather than `hidden`: a `hidden` box is still scrollable, and the
  // browser scrolls it to keep the caret in view.
  const c = boxes.clip.style;
  c.overflow = clip ? 'clip' : 'visible';
  c.left = `${clip?.x ?? 0}px`;
  c.top = `${clip?.y ?? 0}px`;
  c.width = `${clip?.width ?? 0}px`;
  c.height = `${clip?.height ?? 0}px`;
  el.style.display = '';
  const type = typeset(el, style, pose);
  const origin = { x: clip?.x ?? 0, y: clip?.y ?? 0 };
  if (pose.clip) placeScrolled(el, boxes.scroll, pose, pose.clip, origin, style, type, boxes.scroller);
  else placeLoose(el, boxes.scroll, pose, origin, style, type, boxes.scroller);
}

/** Set the overlay's font size, line height, and letter spacing for `pose`. */
function typeset(el: HTMLDivElement, style: ResolvedTextStyle, pose: TextEditScreenPose): Type {
  // A node-level script draws the glyphs smaller and raised on the line the
  // plain text would hold, so the line height is pinned in pixels of the
  // unscripted size rather than left to scale with the font.
  const script = style.script
    ? scriptMetricsFor(style.fontFamily, numericWeight(style.fontWeight), style.fontStyle)[style.script]
    : undefined;
  const lineHeight = pose.lineHeight ?? style.lineHeight;
  el.style.fontSize = `${pose.fontSize * (script?.size ?? 1)}px`;
  el.style.lineHeight = script ? `${pose.fontSize * lineHeight}px` : String(lineHeight);
  // `letter-spacing` is not part of the CSS `font` shorthand. Under a
  // transform the world value is the value. Without one, `pose.fontSize` is
  // `style.fontSize * zoom`, so their ratio is the world→screen factor; run
  // overrides, which `runsToDom` writes in world units, then stay unscaled,
  // so that path is only correct at zoom 1.
  const scale =
    pose.zoom !== undefined ? 1 : style.fontSize > 0 ? pose.fontSize / style.fontSize : 1;
  el.style.letterSpacing = `${style.letterSpacing * scale}px`;
  return { lineHeight, shift: (script?.shift ?? 0) * pose.fontSize };
}

/** A node whose text may run past its box: the overlay carries the view's
 *  transform itself, and nothing but `getClipRect` cuts it. */
function placeLoose(
  el: HTMLDivElement,
  box: HTMLDivElement,
  pose: TextEditScreenPose,
  origin: { x: number; y: number },
  style: ResolvedTextStyle,
  type: Type,
  scroll: OverlayScroll,
): void {
  scroll.reset();
  Object.assign(box.style, {
    left: '0', top: '0', width: '0', height: '0', overflow: 'visible', transform: '', pointerEvents: 'none',
  });
  el.style.padding = '0';
  // An unwrapped line can be wider than its box, and the canvas aligns it
  // about the box's left edge, center, or right edge regardless. `left` puts
  // that anchor there and a trailing translate pulls the overlay back by that
  // fraction of its own width.
  const anchor = style.wrap ? 0 : ALIGN_ANCHOR[overlayAlignEdge(el, style)];
  const left = pose.x + pose.width * (pose.zoom ?? 1) * anchor;
  el.style.left = `${left - origin.x}px`;
  el.style.width = style.wrap ? `${pose.width}px` : 'max-content';
  el.style.minWidth = style.wrap ? '' : `${pose.width}px`;
  // A top-aligned overlay fills its box, so a click anywhere in it lands in
  // the editor. Any other alignment needs the content's own height, which a
  // min-height would mask; `offsetHeight` is pre-transform, in pose units.
  const aligned = isAligned(pose);
  el.style.minHeight = aligned ? '' : `${pose.height}px`;
  const drop = baselineDrop(el, style, pose, type.lineHeight) - type.shift;
  const top = overlayTop(pose, aligned ? el.offsetHeight : pose.height, drop);
  el.style.top = `${top - origin.y}px`;
  // A declared `zoom` means every size on the pose is pre-scale and the
  // overlay carries the view scale as a transform. Anchored at the top-left so
  // `left`/`top` stay screen pixels.
  el.style.transformOrigin = '0 0';
  applyOverlayTransform(el, pose, left, top, anchor);
}

/**
 * A node that clips its text at its box: the box, `pose` grown by `inset`,
 * scrolls, and carries the view's transform, so it stays over the node's
 * paper while the text moves inside it. The overlay fills the box at least,
 * so a press anywhere in it edits, with the inset as its padding.
 *
 * Text that overflows is set from the box's top left, so all of it can be
 * scrolled to, and the box rests scrolled to where the canvas's alignment
 * puts it: a bottom-aligned note opens on its last line.
 */
function placeScrolled(
  el: HTMLDivElement,
  box: HTMLDivElement,
  pose: TextEditScreenPose,
  inset: NonNullable<TextEditScreenPose['clip']>,
  origin: { x: number; y: number },
  style: ResolvedTextStyle,
  type: Type,
  scroll: OverlayScroll,
): void {
  const zoom = pose.zoom ?? 1;
  const width = inset.left + pose.width + inset.right;
  const height = inset.top + pose.height + inset.bottom;
  const left = pose.x - inset.left * zoom;
  const top = pose.y - inset.top * zoom;
  Object.assign(box.style, {
    left: `${left - origin.x}px`, top: `${top - origin.y}px`, width: `${width}px`, height: `${height}px`,
    overflow: 'auto', overscrollBehavior: 'contain', direction: 'ltr',
    pointerEvents: 'auto', transformOrigin: '0 0', transform: overlayTransform(pose, left, top, 0),
  });
  // A scroll bar would take its width from the text's and wrap it short of the canvas's lines.
  box.style.setProperty('scrollbar-width', 'none');
  // Scroll anchoring would read a reflow, such as the face arriving, as a scroll to keep.
  box.style.setProperty('overflow-anchor', 'none');
  Object.assign(el.style, {
    left: '0', transform: 'none', transformOrigin: '', padding: '0', minHeight: '', minWidth: '',
    width: style.wrap ? `${pose.width}px` : 'max-content',
  });
  el.style.setProperty(ZOOM_PROPERTY, String(pose.pxScale ?? zoom));
  // Lines are aligned across the wider of the box and the longest unwrapped line.
  const line = style.wrap ? pose.width : Math.max(el.offsetWidth, pose.width);
  const anchor = style.wrap ? 0 : ALIGN_ANCHOR[overlayAlignEdge(el, style)];
  el.style.width = `${line}px`;
  const slack = verticalAlignOffset(pose.verticalAlign, pose.height, isAligned(pose) ? el.offsetHeight : pose.height);
  const drop = baselineDrop(el, style, pose, type.lineHeight) - type.shift;
  Object.assign(el.style, {
    width: `${inset.left + line + inset.right}px`,
    paddingLeft: `${inset.left}px`, paddingRight: `${inset.right}px`,
    paddingTop: `${inset.top + Math.max(slack, 0)}px`, paddingBottom: `${inset.bottom}px`,
    top: `${drop}px`, minHeight: `${height - drop}px`,
  });
  scroll.rebase(anchor * (line - pose.width), Math.max(-slack, 0), {
    width, height, inset, zoom, frame: pose.frame, lineHeight: pose.fontSize * type.lineHeight,
  });
}

function isAligned(pose: TextEditScreenPose): boolean {
  return pose.verticalAlign !== undefined && pose.verticalAlign !== 'top';
}
