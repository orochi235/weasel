import '@weasel-js/theme/tokens.css';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';

// Every mode draws from segmentedControl.module.css; single mode's own states
// and its flat cells are measured in SegmentedBar.browser.test.tsx.

afterEach(cleanup);

const LABELS = ['Tree', 'Components', 'Gallery'] as const;

function Glyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
      <rect width={14} height={14} />
    </svg>
  );
}

type Mode = 'momentary' | 'each';
type Seg = { label: ReactNode; ariaLabel?: string; tooltip?: string };
type Opts = { variant?: 'default' | 'minimal' | 'flat'; height?: number };

function Bar({ mode, segs, variant, height }: { mode: Mode; segs: readonly Seg[] } & Opts) {
  if (mode === 'momentary') {
    return (
      <SegmentedBar
        mode="momentary"
        aria-label="Bar"
        variant={variant}
        height={height}
        items={segs.map((sg, i) => ({ value: String(i), ...sg, onAction: () => {} }))}
      />
    );
  }
  return (
    <SegmentedBar
      mode="each"
      aria-label="Bar"
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

describe.each(['momentary', 'each'] as const)('%s mode', (mode) => {
  // A bar beside a greedy sibling in a narrow flex row must keep its labels
  // whole: the row takes width from the sibling, never from the segments.
  test.each(['default', 'minimal', 'flat'] as const)('a squeezed %s bar keeps its text segments whole', (variant) => {
    render(
      <div style={{ display: 'flex', width: 120 }}>
        <input style={{ flex: 1 }} />
        <Bar mode={mode} segs={TEXT} variant={variant} />
      </div>,
    );
    for (const seg of screen.getAllByRole('button')) {
      expect(seg.clientWidth).toBeGreaterThan(0);
      expect(seg.scrollWidth).toBeLessThanOrEqual(seg.clientWidth);
    }
  });

  test('an icon segment pads its glyph by 5px a side, as single mode does', () => {
    render(<Bar mode={mode} segs={[{ label: <Glyph />, ariaLabel: 'A' }, { label: <Glyph />, ariaLabel: 'B' }]} />);
    for (const seg of screen.getAllByRole('button')) {
      const glyph = seg.querySelector('svg')!.getBoundingClientRect();
      expect(seg.getBoundingClientRect().width - glyph.width).toBeCloseTo(10, 0);
    }
  });

  test('`height` sizes the bar the way it sizes a single-mode bar', () => {
    render(
      <>
        <Bar mode={mode} segs={TEXT} height={40} />
        <SegmentedBar aria-label="Toggle" items={TEXT.map((t) => ({ value: t.label, label: t.label }))} value={null} onChange={() => {}} height={40} />
      </>,
    );
    const root = screen.getByRole(mode === 'momentary' ? 'toolbar' : 'group', { name: 'Bar' });
    const toggle = screen.getByRole('radiogroup', { name: 'Toggle' });
    expect(toggle.getBoundingClientRect().height).toBeGreaterThan(40 - 1);
    expect(root.getBoundingClientRect().height).toBe(toggle.getBoundingClientRect().height);
  });
});

test('a momentary bar rounds its end caps when tooltips wrap the end segments', () => {
  render(<Bar mode="momentary" segs={LABELS.map((l) => ({ label: l, tooltip: `${l} tip` }))} />);
  const segs = screen.getAllByRole('button');
  expect(parseFloat(getComputedStyle(segs[0]).borderTopLeftRadius)).toBeGreaterThan(0);
  expect(parseFloat(getComputedStyle(segs[segs.length - 1]).borderTopRightRadius)).toBeGreaterThan(0);
});

test('a minimal single-mode bar draws its segments as a minimal each-mode bar does', () => {
  render(
    <>
      <Bar mode="each" segs={TEXT} variant="minimal" />
      <SegmentedBar aria-label="Toggle" variant="minimal" items={TEXT.map((t) => ({ value: t.label, label: t.label }))} value="Tree" onChange={() => {}} />
    </>,
  );
  const look = (el: Element) => {
    const cs = getComputedStyle(el);
    return [cs.borderLeftWidth, cs.borderTopWidth, cs.borderTopLeftRadius, cs.paddingLeft, cs.columnGap, cs.color, cs.backgroundColor].join(' ');
  };
  const options = screen.getByRole('group', { name: 'Bar' });
  const toggle = screen.getByRole('radiogroup', { name: 'Toggle' });
  expect(look(toggle)).toBe(look(options));
  const optionSegs = [...options.querySelectorAll('button')];
  const toggleSegs = screen.getAllByRole('radio');
  toggleSegs.forEach((seg, i) => expect(look(seg), LABELS[i]).toBe(look(optionSegs[i])));
});
