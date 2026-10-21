import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionApi } from './browserApi';
import { badgeText, probeFrame, probeTab, refreshBadge, summarize } from './tabWeasel';

const w = window as { __weaselDevtools__?: unknown };

afterEach(() => {
  delete w.__weaselDevtools__;
});

describe('probeFrame', () => {
  it('reads the hook’s version and root count', () => {
    w.__weaselDevtools__ = { kitVersion: '1.11.0', roots: () => [{}, {}] };
    expect(probeFrame()).toEqual({ kitVersion: '1.11.0', roots: 2 });
  });

  it('answers null without a hook', () => {
    expect(probeFrame()).toBeNull();
  });

  it('closes over nothing, since only its source reaches the page', () => {
    w.__weaselDevtools__ = { kitVersion: '2.0.0', roots: () => [] };
    const detached = new Function(`return (${probeFrame.toString()})()`) as () => unknown;
    expect(detached()).toEqual({ kitVersion: '2.0.0', roots: 0 });
  });
});

describe('summarize', () => {
  it('adds up the frames that have a hook', () => {
    expect(summarize([null, { kitVersion: '1.0.0', roots: 1 }, undefined, { kitVersion: '1.0.0', roots: 2 }]))
      .toEqual({ kitVersion: '1.0.0', roots: 3, frames: 2 });
  });

  it('answers null when no frame has one', () => {
    expect(summarize([null, undefined])).toBeNull();
  });
});

describe('badgeText', () => {
  it('counts canvases, marks a hook with none, and is empty without weasel', () => {
    expect(badgeText({ kitVersion: '', roots: 3, frames: 1 })).toBe('3');
    expect(badgeText({ kitVersion: '', roots: 0, frames: 1 })).toBe('•');
    expect(badgeText(null)).toBe('');
  });
});

function fakeApi(executeScript: () => Promise<{ result?: unknown }[]>) {
  const setBadgeText = vi.fn();
  const api = { scripting: { executeScript }, action: { setBadgeText } } as unknown as ExtensionApi;
  return { api, setBadgeText };
}

describe('probeTab', () => {
  it('reads every frame in the page’s own world', async () => {
    const executeScript = vi.fn(async () => [{ result: { kitVersion: '1.0.0', roots: 1 } }]);
    const { api } = fakeApi(executeScript);
    await expect(probeTab(api, 7)).resolves.toEqual({ kitVersion: '1.0.0', roots: 1, frames: 1 });
    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({
      target: { tabId: 7, allFrames: true }, world: 'MAIN', func: probeFrame,
    }));
  });

  it('answers null on a page no extension may script', async () => {
    const { api } = fakeApi(() => Promise.reject(new Error('Cannot access a chrome:// URL')));
    await expect(probeTab(api, 7)).resolves.toBeNull();
  });
});

describe('refreshBadge', () => {
  it('puts the probe’s answer on that tab’s badge', async () => {
    const { api, setBadgeText } = fakeApi(async () => [{ result: { kitVersion: '1.0.0', roots: 2 } }]);
    await refreshBadge(api, 4);
    expect(setBadgeText).toHaveBeenCalledWith({ tabId: 4, text: '2' });
  });
});
