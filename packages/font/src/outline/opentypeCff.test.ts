import { describe, expect, it } from 'vitest';
import { tablesOf } from '../pbt.fixture';
import { createOpenTypeParser } from './opentypeParser';
import { writeFont } from './writtenFont.fixture';

const written = (): ArrayBuffer => writeFont({
  family: 'Probe', unitsPerEm: 1000,
  glyphs: [{ unicodes: [65], advance: 500, contours: [] }],
});

describe('the CFF check before opentype.js reads a CFF face', () => {
  it('checks a CFF2-tagged table, which opentype.js reads by the version its header names', async () => {
    const bytes = written();
    const i = tablesOf(bytes).findIndex((t) => t.tag === 'CFF ');
    const view = new DataView(bytes);
    view.setUint8(12 + i * 16 + 3, '2'.charCodeAt(0));
    // A header size past the table's end puts the Name INDEX outside it.
    view.setUint8(tablesOf(bytes)[i]!.offset + 2, 0xff);
    await expect(createOpenTypeParser()(bytes)).rejects.toThrow(/CFF table is damaged/);
  });
});
