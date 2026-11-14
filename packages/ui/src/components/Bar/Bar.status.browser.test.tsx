import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Bar } from '@weasel-js/ui/components/Bar';

// Borders and overflow are computed style, which jsdom's class proxy cannot show.

afterEach(cleanup);

test('a divided strip draws a hairline between neighbors, and none across a spacer', () => {
  const { container } = render(
    <Bar framed="status" divided>
      <Bar.Readout>A</Bar.Readout>
      <Bar.Readout>B</Bar.Readout>
      <Bar.Spacer />
      <Bar.Readout>C</Bar.Readout>
    </Bar>,
  );
  const rules = container.querySelectorAll<HTMLElement>('[role="separator"]');
  expect(rules).toHaveLength(1);
  expect(rules[0]!.getBoundingClientRect().width).toBe(1);
});

test('a status strip too narrow for its readouts clips them rather than spilling past its edge', () => {
  const { container } = render(
    <div className="host">
      <Bar framed="status">
        {Array.from({ length: 12 }, (_, i) => (
          <Bar.Readout key={i}>{`readout number ${i}`}</Bar.Readout>
        ))}
      </Bar>
    </div>,
  );
  const host = container.querySelector<HTMLElement>('.host') as HTMLElement;
  host.style.width = '200px';
  const bar = container.querySelector('footer') as HTMLElement;
  expect(bar.scrollWidth).toBeGreaterThan(bar.clientWidth);
  // What lies past the edge is hidden, not painted over whatever is beside the bar.
  expect(getComputedStyle(bar).overflowX).toBe('hidden');
  expect(bar.getBoundingClientRect().width).toBeLessThanOrEqual(200);
});

test('a titled readout shows the help cursor, and a plain one does not', () => {
  render(
    <Bar framed="status">
      <Bar.Readout>plain</Bar.Readout>
      <Bar.Readout title="full detail">short</Bar.Readout>
    </Bar>,
  );
  expect(getComputedStyle(screen.getByText('short')).cursor).toBe('help');
  expect(getComputedStyle(screen.getByText('plain')).cursor).not.toBe('help');
});
