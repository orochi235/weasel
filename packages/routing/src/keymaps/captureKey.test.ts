import { describe, it, expect } from 'vitest';
import { held, key } from '@weasel-js/gestures';
import { captureKey } from './captureKey';

const press = (init: KeyboardEventInit) => { window.dispatchEvent(new KeyboardEvent('keydown', { cancelable: true, ...init })); };

describe('captureKey', () => {
  it('resolves on the next keystroke, with Cmd as Mod on an Apple platform', async () => {
    const got = captureKey(window, { apple: true });
    press({ key: 'Shift', shiftKey: true });
    press({ key: 'K', metaKey: true, shiftKey: true });
    expect(await got).toEqual(key('Mod+Shift+K'));
  });

  it('reads Ctrl as Mod elsewhere, and Meta as itself', async () => {
    const got = captureKey(window, { apple: false });
    press({ key: 'k', ctrlKey: true, metaKey: true });
    expect(await got).toEqual({ kind: 'key', key: 'k', mods: { mod: true, meta: true } });
  });

  it('gives the held form when asked', async () => {
    const got = captureKey(window, { held: true, apple: false });
    press({ key: ' ' });
    expect(await got).toEqual(held('Space'));
  });

  it('takes what it captures from the page', async () => {
    const got = captureKey(window, { apple: false });
    const e = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    window.dispatchEvent(e);
    await got;
    expect(e.defaultPrevented).toBe(true);
  });

  it('resolves null on Escape and on abort', async () => {
    const esc = captureKey(window);
    press({ key: 'Escape' });
    expect(await esc).toBeNull();
    const ctl = new AbortController();
    const aborted = captureKey(window, { signal: ctl.signal });
    ctl.abort();
    expect(await aborted).toBeNull();
  });
});
