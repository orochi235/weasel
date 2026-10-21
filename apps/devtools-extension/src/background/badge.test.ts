import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionApi } from '../browserApi';
import { BADGE_DELAYS, watchBadges } from './badge';

type Listener = (tabId: number, info: { status?: string }) => void;

function fakeApi() {
  let listener: Listener | undefined;
  let installed: (() => void) | undefined;
  const setBadgeText = vi.fn();
  const api = {
    runtime: { onInstalled: { addListener: (l: () => void) => { installed = l; }, removeListener: () => {} } },
    tabs: {
      onUpdated: { addListener: (l: Listener) => { listener = l; }, removeListener: () => {} },
      query: async () => [{ id: 1 }, {}, { id: 2 }],
    },
    action: { setBadgeText },
  } as unknown as ExtensionApi;
  return {
    api, setBadgeText,
    update: (tabId: number, status: string) => listener!(tabId, { status }),
    install: () => installed!(),
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
    expect(refresh).toHaveBeenCalledWith(3);
  });

  it('probes every open tab when installed, since those tabs loaded before it listened', async () => {
    const { api, install } = fakeApi();
    const refresh = vi.fn();
    watchBadges(api, refresh);
    install();
    await vi.waitFor(() => expect(refresh.mock.calls).toEqual([[1], [2]]));
  });
});
