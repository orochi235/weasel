import { describe, it, expect } from 'vitest';
import { GEOM_PACKAGE } from '@weasel-js/geom';

describe('@weasel-js/geom scaffold', () => {
  it('resolves the package entry', () => {
    expect(GEOM_PACKAGE).toBe('@weasel-js/geom');
  });
});
