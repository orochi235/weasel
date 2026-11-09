import type { CursorGlyph, CursorMark, CursorPath } from './types';

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Path data scaled by `k` and moved by `(dx, dy)`. Reads the authored dialect, absolute `M`, `L`, `A` and `Z`,
 * and throws on anything else rather than misplace it.
 */
export function placeCursorPath(d: string, k: number, dx: number, dy: number): string {
  const out: string[] = [];
  // `e` is an exponent, not a command: a number like 1e-3 must not split.
  for (const [, cmd, args] of d.matchAll(/([A-DF-Za-df-z])([^A-DF-Za-df-z]*)/g)) {
    const nums = (args!.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
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
