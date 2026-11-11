/** Counterexamples `writtenFont.pbt.test.ts` shrank to, kept as examples. */
import { describe, expect, it } from 'vitest';
import { createOpenTypeParser } from './opentypeParser';
import { writeFont } from './writtenFont.fixture';

describe('a written CFF face, shrunk', () => {
  it('keeps the last vertex of a contour that ends within an em of its start', async () => {
    const face = await createOpenTypeParser()(writeFont({
      family: ' ', unitsPerEm: 1000,
      glyphs: [{ unicodes: [34], advance: 0, contours: [{ start: [1, 0], segments: [{ kind: 'L', to: [0, 0] }, { kind: 'L', to: [0, -1] }] }] }],
    }));
    expect(face.glyphD(34)).toBe('M0.00100 0L0 0L0 0.00100');
  });
});
