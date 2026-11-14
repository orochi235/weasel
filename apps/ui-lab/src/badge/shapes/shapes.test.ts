import { describe, expect, it } from 'vitest';
import { changedShapeParams, shapeParamsSnippet, shapesConfig } from './shapesConfig';

describe('shape params', () => {
  it('reports nothing while every shape sits at its defaults', () => {
    const { params } = shapesConfig.defaults();
    expect(changedShapeParams(params)).toEqual({});
    expect(shapeParamsSnippet(params)).toBe('// (no changes from defaults)');
  });

  it('lists only the params that moved, in shape order', () => {
    const { params } = shapesConfig.defaults();
    const moved = { ...params, ribbon: { ...params.ribbon, left: 'flat' }, square: { ...params.square, erosion: 0.5 } };
    expect(changedShapeParams(moved)).toEqual({ square: { erosion: 0.5 }, ribbon: { left: 'flat' } });
    expect(shapeParamsSnippet(moved)).toBe([
      '// New defaults for SHAPE_PARAMS:',
      'square: {',
      '  erosion: 0.5,',
      '},',
      'ribbon: {',
      '  left: "flat",',
      '},',
    ].join('\n'));
  });
});
