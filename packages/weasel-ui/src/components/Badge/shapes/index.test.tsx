import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SHAPES, ALL_SHAPES } from './index';

describe('shape registry', () => {
  it('lists every supported shape', () => {
    expect(ALL_SHAPES).toEqual([
      'pill', 'plain', 'square', 'notched', 'perforated',
      'hexagon',
      'starburst', 'scalloped', 'shield', 'ribbon', 'beavis',
      'sparkler', 'postage', 'cloud', 'house', 'plaque',
      'bat', 'crest', 'urn', 'coffin', 'receipt', 'wood', 'leaves',
    ]);
  });

  it('each shape entry has Component or compose, plus insets + stretches', () => {
    for (const name of ALL_SHAPES) {
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
  for (const name of ALL_SHAPES) {
    const m = SHAPES[name];
    if (m.renderMode === 'css') continue;
    // Compose-mode shapes render through the base/effects pipeline, which needs the full Badge.
    if (!m.Component) continue;
    it(`${name} renders content for outline variant`, () => {
      const { Component, defaults } = m;
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
