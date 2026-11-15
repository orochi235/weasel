import { afterEach, describe, expect, it, vi } from 'vitest';
import { isApplePlatform, isContextPress, modHeld, modKey } from './platform';

afterEach(() => vi.unstubAllGlobals());

const withNavigator = (nav: Record<string, unknown>) => vi.stubGlobal('navigator', nav);

describe('isApplePlatform', () => {
  it('is true on a Mac, an iPhone, an iPad, and an iPod', () => {
    for (const platform of ['MacIntel', 'iPhone', 'iPad', 'iPod']) {
      withNavigator({ platform, userAgent: '' });
      expect(isApplePlatform(), platform).toBe(true);
    }
  });

  it('is false on Windows, Linux, Android, and ChromeOS', () => {
    for (const platform of ['Win32', 'Linux x86_64', 'Linux armv81', 'CrOS']) {
      withNavigator({ platform, userAgent: '' });
      expect(isApplePlatform(), platform).toBe(false);
    }
  });

  it('prefers userAgentData, then platform, then the user agent', () => {
    withNavigator({ userAgentData: { platform: 'macOS' }, platform: 'Win32', userAgent: '' });
    expect(isApplePlatform()).toBe(true);
    withNavigator({ userAgentData: { platform: 'Windows' }, platform: 'MacIntel', userAgent: '' });
    expect(isApplePlatform()).toBe(false);
    // An empty platform must not swallow the fallback.
    withNavigator({ platform: '', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });
    expect(isApplePlatform()).toBe(true);
  });

  it('is false with no navigator', () => {
    vi.stubGlobal('navigator', undefined);
    expect(isApplePlatform()).toBe(false);
  });

  it('is false under jsdom on any host, whose user agent names the host OS', () => {
    withNavigator({ platform: '', userAgent: 'Mozilla/5.0 (darwin) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/26.1.0' });
    expect(isApplePlatform()).toBe(false);
  });
});

describe('modHeld and modKey', () => {
  it('read Command on an Apple platform and Ctrl elsewhere, never the other', () => {
    expect(modHeld({ metaKey: true, ctrlKey: false }, true)).toBe(true);
    expect(modHeld({ metaKey: false, ctrlKey: true }, true)).toBe(false);
    expect(modHeld({ metaKey: false, ctrlKey: true }, false)).toBe(true);
    expect(modHeld({ metaKey: true, ctrlKey: false }, false)).toBe(false);
    expect(modKey(true)).toBe('meta');
    expect(modKey(false)).toBe('ctrl');
  });
});

describe('isContextPress', () => {
  it('is the secondary button anywhere, and Ctrl with the primary one only on an Apple platform', () => {
    expect(isContextPress({ button: 2, ctrlKey: false }, false)).toBe(true);
    expect(isContextPress({ button: 0, ctrlKey: true }, true)).toBe(true);
    expect(isContextPress({ button: 0, ctrlKey: true }, false)).toBe(false);
    expect(isContextPress({ button: 0, ctrlKey: false }, true)).toBe(false);
    expect(isContextPress({ button: 1, ctrlKey: true }, true)).toBe(false);
  });
});
