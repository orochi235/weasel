import { describe, it, expect } from 'vitest';

describe('the devtools entries', () => {
  it('installs no hook from devtools-protocol, and one from devtools, with the same exports', async () => {
    const protocol = await import('@weasel-js/core/devtools-protocol');
    expect(window.__weaselDevtools__).toBeUndefined();
    const devtools = await import('@weasel-js/core/devtools');
    expect(window.__weaselDevtools__).toBeDefined();
    expect(Object.keys(devtools).sort()).toEqual(Object.keys(protocol).sort());
    expect(devtools.createWindowPanelTransport).toBe(protocol.createWindowPanelTransport);
    delete window.__weaselDevtools__;
  });
});
