import { describe, expect, it } from 'vitest';
import * as core from '@weasel-js/core';
import * as ui from './dlog';

describe('the debug flag', () => {
  it('is the one core exports, so both packages read one cache', () => {
    expect(ui.isDebugEnabled).toBe(core.isDebugEnabled);
    expect(ui.dlog).toBe(core.dlog);
  });
});
