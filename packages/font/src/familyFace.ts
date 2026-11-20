import type { FontStyle } from './fontStyle';

/** The face the within-family chain lands on, and what the shader fakes to close the gap. */
export interface ChainPick {
  key: string;
  weight: number;
  style: FontStyle;
  bold: boolean;
  italic: boolean;
}

interface Face { key: string; weight: number; style: FontStyle }

function weightBucket(w: number): 'regular' | 'bold' {
  return w >= 600 ? 'bold' : 'regular';
}

/** The `style` face nearest `weight`, within its bucket when `inBucket`, ties going to the heavier. */
function nearest(faces: readonly Face[], weight: number, style: FontStyle, inBucket: boolean): Face | null {
  const bucket = weightBucket(weight);
  let best: Face | null = null;
  for (const f of faces) {
    if (f.style !== style || (inBucket && weightBucket(f.weight) !== bucket)) continue;
    const d = Math.abs(f.weight - weight);
    const bestD = best === null ? Infinity : Math.abs(best.weight - weight);
    if (d < bestD || (d === bestD && f.weight > best!.weight)) best = f;
  }
  return best;
}

function parse(keys: Iterable<string>): Face[] {
  const faces: Face[] = [];
  for (const key of keys) {
    const [w, s] = key.split('|') as [string, FontStyle];
    faces.push({ key, weight: Number(w), style: s });
  }
  return faces;
}

function pick(f: Face | null, bold: boolean, italic: boolean): ChainPick | null {
  return f && { key: f.key, weight: f.weight, style: f.style, bold, italic };
}

/**
 * The variant key, among a family's `keys`, that the within-family chain
 * serves `(weight, style)` from: the requested style and the weight's own
 * bucket (600 and up is bold) first, then its 400 and its upright faces,
 * faking the bold or the italic they lack. Null when none of those will do.
 */
export function chainPick(keys: Iterable<string>, weight: number, style: FontStyle): ChainPick | null {
  const faces = parse(keys);
  const at = (w: number, s: FontStyle) => faces.find((f) => f.weight === w && f.style === s) ?? null;
  const slant = style === 'italic';
  return pick(at(weight, style), false, false)
    ?? pick(nearest(faces, weight, style, true), false, false)
    ?? pick(at(400, style), weight >= 600, false)
    ?? pick(at(weight, 'normal'), false, slant)
    ?? pick(nearest(faces, weight, 'normal', true), false, slant)
    ?? pick(at(400, 'normal'), weight >= 600, slant);
}

/**
 * The face a family with any of `keys` falls back to once {@link chainPick},
 * the outline tier and canvas enrollment have all come up empty, so that, as
 * in CSS font matching, a family with a face never draws in another family's:
 * the nearest weight in the requested style, then in the other. An italic face
 * set upright stays italic.
 */
export function farPick(keys: Iterable<string>, weight: number, style: FontStyle): ChainPick | null {
  const faces = parse(keys);
  const other: FontStyle = style === 'italic' ? 'normal' : 'italic';
  const f = nearest(faces, weight, style, false) ?? nearest(faces, weight, other, false);
  return pick(f, f !== null && weight >= 600 && f.weight < 600, style === 'italic' && f?.style === 'normal');
}
