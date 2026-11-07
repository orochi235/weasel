import { describe, expect, it } from 'vitest';
import { browserShape } from './browser-shape.mjs';

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
    expect(browserShape(18, { WEASEL_BROWSER_CHROMIUMS: '4' }, { beside: true })).toEqual({ chromiums: 4, tabs: 1 });
  });

  it('takes fewer Chromiums beside the jsdom projects, on the nodes it splits on', () => {
    expect(browserShape(18, {}, { beside: true })).toEqual({ chromiums: 12, tabs: 1 });
    expect(browserShape(8, {}, { beside: true })).toEqual({ chromiums: 1, tabs: 6 });
  });
});
