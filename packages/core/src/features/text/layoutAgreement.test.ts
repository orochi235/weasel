/**
 * One string, one style, three consumers — the paint, the silhouette and the
 * caret — asked to agree.
 *
 * Until this landed they were three walks: `drawText` through
 * `cachedLayoutRuns`, `textLineBoxes` through a bare `layoutRuns`, and
 * `caretIndexAt` through `ctx.measureText`. The first two differed only in
 * cost; the third differed in answer, because per-character measurement
 * cannot see a kerning pair and never looked at `runs` at all. Nothing
 * compared them, so the gap was invisible.
 *
 * The `inter` fixture is baked at size 32 with two glyphs — `A` (advance 23),
 * `B` (advance 22) — and one kerning pair, `A→B` at -1. At `fontSize: 32`
 * those are world units, so the pen puts `B` at x = 22 and an unkerned walk
 * puts it at 23. Every assertion here is written to fail on that one unit.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { cachedLayoutRuns, textLineBoxes } from '@weasel-js/text';
import type { TextDrawCommand } from '../../renderer/DrawCommand';
import type { TextPose } from '@weasel-js/text';
import { caretIndexAt } from './hitTest';
import { textCommandFromRuns } from './textCommand';

const SIZE = 32;
const STYLE = { fontFamily: 'inter', fontSize: SIZE };
/** Mixed sizes, so a site that ignores `runs` answers differently. */
const RUNS = [{ text: 'A' }, { text: 'B', fontSize: 64 }];
const POSE: TextPose = {
  x: 100, y: 50, width: 400, height: 200, text: 'AB', runs: RUNS, style: STYLE,
};

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetLayoutCacheForTests();
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
    }
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
    });
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
  _resetLayoutCacheForTests();
});

/** What the renderer would lay out for `POSE`, through the command builder
 *  every text painter uses. */
function painted() {
  const cmd = textCommandFromRuns(
    POSE.x, POSE.y, RUNS, STYLE, POSE.width, POSE.height,
  ) as TextDrawCommand;
  return cachedLayoutRuns(cmd.runs, {
    maxWidth: cmd.maxWidth ?? Infinity,
    lineHeight: 1.2,
    align: cmd.align ?? 'left',
  });
}

describe('the paint, the silhouette and the caret', () => {
  it('answer from the same memoized layout', () => {
    // Each site resolves its own `ResolvedRun[]`, so this holds only because
    // the cache keys on structure as well as array identity.
    const first = painted();
    _resetLayoutCacheForTests();
    const cold = painted();
    expect(cold).not.toBe(first);
    expect(painted()).toBe(cold);
    // `textLineBoxes` allocates its runs from the pose rather than the
    // command, and still lands on the same entry.
    textLineBoxes(POSE, { maxWidth: POSE.width });
    expect(painted()).toBe(cold);
  });

  it('put the line where the glyphs are', () => {
    const laid = painted();
    const [box] = textLineBoxes(POSE, { maxWidth: POSE.width });
    expect(box.x).toBeCloseTo(POSE.x + laid.lines[0].x0, 10);
    expect(box.x + box.width).toBeCloseTo(POSE.x + laid.lines[0].x1, 10);
  });

  it('put the caret boundary on the pen position the paint used', () => {
    const laid = painted();
    const quads = laid.groups.flatMap((g) => g.quads);
    expect(quads).toHaveLength(2);
    // A quad's left edge is the pen plus the glyph's `xoffset`, scaled; both
    // fixture glyphs sit at the size their run asked for.
    const penOfB = quads[1].x0 - 2 * (64 / SIZE);
    expect(penOfB).toBeCloseTo(22, 10);
    expect(laid.lines[0].caretXs[1]).toBeCloseTo(penOfB, 10);

    // And the caret flips at that cell's midpoint, in world space.
    const mid = POSE.x + (laid.lines[0].caretXs[1] + laid.lines[0].caretXs[2]) / 2;
    expect(caretIndexAt(mid - 1, POSE.y + 5, POSE)).toBe(1);
    expect(caretIndexAt(mid + 1, POSE.y + 5, POSE)).toBe(2);
  });

  it('agree on where the text ends', () => {
    const laid = painted();
    const [box] = textLineBoxes(POSE, { maxWidth: POSE.width });
    const end = laid.lines[0].caretXs[laid.lines[0].caretXs.length - 1];
    expect(POSE.x + end).toBeCloseTo(box.x + box.width, 10);
    expect(caretIndexAt(POSE.x + end + 10, POSE.y + 5, POSE)).toBe(POSE.text.length);
  });
});
