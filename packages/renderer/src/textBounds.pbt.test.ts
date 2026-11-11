/** `textBox` against what the renderer places: every glyph quad's corners and every decoration rule, under any transform. */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { cachedPaintRuns, QUAD_STRIDE, SYNTHETIC_ITALIC_RADIANS, type StyledRun } from '@weasel-js/text';
import type { TextDrawCommand } from './DrawCommand';
import { glyphCorners } from './glyphCorners';
import { affine, runs, spread, tally, timeoutFor } from './pbt.fixture';
import { textBox } from './textBounds';
import { textCommandFromRuns } from './textCommand';
import { laidOutText } from './textLayout';

beforeAll(async () => {
  global.fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith('.json')
    ? { ok: true, json: () => Promise.resolve(FIXTURE_FONT) }
    : { ok: true, blob: () => Promise.resolve(new Blob([new TextEncoder().encode('PNG')], { type: 'image/png' })) })) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  _resetFontRegistryForTests();
  await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

const run: fc.Arbitrary<StyledRun> = fc.record({
  text: fc.stringMatching(/^[A-Za-z .,\n]{1,12}$/),
  fontSize: fc.option(spread(2, 80), { nil: undefined }),
  italic: fc.option(fc.boolean(), { nil: undefined }),
  letterSpacing: fc.option(spread(-10, 20), { nil: undefined }),
  underline: fc.option(fc.boolean(), { nil: undefined }),
  overline: fc.option(fc.boolean(), { nil: undefined }),
  strikethrough: fc.option(fc.boolean(), { nil: undefined }),
  baselineShift: fc.option(spread(-1, 1), { nil: undefined }),
  script: fc.option(fc.constantFrom('super' as const, 'sub' as const), { nil: undefined }),
  stroke: fc.option(spread(0.5, 8).map((width) => ({ paint: { kind: 'solid' as const, color: '#000' }, width })), { nil: undefined, freq: 2 }),
}, { requiredKeys: ['text'] });

const command = fc.record({
  x: spread(-300, 300), y: spread(-300, 300), runs: fc.array(run, { minLength: 1, maxLength: 3 }),
  maxWidth: fc.option(spread(20, 400), { nil: undefined }),
  align: fc.constantFrom('left' as const, 'center' as const, 'right' as const, 'justify' as const),
  height: fc.option(spread(0, 300), { nil: undefined }),
  verticalAlign: fc.option(fc.constantFrom('top' as const, 'center' as const, 'bottom' as const), { nil: undefined }),
}).map((c) => textCommandFromRuns(c.x, c.y, c.runs, { fontFamily: 'inter', fontSize: 16, align: c.align }, c.maxWidth, c.height, c.verticalAlign, { fill: { paint: { kind: 'solid', color: '#000' } } }) as TextDrawCommand);

/** Every screen point `cmd` paints a glyph quad or a rule through under `m`. */
function placed(cmd: TextDrawCommand, m: GlMat3): number[][] {
  const { laid, dx, dy } = laidOutText(cmd);
  const { groups, decorations } = cachedPaintRuns(laid, cmd.runs, { outlineMinSize: undefined }, 'read');
  const out: number[][] = [];
  const c = new Array<number>(8).fill(0);
  for (const g of groups) {
    const tan = g.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
    for (let at = 0; at < g.quadData.length; at += QUAD_STRIDE) {
      glyphCorners(g.quadData, at, dx, dy, tan, c);
      for (let k = 0; k < 8; k += 2) out.push(mat3.apply(m, c[k]!, c[k + 1]!));
    }
  }
  for (const d of decorations) {
    for (const [x, y] of [[d.x0, d.y0], [d.x1, d.y0], [d.x1, d.y1], [d.x0, d.y1]]) out.push(mat3.apply(m, x! + dx, y! + dy));
  }
  return out;
}

describe('textBox, property', () => {
  it('holds every glyph quad and decoration rule the renderer places, under any transform', () => {
    const t = tally();
    fc.assert(fc.property(command, fc.oneof(fc.constant(mat3.identity()), affine), (cmd, m) => {
      const pts = placed(cmd, m);
      const box = textBox(cmd, m);
      if (pts.length === 0) { t.count('nothing placed'); return; }
      t.count(cmd.runs.some((r) => r.stroke) ? 'stroked' : 'placed');
      expect(box).not.toBeNull();
      const slack = 1e-9 * Math.max(1, ...pts.flat().map(Math.abs));
      const out = pts.find(([x, y]) => !(x! >= box!.minX - slack && x! <= box!.maxX + slack && y! >= box!.minY - slack && y! <= box!.maxY + slack));
      expect(out, `${out} outside ${JSON.stringify(box)}`).toBeUndefined();
    }), runs(200));
    t.atLeast('placed', 30);
    t.atLeast('stroked', 30);
  }, timeoutFor(200, 20));

  it('moves with the command', () => {
    fc.assert(fc.property(command, affine, spread(-500, 500), spread(-500, 500), (cmd, m, dx, dy) => {
      const a = textBox(cmd, m), b = textBox({ ...cmd, x: cmd.x + dx, y: cmd.y + dy }, m);
      if (a === null) { expect(b).toBeNull(); return; }
      const [ex, ey] = [m[0]! * dx + m[3]! * dy, m[1]! * dx + m[4]! * dy];
      const tol = 1e-9 * (1 + Math.abs(a.minX) + Math.abs(a.maxX) + Math.abs(a.minY) + Math.abs(a.maxY) + Math.abs(ex) + Math.abs(ey));
      expect(Math.abs(b!.minX - a.minX - ex)).toBeLessThanOrEqual(tol);
      expect(Math.abs(b!.maxY - a.maxY - ey)).toBeLessThanOrEqual(tol);
    }), runs(200));
  });
});
