import { describe, expect, it } from 'vitest';
import { latin1 } from './testing/latin1';
import { NO_FONTS } from './testing/noFonts';
import { writePdf } from './writePdf';

describe('writePdf', () => {
  it('writes one page per input page, each its own size', async () => {
    const { bytes } = await writePdf(
      [
        { width: 150, height: 75, commands: [] },
        { width: 75, height: 150, commands: [] },
      ],
      { fonts: NO_FONTS, compress: false },
    );
    const s = latin1(bytes);
    expect(s.startsWith('%PDF-1.7')).toBe(true);
    expect(s.match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(s).toContain('/MediaBox [0 0 150 75]');
    expect(s).toContain('/MediaBox [0 0 75 150]');
    expect(s).toContain('1 0 0 -1 0 75 cm');
  });

  it('puts the title in the info dictionary', async () => {
    const { bytes } = await writePdf([{ width: 10, height: 10, commands: [] }], {
      fonts: NO_FONTS,
      compress: false,
      title: 'Chart',
    });
    expect(latin1(bytes)).toContain('/Title (Chart)');
  });
});
