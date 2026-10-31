import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Plot2D } from './Plot2D';

afterEach(cleanup);

test('grid and axes paint in the color they are given, over the stylesheet default', () => {
  const { container } = render(
    <Plot2D
      width={200}
      height={100}
      grid={{ color: { space: 'srgb', coords: [0, 1, 0] } }}
      axes={{ color: { space: 'srgb', coords: [1, 0, 0] } }}
    />,
  );
  const grid = container.querySelector('[data-plot-element="grid"]')!;
  const axis = container.querySelector('[data-plot-element="axis"]')!;
  expect(getComputedStyle(grid).stroke).toBe('rgb(0, 255, 0)');
  expect(getComputedStyle(axis).stroke).toBe('rgb(255, 0, 0)');
});

test('grid and axes keep the stylesheet default when no color is given', () => {
  const { container } = render(<Plot2D width={200} height={100} grid={{}} />);
  expect(getComputedStyle(container.querySelector('[data-plot-element="grid"]')!).stroke).not.toBe('none');
  expect(getComputedStyle(container.querySelector('[data-plot-element="axis"]')!).stroke).not.toBe('none');
});
