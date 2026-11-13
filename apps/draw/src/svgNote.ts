/**
 * A note in a file: a text node with a background, as the sticky tool makes one. `@weasel-js/svg` writes its paper,
 * padding and clip as SVG and reads them back; what SVG has no word for rides on its group's `wd:` attributes:
 * `edge` (width and shade), `shadow` (x, y, blur, alpha), and `min-size` (width and height), each a list of numbers.
 */
import type { TextFrameData } from './drawDocument';

const FRAME_KEYS = ['background', 'padding', 'overflow', 'edge', 'shadow', 'minSize'] as const;

/** The note fields `from` sets, and only those. */
export function textFrameFields(from: TextFrameData): TextFrameData {
  const out: Record<string, unknown> = {};
  for (const key of FRAME_KEYS) if (from[key] !== undefined) out[key] = from[key];
  return out as TextFrameData;
}

const numbers = (raw: string | undefined, count: number): number[] | null => {
  const parts = raw?.trim().split(/\s+/).map(Number);
  return parts && parts.length === count && parts.every(Number.isFinite) ? parts : null;
};

/** The `wd:` attributes carrying a note's edge, shadow and minimum size. */
export function encodeNoteAttrs(o: TextFrameData): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (o.edge) attrs.edge = `${o.edge.width} ${o.edge.shade}`;
  if (o.shadow) attrs.shadow = `${o.shadow.x} ${o.shadow.y} ${o.shadow.blur} ${o.shadow.alpha}`;
  if (o.minSize) attrs['min-size'] = `${o.minSize.width} ${o.minSize.height}`;
  return attrs;
}

/** The edge, shadow and minimum size `attrs` carry; a malformed one is left out. */
export function decodeNoteAttrs(attrs: Record<string, string> | undefined): Pick<TextFrameData, 'edge' | 'shadow' | 'minSize'> {
  const edge = numbers(attrs?.edge, 2);
  const shadow = numbers(attrs?.shadow, 4);
  const min = numbers(attrs?.['min-size'], 2);
  return {
    ...(edge ? { edge: { width: edge[0]!, shade: edge[1]! } } : {}),
    ...(shadow ? { shadow: { x: shadow[0]!, y: shadow[1]!, blur: shadow[2]!, alpha: shadow[3]! } } : {}),
    ...(min ? { minSize: { width: min[0]!, height: min[1]! } } : {}),
  };
}
