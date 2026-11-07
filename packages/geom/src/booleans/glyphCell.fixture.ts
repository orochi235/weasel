/** Glyph outlines from the repo's Inter subset, overlaid in one cell the way a segment display cuts them. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'opentype.js';
import type { Path } from '../path';
import { pathFromD } from '../paths/pathFromD';
import { transformPath } from '../paths/transformPath';
import { boundsOfPath } from '../paths/bounds';

const INTER = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

export const DIGITS = '0123456789';
export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const ASCII = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)).join('');

/**
 * Each glyph of `chars` scaled to fill a cell `height` tall (less a margin)
 * and centered across it, its curves as the font drew them.
 */
export function glyphCell(chars: string, height = 100): Path[] {
  const bytes = readFileSync(INTER);
  const font = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const pad = height * 0.04, inner = height - 2 * pad;
  const out: Path[] = [];
  for (const ch of chars) {
    const path = pathFromD(font.charToGlyph(ch).getPath(0, 0, 1).toPathData(5));
    const b = boundsOfPath(path);
    if (b.width <= 0 || b.height <= 0) continue;
    const s = inner / b.height;
    const sx = Math.min(s, inner / b.width);
    out.push(transformPath(path, [sx, 0, 0, s, pad + (inner - b.width * sx) / 2 - b.x * sx, pad - b.y * s]));
  }
  return out;
}
