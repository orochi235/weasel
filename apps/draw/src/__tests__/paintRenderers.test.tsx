import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ActionsProvider } from '@weasel-js/core';
import type { PropertyRenderContext } from '@weasel-js/ui';
import { WD_RENDERERS } from '../App';

/** The schema's own `data.stroke.paint` leaf: a `paint` leaf, so its default
 *  is a whole `FillStyle` and not a color string. */
const STROKE_PAINT_LEAF = {
  kind: 'paint',
  name: 'Color',
  default: { fill: 'solid', color: '#000000ff' },
  alpha: true,
} as unknown as PropertyRenderContext['pref'];

function ctxWith(value: unknown): PropertyRenderContext {
  return {
    path: 'data.stroke.paint',
    pref: STROKE_PAINT_LEAF,
    value,
    mixed: false,
    unset: value === undefined,
    setValue: () => {},
    valueAt: () => ({ value: undefined, mixed: false, unset: true }),
  } as unknown as PropertyRenderContext;
}

const GRADIENT = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  units: 'bounds',
  stops: [{ offset: 0, color: '#ff0000ff' }, { offset: 1, color: '#0000ffff' }],
};

function colorInputValue(value: unknown): string | undefined {
  const { container } = render(
    <ActionsProvider>{WD_RENDERERS['data.stroke.paint'](ctxWith(value))}</ActionsProvider>,
  );
  return container.querySelector<HTMLInputElement>('input[type="color"]')?.value;
}

describe("WeaselDraw's data.stroke.paint renderer", () => {
  // A gradient stroke, and a node with no stroke at all, both leave the leaf
  // with no single color. Falling back to the schema default — a FillStyle —
  // handed the color input an object and threw the panel away.
  it.each([
    ['a gradient stroke', GRADIENT, '#000000'],
    ['no stroke', undefined, '#000000'],
    ['a solid stroke', { fill: 'solid', color: '#123456ff' }, '#123456'],
  ])('shows a color for %s', (_label, value, expected) => {
    expect(colorInputValue(value)).toBe(expected);
  });
});
