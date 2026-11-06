import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { baselineOf } from '@weasel-js/react/testing/baselineOf';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Switch } from '@weasel-js/ui/components/Switch';

// Where a toggle's label reports its baseline is a layout question, so only a real browser can answer it.

afterEach(cleanup);

beforeAll(() => {
  const style = document.createElement('style');
  // A baseline row with a font size apart from the toggle's, so a row aligned on the control instead shows.
  style.textContent = '.baseline-row { display: flex; align-items: baseline; gap: 8px; font-size: 11px; }';
  document.head.append(style);
});

test.each([
  ['Switch', () => <Switch>Drawers</Switch>],
  ['Checkbox', () => <Checkbox>Drawers</Checkbox>],
])('a %s in a baseline row sits on its words’ baseline', (_, toggle) => {
  render(<div className="baseline-row"><span>Show</span>{toggle()}</div>);
  expect(Math.abs(baselineOf(screen.getByText('Drawers')) - baselineOf(screen.getByText('Show')))).toBeLessThan(0.5);
});

test('a Switch still centers its track on its words', () => {
  render(<Switch>Drawers</Switch>);
  const words = screen.getByText('Drawers').getBoundingClientRect();
  const track = screen.getByText('Drawers').previousElementSibling!.getBoundingClientRect();
  const mid = (r: DOMRect) => r.top + r.height / 2;
  expect(Math.abs(mid(track) - mid(words))).toBeLessThan(1);
});
