import { describe, expect, it } from 'vitest';
import { CHART_PAGE } from '../chartDocument';
import { paperSize, setupOf } from './pageSizes';

describe('page sizes', () => {
  it('turns a paper either way up', () => {
    expect(paperSize('a4', 'portrait')).toEqual({ width: 794, height: 1123 });
    expect(paperSize('a4', 'landscape')).toEqual({ width: 1123, height: 794 });
    expect(paperSize('custom', 'portrait')).toBeNull();
  });

  it('reads the chart page as landscape Letter, and any other size as custom', () => {
    expect(setupOf(CHART_PAGE)).toMatchObject({ paper: 'letter', orientation: 'landscape' });
    expect(setupOf({ width: 500, height: 600 })).toEqual({ paper: 'custom', orientation: 'portrait', width: 500, height: 600 });
  });
});
