import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PALETTE_FILES, parseCopic, parseLego, renderCopic, renderLego } from './brand-colors.mjs';

const legoBlock = (name: string, rgb: string, type = 'Solid') =>
  `<article class='set'><a title="${name}"></a><div style="background-color:rgb(${rgb})"></div><a href='/colours/type-${type}'></a></article>`;

describe('parseLego', () => {
  it('keeps solid chromatic colours and sorts them by name', () => {
    const html = legoBlock('Coral', '255,128,102') + legoBlock('Bright Blue', '30,90,168') + legoBlock('Trans Red', '200,0,0', 'Transparent');
    expect(parseLego(html)).toEqual([
      { name: 'Bright Blue', hex: '#1e5aa8' },
      { name: 'Coral', hex: '#ff8066' },
    ]);
  });
});

describe('rendering', () => {
  it('refuses to write an empty LEGO table over the committed one', () => {
    expect(parseLego('<html>Just a moment…</html>')).toEqual([]);
    expect(() => renderLego([])).toThrow(/LEGO gave no rows/);
  });

  it('refuses to write an empty Copic table over the committed one', () => {
    expect(() => renderCopic(parseCopic([]))).toThrow(/Copic gave no rows/);
  });

  it('writes a row per colour', () => {
    expect(renderLego([{ name: 'Coral', hex: '#ff8066' }])).toContain(`{ name: "Coral", hex: '#ff8066' },`);
  });
});

describe('PALETTE_FILES', () => {
  it('names the committed tables wherever the script runs from', () => {
    expect(existsSync(PALETTE_FILES.lego) && existsSync(PALETTE_FILES.copic)).toBe(true);
    expect(PALETTE_FILES.lego).toMatch(/apps\/theme-editor\/src\/palette\/legoColors\.ts$/);
  });
});

describe('parseCopic', () => {
  const marker = { name: 'Frost Blue', number: 'B00', extractedColor: '#C4FAFE' };

  it('lowercases the sampled hex', () => {
    expect(parseCopic([marker])).toEqual([{ name: 'Frost Blue', code: 'B00', hex: '#c4fafe' }]);
  });

  it('throws on a marker with no name rather than writing `name: undefined`', () => {
    expect(() => parseCopic([{ ...marker, name: undefined }])).toThrow(/B00 has no name/);
  });

  it('throws on a sampled colour that is not a 6-digit hex', () => {
    expect(() => parseCopic([{ ...marker, extractedColor: 'rgb(1,2,3)' }])).toThrow(/B00.*not a #rrggbb hex/);
    expect(() => parseCopic([{ ...marker, extractedColor: '#fff' }])).toThrow(/not a #rrggbb hex/);
  });
});

describe('sorting', () => {
  afterEach(() => vi.restoreAllMocks());

  it("names its locale, so the machine's default cannot reorder the generated file", () => {
    const compare = vi.spyOn(String.prototype, 'localeCompare');
    parseLego(legoBlock('Coral', '255,128,102') + legoBlock('Bright Blue', '30,90,168'));
    parseCopic([
      { name: 'Mint Blue', number: 'B01', extractedColor: '#a5f0fc' },
      { name: 'Frost Blue', number: 'B00', extractedColor: '#c4fafe' },
    ]);
    expect(compare).toHaveBeenCalled();
    for (const call of compare.mock.calls) expect(call[1]).toBe('en');
  });
});
