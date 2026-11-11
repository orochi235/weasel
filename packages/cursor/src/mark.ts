import { tokenizePathData, trimNumber } from '@weasel-js/geom';
import type { CursorGlyph, CursorMark, CursorPath } from './types';

/**
 * Path data scaled by `k` and moved by `(dx, dy)`, to two decimals. Reads the authored dialect, absolute `M`, `L`,
 * `A` and `Z`, and throws on anything else rather than misplace it, and a `RangeError` for a coordinate that lands
 * past the double range or is not a number.
 */
export function placeCursorPath(d: string, k: number, dx: number, dy: number): string {
  const r2 = (v: number): string => {
    if (!Number.isFinite(v)) throw new RangeError(`placeCursorPath: scaled by ${k} and moved by ${dx}, ${dy}, a coordinate of ${d} is ${v}`);
    return trimNumber(v, 2);
  };
  const out: string[] = [];
  for (const { cmd, args: nums } of tokenizePathData(d)) {
    const arity = cmd === 'M' || cmd === 'L' ? 2 : cmd === 'A' ? 7 : 0;
    if (arity > 0 && (nums.length === 0 || nums.length % arity !== 0)) {
      throw new Error(`cursor path '${cmd}' has ${nums.length} numbers, which placeCursorPath cannot read as whole points: ${d}`);
    }
    if (cmd === 'Z') { out.push('Z'); continue; }
    if (cmd === 'M' || cmd === 'L') {
      const pts: string[] = [];
      for (let i = 0; i + 2 <= nums.length; i += 2) pts.push(`${r2(nums[i]! * k + dx)} ${r2(nums[i + 1]! * k + dy)}`);
      out.push(`${cmd} ${pts.join(' ')}`);
      continue;
    }
    if (cmd === 'A') {
      const arcs: string[] = [];
      for (let i = 0; i + 7 <= nums.length; i += 7) {
        const [rx, ry, rot, large, sweep, x, y] = nums.slice(i, i + 7) as [number, number, number, number, number, number, number];
        arcs.push(`${r2(rx * k)} ${r2(ry * k)} ${rot} ${large} ${sweep} ${r2(x * k + dx)} ${r2(y * k + dy)}`);
      }
      out.push(`A ${arcs.join(' ')}`);
      continue;
    }
    throw new Error(`cursor path uses '${cmd}', which placeCursorPath cannot move: ${d}`);
  }
  return out.join(' ');
}

function placed(p: CursorPath, k: number, dx: number, dy: number): CursorPath {
  const d = placeCursorPath(p.d, k, dx, dy);
  return p.role === 'stroke' || p.role === 'detail' ? { ...p, d, width: p.width * k } : { ...p, d };
}

/**
 * `glyph` carrying `mark` in its slot: the glyph moved by the slot's shift, hotspot included, and the mark scaled
 * into the slot as an `over` layer, so the mark's halo separates it from the glyph. Throws for a glyph with no slot.
 */
export function markedGlyph(glyph: CursorGlyph, mark: CursorMark): CursorGlyph {
  const slot = glyph.mark;
  if (!slot) throw new Error('this cursor glyph has no mark slot');
  const [sx, sy] = slot.shift ?? [0, 0];
  const k = slot.size / mark.box;
  const mx = slot.x - (mark.box / 2) * k;
  const my = slot.y - (mark.box / 2) * k;
  const { mark: _slot, ...rest } = glyph;
  return {
    ...rest,
    hotspot: [glyph.hotspot[0] + sx, glyph.hotspot[1] + sy],
    paths: glyph.paths.map((p) => (sx === 0 && sy === 0 ? p : placed(p, 1, sx, sy))),
    over: mark.paths.map((p) => placed(p, k, mx, my)),
  };
}
