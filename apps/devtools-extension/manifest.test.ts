import { describe, it, expect } from 'vitest';
import { GECKO_ID, extensionVersion, manifestFor } from './manifest';

describe('the extension manifest', () => {
  it('runs the background as a service worker in Chrome', () => {
    const m = manifestFor('chrome', '1.2.3');
    expect(m.background).toEqual({ service_worker: 'background.js' });
    expect(m).not.toHaveProperty('browser_specific_settings');
  });

  it('runs the background as an event page in Firefox, under a fixed id', () => {
    const m = manifestFor('firefox', '1.2.3');
    expect(m.background).toEqual({ scripts: ['background.js'] });
    expect(m.browser_specific_settings).toMatchObject({ gecko: { id: GECKO_ID } });
  });

  it('gives a browser a version it accepts', () => {
    expect(extensionVersion('1.12.0-next.3')).toBe('1.12.0');
    expect(manifestFor('chrome', '2.0.1').version).toBe('2.0.1');
  });
});
