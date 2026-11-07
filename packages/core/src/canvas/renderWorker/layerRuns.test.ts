import { describe, expect, it } from 'vitest';
import { isSceneLayer, layerRuns, runsKey } from './layerRuns';

describe('layerRuns', () => {
  it('cuts the stack where who paints changes, and tops it with a page run', () => {
    expect(layerRuns(['grid', 'scene:a', 'scene:b', 'chrome'], isSceneLayer)).toEqual([
      { by: 'page', ids: ['grid'] }, { by: 'worker', ids: ['scene:a', 'scene:b'] }, { by: 'page', ids: ['chrome'] },
    ]);
    expect(layerRuns(['scene'], isSceneLayer)).toEqual([{ by: 'worker', ids: ['scene'] }, { by: 'page', ids: [] }]);
  });

  it('splits the scene around a page layer between two scene layers', () => {
    const runs = layerRuns(['scene:a', 'mine', 'scene:b'], isSceneLayer);
    expect(runsKey(runs)).toBe('wpwp');
    expect(runs[2]).toEqual({ by: 'worker', ids: ['scene:b'] });
  });

  it('knows a scene layer by its key', () => {
    expect(isSceneLayer('scene')).toBe(true);
    expect(isSceneLayer('scene:x')).toBe(true);
    expect(isSceneLayer('scenery')).toBe(false);
  });
});
