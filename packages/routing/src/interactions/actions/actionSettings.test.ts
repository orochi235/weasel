import { describe, expect, it, vi } from 'vitest';
import { readActionSettings } from './actionSettings';
import type { Action } from './action';

describe('readActionSettings', () => {
  it('shows no values for a read that throws, warning once per action', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broke = new Error('read broke');
    const action: Action = {
      id: 'broken-settings',
      label: 'Broken',
      settings: { schema: { name: 'Style', fields: [] } as never, read: () => { throw broke; } },
    };
    expect(readActionSettings(action, undefined)).toEqual({ values: {} });
    expect(readActionSettings(action, undefined)).toEqual({ values: {} });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('settings.read() for action "broken-settings" threw'), broke);
    warn.mockRestore();
  });
});
