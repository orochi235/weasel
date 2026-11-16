import { describe, expect, it } from 'vitest';
import { foreignFrom } from './nativeExports.ts';

describe('foreignFrom', () => {
  it('does not know an import named for an Object member until it is found', () => {
    const foreign = foreignFrom({ values: {}, calls: {}, reexports: { constructor: true } });
    expect(foreign.value('toString')).toBeUndefined();
    expect(foreign.call('constructor')).toBeUndefined();
    expect(foreign.reexport('constructor')).toBe(true);
  });
});
