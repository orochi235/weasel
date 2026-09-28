import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ToggleBar } from './ToggleBar';

// Adjacent flat segments overlap by a pixel to share one border, so which cell
// paints on top of the shared column is a question only real layout answers.

afterEach(cleanup);

const ITEMS = [
  { value: 'tree', label: 'Tree' },
  { value: 'components', label: 'Components' },
  { value: 'gallery', label: 'Gallery' },
] as const;

test.each(['tree', 'components', 'gallery'] as const)(
  'a selected flat segment keeps both side borders on top (%s)',
  (value) => {
    render(<ToggleBar ariaLabel="View" variant="flat" items={[...ITEMS]} value={value} onChange={() => {}} />);
    const selected = screen.getByRole('radio', { checked: true });
    const r = selected.getBoundingClientRect();
    const y = r.top + r.height / 2;
    for (const x of [r.left + 0.5, r.right - 0.5]) {
      const hit = document.elementFromPoint(x, y);
      expect(hit === selected || selected.contains(hit)).toBe(true);
    }
  },
);

// A bar beside a greedy sibling in a narrow flex row must keep its labels
// whole: the row takes width from the sibling, never from the segments.
test.each(['glass', 'flat', 'minimal'] as const)('a squeezed %s bar keeps its text segments whole', (variant) => {
  render(
    <div style={{ display: 'flex', width: 120 }}>
      <input style={{ flex: 1 }} />
      <ToggleBar
        ariaLabel="View"
        variant={variant === 'glass' ? undefined : variant}
        items={[...ITEMS]}
        value="tree"
        onChange={() => {}}
      />
    </div>,
  );
  for (const seg of screen.getAllByRole('radio')) {
    expect(seg.scrollWidth).toBeLessThanOrEqual(seg.clientWidth);
    expect(seg.clientWidth).toBeGreaterThan(0);
  }
});
