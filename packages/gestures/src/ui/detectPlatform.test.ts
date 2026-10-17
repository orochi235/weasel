import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectPlatform } from './keySpecsFromMods';

afterEach(() => vi.unstubAllGlobals());

const on = (nav: Record<string, unknown>) => {
  vi.stubGlobal('navigator', nav);
  return detectPlatform();
};

describe('detectPlatform', () => {
  it('reads Apple platforms as macOS, iPad included', () => {
    expect(on({ platform: 'MacIntel', userAgent: '' })).toBe('macos');
    expect(on({ platform: 'iPad', userAgent: '' })).toBe('macos');
  });

  it('reads Windows and Linux', () => {
    expect(on({ platform: 'Win32', userAgent: '' })).toBe('windows');
    expect(on({ userAgentData: { platform: 'Windows' }, platform: '', userAgent: '' })).toBe('windows');
    expect(on({ platform: 'Linux x86_64', userAgent: '' })).toBe('linux');
  });

  it('reads an unrecognized browser as Linux, where mod matches Ctrl', () => {
    expect(on({ platform: '', userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)' })).toBe('linux');
    expect(on({ platform: '', userAgent: 'Mozilla/5.0 (darwin) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/26.1.0' })).toBe('linux');
  });

  it('answers macOS with no navigator', () => {
    vi.stubGlobal('navigator', undefined);
    expect(detectPlatform()).toBe('macos');
  });
});
