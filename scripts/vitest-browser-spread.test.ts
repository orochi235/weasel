import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaywrightBrowserProvider } from '@vitest/browser-playwright';
import { browserShape, spreadPlaywright } from './vitest-browser-spread.mjs';

const launched: { close: ReturnType<typeof vi.fn> }[] = [];
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => {
      const browser = { close: vi.fn(async () => {}) };
      launched.push(browser);
      return browser;
    }),
  },
}));

const project = () =>
  ({ config: { browser: { name: 'chromium', headless: true } }, browser: { registerCommand() {} } }) as never;

afterEach(() => {
  launched.length = 0;
  vi.restoreAllMocks();
});

describe('browserShape', () => {
  it('gives each tab its own Chromium on the node sizes it was measured on, and keeps one below them', () => {
    expect([8, 10, 18].map((cores) => browserShape(cores, {}))).toEqual([
      { chromiums: 1, tabs: 6 },
      { chromiums: 18, tabs: 1 },
      { chromiums: 18, tabs: 1 },
    ]);
  });

  it('takes either count from the environment', () => {
    expect(browserShape(18, { WEASEL_BROWSER_CHROMIUMS: '1', WEASEL_BROWSER_TABS: '6' })).toEqual({ chromiums: 1, tabs: 6 });
    expect(browserShape(4, { WEASEL_BROWSER_CHROMIUMS: '3' })).toEqual({ chromiums: 3, tabs: 6 });
    expect(browserShape(18, { WEASEL_BROWSER_TABS: '2' })).toEqual({ chromiums: 18, tabs: 2 });
  });
});

describe('spreadPlaywright', () => {
  it('is the stock provider at one Chromium', () => {
    const provider = spreadPlaywright({}, 1);
    expect(provider.providerFactory(project())).toBeInstanceOf(PlaywrightBrowserProvider);
    expect(provider.providerFactory(project()).constructor).toBe(PlaywrightBrowserProvider);
  });

  it('deals each new page context to the next of its Chromiums, launching each once', async () => {
    const primary = { primary: true };
    vi.spyOn(PlaywrightBrowserProvider.prototype as never, 'openBrowser').mockResolvedValue(primary as never);
    const provider = spreadPlaywright({}, 3).providerFactory(project()) as unknown as { openBrowser(o: object): Promise<unknown> };
    const got = [];
    for (let i = 0; i < 6; i++) got.push(await provider.openBrowser({}));
    expect(launched).toHaveLength(2);
    expect(got).toEqual([primary, launched[0], launched[1], primary, launched[0], launched[1]]);
  });

  it('closes the Chromiums it launched beside the stock one', async () => {
    vi.spyOn(PlaywrightBrowserProvider.prototype as never, 'openBrowser').mockResolvedValue({} as never);
    const close = vi.spyOn(PlaywrightBrowserProvider.prototype, 'close').mockResolvedValue();
    const provider = spreadPlaywright({}, 3).providerFactory(project()) as unknown as PlaywrightBrowserProvider & {
      openBrowser(o: object): Promise<unknown>;
    };
    for (let i = 0; i < 3; i++) await provider.openBrowser({});
    await provider.close();
    expect(close).toHaveBeenCalledOnce();
    expect(launched.map((b) => b.close.mock.calls.length)).toEqual([1, 1]);
  });
});
