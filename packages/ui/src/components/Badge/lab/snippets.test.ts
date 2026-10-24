import { describe, expect, it } from 'vitest';
import { changedShapeParams, composeSnippet, defaultShapeParams, shapeParamsSnippet } from './snippets';

describe('composeSnippet', () => {
  it('writes the base, its params, each effect, and the appearance props', () => {
    const text = composeSnippet({
      base: 'rounded-rect',
      baseParams: { erosion: 0.5, mode: 'x' },
      labEffects: [{ id: 1, type: 'outline', params: { width: 1, color: '#ff0000', dash: '' } }],
      look: 'high', tint: '#000', variant: 'solid', size: 'sm', bloat: 0, crawlOn: false, crawlSpeed: 0.2, label: 'HI',
    });
    expect(text).toBe([
      '<Badge',
      '  base="rounded-rect"',
      '  baseParams={{ erosion: 0.5, mode: "x" }}',
      '  effects={[',
      '    { type: "outline", params: { width: 1, color: cssColorLiteral("#ff0000"), dash: "" } },',
      '  ]}',
      '  emphasis="high" variant="solid" size="sm"',
      '>HI</Badge>',
    ].join('\n'));
  });

  it('leaves out empty params and effects, and adds bloat and crawl only when set', () => {
    const text = composeSnippet({
      base: 'polygon', baseParams: {}, labEffects: [],
      look: 'info', tint: '#000', variant: 'outline', size: 'md', bloat: 2, crawlOn: true, crawlSpeed: 0.5, label: 'X',
    });
    expect(text).toBe([
      '<Badge',
      '  base="polygon"',
      '  grade="info" variant="outline" size="md"',
      '  bloat={2}',
      '  crawl={0.5}',
      '>X</Badge>',
    ].join('\n'));
  });
});

describe('shape params', () => {
  it('reports nothing while every shape sits at its defaults', () => {
    expect(changedShapeParams(defaultShapeParams())).toEqual({});
    expect(shapeParamsSnippet(defaultShapeParams())).toBe('// (no changes from defaults)');
  });

  it('lists only the params that moved, in shape order', () => {
    const all = defaultShapeParams();
    all.ribbon = { ...all.ribbon, left: 'flat' };
    all.square = { ...all.square, erosion: 0.5 };
    expect(changedShapeParams(all)).toEqual({ square: { erosion: 0.5 }, ribbon: { left: 'flat' } });
    expect(shapeParamsSnippet(all)).toBe([
      '// Drop into SHAPE_CONTROLS as new defaults:',
      'square: {',
      '  erosion: 0.5,',
      '},',
      'ribbon: {',
      '  left: "flat",',
      '},',
    ].join('\n'));
  });
});
