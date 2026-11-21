import { describe, expect, it } from 'vitest';
import { keyframeLayerState, nudgedKey } from './keyframeEdits';

describe('keyframe bounds given high end first', () => {
  const state = keyframeLayerState([{ t: 0, value: 0 }, { t: 500, value: 5 }, { t: 1000, value: 10 }]);
  const range = { xMin: 0, xMax: 1000, yMin: 0, yMax: 10 };

  it('hold a nudged key inside the pair as they do given low end first', () => {
    const moved = nudgedKey(state, 1, { dx: 1, dy: 1 }, range, { xClamp: [1000, 0], yClamp: [10, 0] })!;
    expect(moved.keys[moved.selectedKey]).toMatchObject({ t: 510, value: 5.1 });
  });
});
