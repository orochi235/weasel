import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SHAPES } from './index';
import { withDefaults } from './params';
import { BADGE_SHAPES } from '../catalog';

describe('withDefaults', () => {
  it('keeps the default for a key set to undefined', () => {
    expect(withDefaults({ a: 1, b: 2 }, { a: undefined, b: 3 })).toEqual({ a: 1, b: 3 });
  });
});

describe('a shape param set to undefined', () => {
  for (const name of BADGE_SHAPES) {
    const m = SHAPES[name];
    const defaults = m.defaults as Record<string, unknown> | undefined;
    if (!defaults || Object.keys(defaults).length === 0) continue;
    const unset = Object.fromEntries(Object.keys(defaults).map((k) => [k, undefined]));
    it(`${name} draws what its defaults draw`, () => {
      if (m.compose) {
        expect(m.compose(unset as never)).toEqual(m.compose(defaults as never));
      }
      if (m.Component) {
        const C = m.Component;
        const draw = (params: unknown) => render(
          <svg viewBox="0 0 100 100"><C variant="solid" focused params={params as never} phase={0} /></svg>,
        ).container.innerHTML.replace(/_r_[\w]+_|«r\w+»|:r\w+:/g, '');
        expect(draw(unset)).toBe(draw(defaults));
      }
    });
  }
});
