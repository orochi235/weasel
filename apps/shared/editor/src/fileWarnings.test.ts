import { describe, expect, it } from 'vitest';
import { describeFileWarnings } from './fileWarnings';

describe('describeFileWarnings', () => {
  it('counts one warning in the singular and quotes it', () => {
    expect(describeFileWarnings('Opened', ['<foreignObject> is not supported'])).toEqual({
      title: 'Opened with 1 warning',
      description: '<foreignObject> is not supported',
    });
  });

  it('gives a repeated warning once, and counts what it does not quote', () => {
    expect(describeFileWarnings('Saved', ['a', 'b', 'a', 'c', 'd', 'e'])).toEqual({
      title: 'Saved with 5 warnings',
      description: 'a; b; c; and 2 more',
    });
  });
});
