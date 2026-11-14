import { describe, expect, it } from 'vitest';
import { addEffect } from '../effects';
import { type ComposeConfig, composeConfig, composedBaseParams, composedPadding } from './composeConfig';
import { LAB_PRESETS, presetShape } from './presets';
import { composeSnippet } from './snippet';

const defaults = (): ComposeConfig => composeConfig.defaults();

describe('the compose config', () => {
  it('opens on a bare rounded rect at its defaults', () => {
    const { shape } = defaults();
    expect(shape.base).toBe('rounded-rect');
    expect(shape.effects).toEqual([]);
    expect(composedBaseParams(shape)).toEqual({ erosion: 0.16, eccentricity: 1, pinch: 0 });
  });

  it("spreads a spline base's curve among its other params, and drops the headings", () => {
    const params = composedBaseParams({ ...defaults().shape, base: 'octant-bspline' });
    expect(params).toMatchObject({ mode: 'octant', count: 5, s1: 0.25, r0: 48, rotation: 0, samples: 192 });
    expect(Object.keys(params)).not.toContain('curve');
    expect(Object.keys(params)).not.toContain('__advanced__');
  });

  it('pads a linked axis by its leading side', () => {
    const padding = { top: 1, right: 9, bottom: 9, left: 6, linkX: true, linkY: true };
    expect(composedPadding(padding)).toBe('1px 6px 1px 6px');
    expect(composedPadding({ ...padding, linkX: false, linkY: false })).toBe('1px 9px 9px 6px');
  });
});

describe('presets', () => {
  it("load a base's params over its defaults and number their effects from one", () => {
    const rough = presetShape(LAB_PRESETS.find((p) => p.name === 'rough')!);
    expect(rough.base).toBe('rounded-rect');
    expect(rough.params['rounded-rect']).toMatchObject({ erosion: 0.4, eccentricity: 1 });
    expect(rough.effects.map((e) => [e.id, e.type, e.params.irregularity])).toEqual([[1, 'bites', 0.6], [2, 'spikes', 0.5]]);
  });

  it('keep every other base at its defaults', () => {
    const hexagon = presetShape(LAB_PRESETS.find((p) => p.name === 'hexagon')!);
    expect(hexagon.params['rounded-rect']).toEqual(defaults().shape.params['rounded-rect']);
    expect(composedBaseParams(hexagon)).toEqual({ vertices: [[50, 0], [100, 25], [100, 75], [50, 100], [0, 75], [0, 25]] });
  });
});

describe('composeSnippet', () => {
  it('writes the base, its params, each effect that is on, and the appearance props', () => {
    const config = defaults();
    const [outline] = addEffect([], 'outline');
    const text = composeSnippet({
      shape: {
        ...config.shape,
        effects: [
          { ...outline!, params: { width: 1, color: '#ff0000', dash: '' } },
          { ...outline!, id: 2, on: false },
        ],
      },
      look: { ...config.look, label: 'HI' },
    });
    expect(text).toBe([
      '<Badge',
      '  base="rounded-rect"',
      '  baseParams={{ erosion: 0.16, eccentricity: 1, pinch: 0 }}',
      '  effects={[',
      '    { type: "outline", params: { width: 1, color: cssColorLiteral("#ff0000"), dash: "" } },',
      '  ]}',
      '  emphasis="high" variant="solid" size="sm"',
      '>HI</Badge>',
    ].join('\n'));
  });

  it('adds bloat and crawl only when set', () => {
    const config = defaults();
    const text = composeSnippet({
      shape: { ...config.shape, base: 'polygon' },
      look: { ...config.look, look: 'info', variant: 'outline', size: 'md', bloat: 2, crawl: true, crawlSpeed: 0.5, label: 'X' },
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
