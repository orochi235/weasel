import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { CurveEditor, type FillSettings } from './CurveEditor';

afterEach(cleanup);

function fillOf(fill: FillSettings): string {
  const { container } = render(
    <CurveEditor value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} onInput={() => {}} fill={fill} width={200} height={100} />,
  );
  return getComputedStyle(container.querySelector('[data-curve-element="fill"]')!).fill;
}

describe('CurveEditor fill', () => {
  test('paints the fill in the color it was given', () => {
    expect(fillOf({ side: 'below', color: 'rgb(255, 99, 71)' })).toBe('rgb(255, 99, 71)');
  });

  test('falls back to the theme fill when no color is given', () => {
    const themed = fillOf({ side: 'below' });
    expect(themed).not.toBe('rgb(255, 99, 71)');
    expect(themed).not.toBe('none');
  });
});
