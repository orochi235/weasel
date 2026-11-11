import type { DrawCommand } from '@weasel-js/renderer';
import { describe, expect, it } from 'vitest';
import { NESTING_LIMIT } from './drawCommands';
import { NO_FONTS } from './testing/noFonts';
import { writePdf } from './writePdf';

const leaf: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 1, y: 1, width: 5, height: 5 }, fill: { paint: { color: '#f00' } } };
const nest = (depth: number): DrawCommand => {
  let cmd: DrawCommand = leaf;
  for (let i = 0; i < depth; i++) cmd = { kind: 'group', children: [cmd] };
  return cmd;
};

// Shrunk from `writePdf.pages.pbt.test.ts` (2026-11-11).
describe('writePdf pages, shrunk counterexamples', () => {
  it('reports a group nested past the limit rather than drawing it, and writes groups nested far deeper without overflowing', async () => {
    for (const depth of [NESTING_LIMIT + 1, 50_000]) {
      const { skipped } = await writePdf([{ width: 50, height: 50, commands: [nest(depth)] }], { fonts: NO_FONTS, compress: false });
      expect(skipped).toEqual([{ kind: 'command', detail: `groups nest more than ${NESTING_LIMIT} deep; what is deeper is not drawn` }]);
    }
  });

  it('refuses a page with no area or a size that is not finite, naming it, rather than writing an empty media box', async () => {
    const page = (width: number, height: number) => ({ width, height, commands: [leaf] });
    await expect(writePdf([page(10, 10), page(0, 0.001)], { fonts: NO_FONTS })).rejects.toThrow(
      'pdf: page 2 is 0 by 0.001; a page needs a finite width and height of at least 0.0001',
    );
    await expect(writePdf([page(-10, 10)], { fonts: NO_FONTS })).rejects.toThrow(/^pdf: page 1 /);
    await expect(writePdf([page(NaN, 10)], { fonts: NO_FONTS })).rejects.toThrow(/^pdf: page 1 /);
    await expect(writePdf([page(4e-5, 10)], { fonts: NO_FONTS })).rejects.toThrow(/^pdf: page 1 /);
  });
});
