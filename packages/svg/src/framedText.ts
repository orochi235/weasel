/**
 * Reading back a text node with a background, which `svgLeafFromKit` writes
 * as a group: its box, its edge, then its text, the whole clipped where the
 * node clips, under a group of its shadow where it casts one.
 */
import type { Paint } from '@weasel-js/core';
import type { SvgKitLeafData } from './fromKit';
import type { SvgDraftBounds, SvgDraftPose } from './draftPose';
import type { SvgGroupNode, SvgPathNode, SvgTextNode } from './types';

/** The attribute marking the `<g>` a text node with a background is written as. */
export const TEXT_FRAME_ATTR = 'data-weasel-text-frame';

/** `{ textFrame: true }` where `el` is such a `<g>`, else `{}`. */
export function textFrameAttrOf(el: Element): { textFrame?: true } {
  return el.tagName.toLowerCase() === 'g' && el.getAttribute(TEXT_FRAME_ATTR) === 'true' ? { textFrame: true } : {};
}

/** A framed text group's parts. */
export interface FramedTextParts {
  /** The group holding the box, the edge and the text: the group itself, or the one after its shadow. */
  framed: SvgGroupNode;
  box: SvgPathNode;
  edge: SvgPathNode | null;
  text: SvgTextNode;
}

/** `g`'s parts where it has the shape `svgLeafFromKit` gives a text node with a background, else `null`: a `<g>`
 *  marked `textFrame` that something has since edited reads as the group it now is. */
export function framedTextParts(g: SvgGroupNode): FramedTextParts | null {
  const [first, second] = g.children;
  const shadowed = g.children.length === 2 && first?.kind === 'group' && second?.kind === 'group' && !g.clip;
  const framed = shadowed ? second : g;
  const kids = framed.children;
  const box = kids[0];
  const text = kids.at(-1);
  const edge = kids.length === 3 ? kids[1] : null;
  if (kids.length < 2 || kids.length > 3 || box?.kind !== 'path' || text?.kind !== 'text') return null;
  if (edge !== null && edge?.kind !== 'path') return null;
  return { framed, box, edge: edge ?? null, text };
}

/**
 * One text leaf's draft from a framed group's parts, the draft its text alone
 * lowers to, its box, and the box's paint: the box's pose, the paint as
 * `background`, the text's inset as `padding`, and `overflow: 'clip'` where
 * the group clips. The edge and the shadow are drawn shapes SVG has no word
 * for, so they are left to a reader of the document's own metadata.
 */
export function framedTextDraft(
  parts: FramedTextParts,
  text: { pose: SvgDraftPose; data: SvgKitLeafData },
  box: SvgDraftBounds,
  paint: Paint | null | undefined,
): { pose: SvgDraftPose; data: SvgKitLeafData } {
  const pose: SvgDraftPose = { ...text.pose, ...box };
  const padding = Math.max(0, Math.min(text.pose.x - box.x, text.pose.y - box.y));
  return {
    pose,
    data: {
      ...text.data,
      background: paint ? { paint } : null,
      ...(padding > 0 ? { padding } : {}),
      ...(parts.framed.clip ? { overflow: 'clip' as const } : {}),
    },
  };
}
