import { describe, expect, it } from 'vitest';
import { alignmentSnapSource } from '../alignment';
import { moveBy, sceneOf } from './session';

describe('moveBy', () => {
  it('runs a move with no subject over a scene given without ids', () => {
    const { scene } = sceneOf([{ x: 0, y: 0, width: 10, height: 10 }]);
    expect(moveBy({ sources: [alignmentSnapSource()], scene }).by(3, 4).point).toEqual({ x: 3, y: 4 });
  });
});
