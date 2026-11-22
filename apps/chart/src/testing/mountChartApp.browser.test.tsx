import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import '@weasel-js/theme/tokens.css';
import { mountChartApp, unmountChartApp } from './mountChartApp';

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});
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
