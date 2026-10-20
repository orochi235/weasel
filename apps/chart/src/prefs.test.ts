import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '@weasel-js/storage';
import { CHART_PREFS_PREFIX, openChartPrefs } from './prefs';

type Store = ReturnType<typeof openChartPrefs>;
const stores: Store[] = [];
afterEach(() => { for (const s of stores.splice(0)) void s.close(); });
const make = (backing = new Map<string, unknown>()): Store => {
  const s = openChartPrefs(createMemoryAdapter(backing));
  stores.push(s);
  return s;
};

describe('openChartPrefs', () => {
  it('starts every leaf at its default', () => {
    expect(make().values()).toEqual({
      view: { gridVisible: false, gridSpacing: 12, snapToGrid: false, alignmentSnap: true, spacingSnap: true },
      pipeline: { look: 'nodeGraph' },
    });
  });

  it('round-trips a set value through storage', async () => {
    const backing = new Map<string, unknown>();
    const s = make(backing);
    s.set('view.gridSpacing', 24);
    s.set('pipeline.look', 'rack');
    await s.flush();
    const again = make(backing);
    expect(again.get('view.gridSpacing')).toBe(24);
    expect(again.get('pipeline.look')).toBe('rack');
  });

  it('a corrupt stored spacing falls back to 12', () => {
    for (const bad of ['wide', null, true, [12]]) {
      expect(make(new Map([[`${CHART_PREFS_PREFIX}view.gridSpacing`, bad]])).get('view.gridSpacing')).toBe(12);
    }
  });

  it('a stored look the schema does not list falls back to nodeGraph', () => {
    expect(make(new Map([[`${CHART_PREFS_PREFIX}pipeline.look`, 'tree']])).get('pipeline.look')).toBe('nodeGraph');
  });
});
