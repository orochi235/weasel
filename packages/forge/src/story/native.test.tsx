import { f } from '@weasel-js/labkit/config';
import { describe, expect, it } from 'vitest';
import { meta, story } from './define';
import { loadNativeModule } from './native';

describe('loadNativeModule', () => {
  const mod = {
    default: meta({ title: 'ui/Slider', layout: 'padded' }),
    Basic: story({
      config: f.schema({ value: f.number(50) }),
      state: (c) => ({ drags: 0, start: c.value }),
      render: ({ config }) => <p>{config.value}</p>,
    }),
    WithName: story({ name: 'Custom name', render: () => null, layout: 'fullscreen' }),
    helper: 42,
  };

  it('loads each branded story export', () => {
    const stories = loadNativeModule(mod, 'Slider');
    expect(stories.map((s) => [s.id, s.name, s.layout])).toEqual([
      ['ui-slider--basic', 'Basic', 'padded'],
      ['ui-slider--withname', 'Custom name', 'fullscreen'],
    ]);
  });

  it('gives a config-less story an empty schema and no initial state', () => {
    const [, second] = loadNativeModule(mod, 'Slider');
    expect(second?.config.defaults()).toEqual({});
    expect(second?.initialState).toBeNull();
  });

  it('titles its stories with the auto title when the meta names none', () => {
    const [only] = loadNativeModule(
      { default: meta({}), A: story({ render: () => null }) },
      'ui/Button',
    );
    expect(only?.title).toBe('ui/Button');
  });
});
