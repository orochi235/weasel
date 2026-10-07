import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/faces.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { PropertyField } from '../Properties/PropertyField';
import { ToggleBar } from '../ToggleBar';
import { ToolOptionsBar } from '../ToolOptionsBar';
import { FitLabel } from './FitLabel';

// Which form fits is a question about real widths, so only a browser answers it.

// Loaded rather than left to the system: without it the UI stack falls through
// to whatever sans the machine has, and CI's DejaVu Sans overflows the inline row.
beforeAll(() => document.fonts.load('16px Oswald'));

afterEach(cleanup);

const CASES = [
  { value: 'none', forms: ['None', '–'] },
  { value: 'upper', forms: ['Uppercase', 'Upper', 'AA'] },
  { value: 'lower', forms: ['Lowercase', 'Lower', 'aa'] },
] as const;

/** Each label's form at `step`, the last one where it has fewer. */
const tier = (step: number) => CASES.map((c) => c.forms[Math.min(step, c.forms.length - 1)]!);

const frames = () =>
  new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

function FitBar() {
  return (
    <ToggleBar
      ariaLabel="Case"
      items={CASES.map((c) => ({ value: c.value, label: <FitLabel forms={c.forms} />, ariaLabel: c.forms[0] }))}
      value="none"
      onChange={() => {}}
    />
  );
}

/** How wide the bar is when every label shows its form at `step`. */
function widthAt(step: number): number {
  const labels = tier(step);
  const { unmount } = render(
    <ToggleBar
      ariaLabel="Probe"
      items={CASES.map((c, i) => ({ value: c.value, label: labels[i] }))}
      value="none"
      onChange={() => {}}
    />,
  );
  const width = screen.getByRole('radiogroup', { name: 'Probe' }).getBoundingClientRect().width;
  unmount();
  return width;
}

const shown = () => screen.getAllByRole('radio').map((r) => r.textContent);

test.each([0, 1, 2])('a bar in a room just wide enough for step %i shows that step', (step) => {
  const room = Math.ceil(widthAt(step)) + 1;
  render(
    <div style={{ width: room }}>
      <FitBar />
    </div>,
  );
  expect(shown()).toEqual(tier(step));
});

test('the accessible name stays the full one at every width', () => {
  render(
    <div style={{ width: Math.ceil(widthAt(2)) + 1 }}>
      <FitBar />
    </div>,
  );
  expect(screen.getByRole('radio', { name: 'Uppercase' }).textContent).toBe('AA');
});

test('a room that grows back takes the longer forms again', async () => {
  const narrow = Math.ceil(widthAt(2)) + 1;
  const { rerender } = render(
    <div style={{ width: narrow }}>
      <FitBar />
    </div>,
  );
  expect(shown()).toEqual(tier(2));
  rerender(
    <div style={{ width: 600 }}>
      <FitBar />
    </div>,
  );
  await frames();
  expect(shown()).toEqual(tier(0));
  rerender(
    <div style={{ width: narrow }}>
      <FitBar />
    </div>,
  );
  await frames();
  expect(shown()).toEqual(tier(2));
});

const OPTIONS = CASES.map((c) => ({ value: c.value, label: c.forms[0], short: c.forms.slice(1) }));

test.each(['block', 'inline'] as const)('a %s enum toggle row shortens its segments to fit', (layout) => {
  render(
    <div style={{ width: layout === 'inline' ? 130 : 110 }}>
      <PropertyField
        kind="enum"
        control="toggle"
        label="Case"
        layout={layout}
        value="none"
        options={OPTIONS}
        onChange={() => {}}
      />
    </div>,
  );
  expect(shown()).toEqual(tier(2));
  const bar = screen.getByRole('radiogroup', { name: 'Case' });
  expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
});

test('a wide enum toggle row keeps its full labels', () => {
  render(
    <div style={{ width: 600 }}>
      <PropertyField kind="enum" control="toggle" label="Case" value="none" options={OPTIONS} onChange={() => {}} />
    </div>,
  );
  expect(shown()).toEqual(tier(0));
});

const BAR_SCHEMA: ToolPrefGroup = {
  name: 'Text',
  children: {
    tracking: {
      kind: 'number',
      name: 'Tracking',
      short: ['Track', 'VA'],
      description: 'Letter spacing.',
      default: 0,
    },
    bold: {
      kind: 'boolean',
      name: 'Bold',
      short: ['B'],
      description: 'Heavier weight.',
      control: 'toggle',
      pair: 'Style',
      default: false,
    },
    italic: {
      kind: 'boolean',
      name: 'Italic',
      short: ['I'],
      description: 'Sloped face.',
      control: 'toggle',
      pair: 'Style',
      default: false,
    },
  },
};

function renderBar(width: number) {
  return render(
    <div style={{ width }}>
      <ToolOptionsBar label="Text" schema={BAR_SCHEMA} values={{}} onChange={() => {}} />
    </div>,
  );
}

test('a wide tool options bar shows every full name', () => {
  renderBar(900);
  expect(screen.getByRole('toolbar').textContent).toContain('Tracking');
  expect(screen.getByRole('button', { name: 'Bold' }).textContent).toBe('Bold');
});

test('a narrow tool options bar steps its labels and its flags down together', () => {
  renderBar(150);
  const text = screen.getByRole('toolbar').textContent;
  expect(text).toContain('VA');
  expect(text).not.toContain('Track');
  expect(screen.getByRole('button', { name: 'Bold' }).textContent).toBe('B');
  expect(screen.getByRole('button', { name: 'Italic' }).textContent).toBe('I');
});
