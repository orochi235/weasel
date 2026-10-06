import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { StatusBar, StatusBarItem, StatusBarSpacer } from './StatusBar';

// Borders and overflow are computed style, which jsdom's class proxy cannot show.

afterEach(cleanup);

const borderLeft = (text: string): string => getComputedStyle(screen.getByText(text)).borderLeftStyle;

test('a divided bar draws a hairline between neighbors, and none across a spacer', () => {
  render(
    <StatusBar divided>
      <StatusBarItem>A</StatusBarItem>
      <StatusBarItem>B</StatusBarItem>
      <StatusBarSpacer />
      <StatusBarItem>C</StatusBarItem>
    </StatusBar>,
  );
  expect(borderLeft('A')).toBe('none');
  expect(borderLeft('B')).toBe('solid');
  expect(borderLeft('C')).toBe('none');
});

test('an undivided bar draws none', () => {
  render(
    <StatusBar>
      <StatusBarItem>A</StatusBarItem>
      <StatusBarItem>B</StatusBarItem>
    </StatusBar>,
  );
  expect(borderLeft('B')).toBe('none');
});

test('a bar too narrow for its readouts clips them rather than spilling past its edge', () => {
  const { container } = render(
    <div className="host">
      <StatusBar>
        {Array.from({ length: 12 }, (_, i) => (
          <StatusBarItem key={i}>{`readout number ${i}`}</StatusBarItem>
        ))}
      </StatusBar>
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
