import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SHAPES, ALL_SHAPES } from './index';

describe('shape registry', () => {
  it('lists every supported shape', () => {
    expect(ALL_SHAPES).toEqual([
      'pill', 'square', 'notched', 'perforated',
      'diamond', 'dot', 'hexagon', 'chevron', 'banner',
      'starburst', 'scalloped', 'shield', 'ribbon',
    ]);
  });

  it('each shape entry has Component + insets + stretches', () => {
    for (const name of ALL_SHAPES) {
      const m = SHAPES[name];
      expect(m.Component).toBeDefined();
      expect(m.insets).toMatchObject({ top: expect.any(Number), right: expect.any(Number), bottom: expect.any(Number), left: expect.any(Number) });
      expect(typeof m.stretches).toBe('boolean');
    }
  });
});

describe('every shape renders at least one geometry element', () => {
  for (const name of ALL_SHAPES) {
    it(`${name} renders content for outline variant`, () => {
      const { Component } = SHAPES[name];
      const { container } = render(
        <svg viewBox="0 0 100 100">
          <Component variant="outline" focused={false} />
        </svg>,
      );
      const geom = container.querySelectorAll('rect, circle, path, polygon, ellipse, line');
      expect(geom.length).toBeGreaterThan(0);
    });
  }
});
