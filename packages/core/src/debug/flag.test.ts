import { describe, expect, it } from 'vitest';
import * as routing from '@weasel-js/routing';
import * as flag from './flag';

describe('the debug flag', () => {
  it('is the one routing defines, so both packages read one cache', () => {
    expect(flag.isDebugEnabled).toBe(routing.isDebugEnabled);
    expect(flag.dlog).toBe(routing.dlog);
    expect(flag.dwarn).toBe(routing.dwarn);
  });
});
