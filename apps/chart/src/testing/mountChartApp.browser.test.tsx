import { afterEach, describe, expect, it } from 'vitest';
import { mountChartApp, unmountChartApp } from './mountChartApp';

afterEach(unmountChartApp);

describe('mountChartApp', () => {
  it('refuses a second mount until the first is unmounted', async () => {
    await mountChartApp();
    await expect(mountChartApp()).rejects.toThrow('already mounted');
    expect(document.querySelectorAll('.wc-host')).toHaveLength(1);
    unmountChartApp();
    await mountChartApp();
    expect(document.querySelectorAll('.wc-host')).toHaveLength(1);
  });
});
