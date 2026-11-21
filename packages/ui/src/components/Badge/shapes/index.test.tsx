import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BADGE_SHAPES } from '../catalog';
import { SHAPES } from './index';
import { BASES } from '../bases';
import { EFFECTS } from '../effects';
import { Badge } from '../Badge';

describe('shape registry', () => {
  it('each shape entry has Component or compose, plus insets + stretches', () => {
    for (const name of BADGE_SHAPES) {
      const m = SHAPES[name];
      // A shape must provide either a legacy Component or a compose() spec.
      expect(Boolean(m.Component) || Boolean(m.compose)).toBe(true);
      const insets = typeof m.insets === 'function' ? m.insets({}) : m.insets;
      expect(insets).toMatchObject({ top: expect.any(Number), right: expect.any(Number), bottom: expect.any(Number), left: expect.any(Number) });
      expect(typeof m.stretches).toBe('boolean');
    }
  });
});

describe('every shape renders at least one geometry element', () => {
  for (const name of BADGE_SHAPES) {
    const m = SHAPES[name];
    if (m.renderMode === 'css') continue;
    // Compose-mode shapes render through the base/effects pipeline, which needs the full Badge.
    if (!m.Component) continue;
    const Component = m.Component;
    const defaults = m.defaults;
    it(`${name} renders content for outline variant`, () => {
      const { container } = render(
        <svg viewBox="0 0 100 100">
          <Component variant="outline" focused={false} params={defaults ?? {}} phase={0} />
        </svg>,
      );
      const geom = container.querySelectorAll('rect, circle, path, polygon, ellipse, line');
      expect(geom.length).toBeGreaterThan(0);
    });
  }
});

describe('a shape name the registry does not hold', () => {
  for (const name of ['constructor', 'toString', 'hasOwnProperty', 'nope']) {
    it(`${name} draws a pill`, () => {
      const { container } = render(<Badge shape={name as never}>x</Badge>);
      expect(container.querySelector('[data-shape]')?.getAttribute('data-shape')).toBe('pill');
    });
  }
  it('reads as no entry in the base and effect registries', () => {
    expect(BASES['constructor' as never]).toBeUndefined();
    expect(EFFECTS['toString' as never]).toBeUndefined();
  });
});
