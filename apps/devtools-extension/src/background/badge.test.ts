import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionApi } from '../browserApi';
import { BADGE_DELAYS, watchBadges } from './badge';

type Listener = (tabId: number, info: { status?: string }) => void;

function fakeApi() {
  let listener: Listener | undefined;
  let installed: (() => void) | undefined;
  let removed: ((tabId: number) => void) | undefined;
  const setBadgeText = vi.fn();
  const api = {
    runtime: { onInstalled: { addListener: (l: () => void) => { installed = l; }, removeListener: () => {} } },
    tabs: {
      onUpdated: { addListener: (l: Listener) => { listener = l; }, removeListener: () => {} },
      onRemoved: { addListener: (l: (tabId: number) => void) => { removed = l; }, removeListener: () => {} },
      query: async () => [{ id: 1 }, {}, { id: 2 }],
    },
    action: { setBadgeText },
  } as unknown as ExtensionApi;
  return {
    api, setBadgeText,
    update: (tabId: number, status: string) => listener!(tabId, { status }),
    install: () => installed!(),
    remove: (tabId: number) => removed!(tabId),
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('watchBadges', () => {
  it('clears a tab’s badge as it starts loading', () => {
    const { api, setBadgeText, update } = fakeApi();
    watchBadges(api, vi.fn());
    update(3, 'loading');
    expect(setBadgeText).toHaveBeenCalledWith({ tabId: 3, text: '' });
  });

  it('probes a loaded tab once per delay, for a hook installed after load', () => {
    const { api, update } = fakeApi();
    const refresh = vi.fn();
    watchBadges(api, refresh);
    update(3, 'complete');
    vi.advanceTimersByTime(BADGE_DELAYS.at(-1)!);
    expect(refresh).toHaveBeenCalledTimes(BADGE_DELAYS.length);
    expect(refresh).toHaveBeenCalledWith(3, expect.any(Function));
  });

  it('probes every open tab when installed, since those tabs loaded before it listened', async () => {
    const { api, install } = fakeApi();
    const refresh = vi.fn();
    watchBadges(api, refresh);
    install();
    await vi.waitFor(() => expect(refresh.mock.calls.map(([id]) => id)).toEqual([1, 2]));
  });

  it('leaves the badge to the newest probe of a tab, and to none from before it navigated', () => {
    const { api, update } = fakeApi();
    const refresh = vi.fn();
    watchBadges(api, refresh);
    update(3, 'complete');
    vi.advanceTimersByTime(BADGE_DELAYS[1]!);
    const [first, second] = refresh.mock.calls.map(([, current]) => current as () => boolean);
    expect(first!()).toBe(false);
    expect(second!()).toBe(true);
    update(3, 'loading');
    expect(second!()).toBe(false);
  });

  it('cancels the probes of a tab closed before they ran, and leaves the badge of one closed mid-probe', () => {
    const { api, update, remove } = fakeApi();
    const refresh = vi.fn();
    watchBadges(api, refresh);
    update(3, 'complete');
    vi.advanceTimersByTime(0);
    const [current] = refresh.mock.calls.map(([, c]) => c as () => boolean);
    remove(3);
    vi.advanceTimersByTime(BADGE_DELAYS.at(-1)!);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(current!()).toBe(false);
  });
});
