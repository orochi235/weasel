import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { BarField } from './BarField';
import { useStoryFields } from './barStoryFields';

// Whether a cell fits the bar and sits on its line is layout, which jsdom does not do.

afterEach(cleanup);

const BAR = 32;

beforeAll(() => {
  const style = document.createElement('style');
  // The bar these cells are sized for: a toolbar's height, its cells centered on one line.
  style.textContent = [
    `.strip { display: flex; align-items: center; gap: 12px; height: ${BAR}px; width: 4000px; }`,
    '.strip > span { display: flex; align-items: center; flex: none; }',
  ].join('\n');
  document.head.append(style);
});

function Strip() {
  return (
    <div data-testid="strip" className="strip">
      {useStoryFields().map(({ id, field }) => (
        <span key={id} data-cell={id}>
          <BarField {...field} />
        </span>
      ))}
    </div>
  );
}

test('every bar form fits the bar’s height and sits on its center line', () => {
  const { getByTestId } = render(<Strip />);
  const strip = getByTestId('strip').getBoundingClientRect();
  const center = strip.top + strip.height / 2;
  const cells = [...getByTestId('strip').querySelectorAll('[data-cell]')];
  expect(cells.length).toBeGreaterThan(10);
  for (const cell of cells) {
    const id = cell.getAttribute('data-cell');
    const box = cell.getBoundingClientRect();
    expect(box.width, `${id} has a width`).toBeGreaterThan(0);
    expect(box.height, `${id} fits the bar`).toBeLessThanOrEqual(BAR);
    expect(Math.abs(box.top + box.height / 2 - center), `${id} is centered`).toBeLessThanOrEqual(0.5);
  }
});

test('a number box in a bar is narrower than a text box', () => {
  const { getByTestId } = render(<Strip />);
  const width = (id: string) =>
    getByTestId('strip').querySelector(`[data-cell="${id}"] input[type="text"]`)!.getBoundingClientRect().width;
  expect(width('number')).toBeLessThan(width('string'));
  expect(width('number')).toBeLessThan(80);
});

test('no bar cell carries a class its stylesheet does not define', () => {
  const { getByTestId } = render(<Strip />);
  const named = [...getByTestId('strip').querySelectorAll('[class]')].map((el) => el.getAttribute('class')!);
  expect(named.filter((cls) => /\bundefined\b/.test(cls))).toEqual([]);
});
