/** Counterexamples the 10,000-run deep pass of `opentypeTables.pbt.test.ts` found, kept as examples. */
import { describe, expect, it } from 'vitest';
import { tablesOf } from '../pbt.fixture';
import { checkCmap } from './cmapCheck';
import { createOpenTypeParser } from './opentypeParser';
import { cmapSubtables, writeFont } from './writtenFont.fixture';

const written = () => writeFont({
  family: 'f', unitsPerEm: 1000,
  glyphs: [{ unicodes: [65], advance: 500, contours: [] }, { unicodes: [0x1f600], advance: 500, contours: [] }],
});
const cmapOf = (bytes: ArrayBuffer) => {
  const t = tablesOf(bytes).find((r) => r.tag === 'cmap')!;
  return { at: t.offset, view: new DataView(bytes, t.offset, t.length) };
};

describe('checkCmap, shrunk', () => {
  it('passes a face opentype.js wrote', () => {
    expect(() => checkCmap(cmapOf(written()).view)).not.toThrow();
  });

  it('refuses a format 12 group ending at 0xffffffff, which ran opentype.js out of heap', async () => {
    const bytes = written();
    const { at } = cmapOf(bytes);
    const sub = cmapSubtables(bytes, at).find((s) => s.format === 12)!;
    new DataView(bytes).setUint32(sub.at + 16 + 4, 0xffffffff);
    await expect(createOpenTypeParser()(bytes)).rejects.toThrow(/cmap table is damaged: its format 12 groups name more than/);
  });
});
