import { describe, expect, it } from 'vitest';
import { prefsRoundTrip } from '../../shared/prefsRoundTrip';
import { openDrawPrefs, PREFS } from './prefs';

describe("draw's prefs", () => {
  it('keep a value at every leaf through storage and a reopen', async () => {
    const { sent, read } = await prefsRoundTrip(PREFS, openDrawPrefs);
    expect(read).toEqual(sent);
  });
});
