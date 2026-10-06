import '@weasel-js/theme/tokens.css';
import './index.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

// A cell's box is layout, which jsdom does not compute.

afterEach(cleanup);

function cell(layout: 'padded' | 'centered', specimenHeight: number) {
  const { container } = render(
    <figure className={`fg-index-cell fg-index-cell--${layout}`}>
      <div className="fg-index-cell__stage">
        <div className="specimen" style={{ width: 120, height: specimenHeight }} />
      </div>
    </figure>,
  );
  const stage = container.querySelector<HTMLElement>('.fg-index-cell__stage') as HTMLElement;
  const specimen = container.querySelector<HTMLElement>('.specimen') as HTMLElement;
  return { stage: stage.getBoundingClientRect(), specimen: specimen.getBoundingClientRect(), style: getComputedStyle(stage) };
}

test('a padded cell hugs a short specimen, with no room left under it', () => {
  const { stage, specimen, style } = cell('padded', 40);
  const below = stage.bottom - specimen.bottom;
  expect(below).toBeCloseTo(parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth), 1);
});

test('a centered cell keeps its minimum and centers a short specimen in it', () => {
  const { stage, specimen } = cell('centered', 40);
  expect(stage.height).toBeGreaterThanOrEqual(96);
  expect(Math.abs(specimen.top - stage.top - (stage.bottom - specimen.bottom))).toBeLessThanOrEqual(1);
});
