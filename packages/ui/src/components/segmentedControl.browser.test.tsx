import '@weasel-js/theme/tokens.css';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { ButtonBar } from './ButtonBar/ButtonBar';
import { OptionsBar } from './OptionsBar/OptionsBar';
import { ToggleBar } from './ToggleBar/ToggleBar';

// ButtonBar and OptionsBar share segmentedControl.module.css; ToggleBar has its
// own copy, with the same checks in ToggleBar.browser.test.tsx.

afterEach(cleanup);

const LABELS = ['Tree', 'Components', 'Gallery'] as const;

function Glyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
      <rect width={14} height={14} />
    </svg>
  );
}

type Bar = 'ButtonBar' | 'OptionsBar';
type Seg = { label: ReactNode; ariaLabel?: string; tooltip?: string };
type Opts = { variant?: 'default' | 'minimal'; height?: number };

function Bar({ bar, segs, variant, height }: { bar: Bar; segs: readonly Seg[] } & Opts) {
  if (bar === 'ButtonBar') {
    return (
      <ButtonBar
        ariaLabel="Bar"
        variant={variant}
        height={height}
        items={segs.map((sg, i) => ({ value: String(i), ...sg, onAction: () => {} }))}
      />
    );
  }
  return (
    <OptionsBar
      ariaLabel="Bar"
      variant={variant}
      height={height}
      items={segs.map((sg, i) => ({
        value: String(i),
        label: sg.label,
        ariaLabel: sg.ariaLabel,
        selected: i === 0,
        onChange: () => {},
      }))}
    />
  );
}

const TEXT = LABELS.map((l) => ({ label: l }));

describe.each(['ButtonBar', 'OptionsBar'] as const)('%s', (bar) => {
  // A bar beside a greedy sibling in a narrow flex row must keep its labels
  // whole: the row takes width from the sibling, never from the segments.
  test.each(['default', 'minimal'] as const)('a squeezed %s bar keeps its text segments whole', (variant) => {
    render(
      <div style={{ display: 'flex', width: 120 }}>
        <input style={{ flex: 1 }} />
        <Bar bar={bar} segs={TEXT} variant={variant} />
      </div>,
    );
    for (const seg of screen.getAllByRole('button')) {
      expect(seg.clientWidth).toBeGreaterThan(0);
      expect(seg.scrollWidth).toBeLessThanOrEqual(seg.clientWidth);
    }
  });

  test('an icon segment pads its glyph by 5px a side, as ToggleBar does', () => {
    render(<Bar bar={bar} segs={[{ label: <Glyph />, ariaLabel: 'A' }, { label: <Glyph />, ariaLabel: 'B' }]} />);
    for (const seg of screen.getAllByRole('button')) {
      const glyph = seg.querySelector('svg')!.getBoundingClientRect();
      expect(seg.getBoundingClientRect().width - glyph.width).toBeCloseTo(10, 0);
    }
  });

  test('`height` sizes the bar the way it sizes a ToggleBar', () => {
    render(
      <>
        <Bar bar={bar} segs={TEXT} height={40} />
        <ToggleBar ariaLabel="Toggle" items={TEXT.map((t) => ({ value: t.label, label: t.label }))} value={null} onChange={() => {}} height={40} />
      </>,
    );
    const root = screen.getByRole(bar === 'ButtonBar' ? 'toolbar' : 'group', { name: 'Bar' });
    const toggle = screen.getByRole('radiogroup', { name: 'Toggle' });
    expect(toggle.getBoundingClientRect().height).toBeGreaterThan(40 - 1);
    expect(root.getBoundingClientRect().height).toBe(toggle.getBoundingClientRect().height);
  });
});

// Only ButtonBar takes tooltips.
test('ButtonBar rounds its end caps when tooltips wrap the end segments', () => {
  render(<Bar bar="ButtonBar" segs={LABELS.map((l) => ({ label: l, tooltip: `${l} tip` }))} />);
  const segs = screen.getAllByRole('button');
  expect(parseFloat(getComputedStyle(segs[0]).borderTopLeftRadius)).toBeGreaterThan(0);
  expect(parseFloat(getComputedStyle(segs[segs.length - 1]).borderTopRightRadius)).toBeGreaterThan(0);
});
