import { describe, it, expect } from 'vitest';

import * as barrel from './index';
import * as metrics from './metrics.entry';
import * as seams from './test-seams';

describe('published surface', () => {
  it('keeps the reset seams off the package barrel', () => {
    expect(Object.keys(barrel).filter((k) => k.endsWith('ForTests'))).toEqual([]);
  });

  it('reaches every reset seam through the test-seam entry', () => {
    expect(Object.keys(seams).every((k) => k.endsWith('ForTests'))).toBe(true);
    expect(Object.keys(seams).length).toBeGreaterThan(0);
  });

  it('serves the DOM-free metrics entry from the barrel too', () => {
    expect(Object.keys(metrics).filter((k) => !(k in barrel))).toEqual([]);
  });
});
