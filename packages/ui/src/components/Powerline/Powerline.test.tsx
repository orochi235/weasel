import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Powerline, type PowerlineSegment } from './Powerline';
import * as PkgRoot from '../../index';

function fills(segments: PowerlineSegment[]) {
  const { container, unmount } = render(<Powerline variant="solid" segments={segments} />);
  const ds = [...container.querySelectorAll('.badge-fill')].map((path) => path.getAttribute('d'));
  unmount();
  return ds;
}

describe('Powerline', () => {
  it('renders one element per segment', () => {
    const { container } = render(
      <Powerline
        segments={[
          { text: 'a' },
          { text: 'b' },
          { text: 'c' },
        ]}
      />
    );
    expect(container.querySelectorAll('[data-shape="compose"]').length).toBe(3);
  });

  it('threads endCap of segment N to leftEdge of segment N+1', () => {
    const [, afterChevron] = fills([{ text: 'a', endCap: 'chevron' }, { text: 'b' }]);
    const [, afterFlat] = fills([{ text: 'a' }, { text: 'b' }]);
    expect(afterChevron).toBeTruthy();
    expect(afterChevron).not.toBe(afterFlat);
  });

  it('applies row-level variant defaults and per-segment emphasis and grade', () => {
    const { container } = render(
      <Powerline
        variant="solid"
        segments={[
          { text: 'a', emphasis: 'high' },
          { text: 'b', grade: 'info' },
        ]}
      />
    );
    const badges = container.querySelectorAll('[data-variant]');
    expect(badges[0].getAttribute('data-emphasis')).toBe('high');
    expect(badges[1].getAttribute('data-grade')).toBe('info');
    expect(badges[0].getAttribute('data-variant')).toBe('solid');
  });

  it('passes each segment’s tint and stance to its badge', () => {
    const { container } = render(
      <Powerline segments={[{ text: 'a', grade: 'info', stance: 'debug', tint: 2 }, { text: 'b' }]} />,
    );
    const badges = container.querySelectorAll<HTMLElement>('[data-variant]');
    expect(badges[0].dataset.tint).toBe('2');
    expect(badges[0].dataset.stance).toBe('debug');
    expect(badges[1].hasAttribute('data-tint')).toBe(false);
  });

  it('draws a puzzle cap as a tab on its segment and a socket in the next', () => {
    const { container } = render(
      <Powerline variant="solid" segments={[{ text: 'a', endCap: 'puzzle' }, { text: 'b' }]} />,
    );
    const xs = [...container.querySelectorAll('.badge-fill')].map((path) =>
      [...(path.getAttribute('d') ?? '').matchAll(/[ML] (-?[\d.]+) /g)].map((m) => Number(m[1])),
    );
    expect(xs.length).toBe(2);
    expect(Math.max(...xs[0])).toBeGreaterThan(100);
    expect(xs[1].some((x) => x > 0 && x < 50)).toBe(true);
  });

  it('renders segment text content', () => {
    const { getByText } = render(
      <Powerline segments={[{ text: 'main' }, { text: '✓ 12' }]} />
    );
    expect(getByText('main')).toBeDefined();
    expect(getByText('✓ 12')).toBeDefined();
  });

  it('accepts a custom EdgeProfile function as a cap', () => {
    const custom = (t: number, d: number) => Math.sin(t * Math.PI * 4) * d * 0.5;
    const [capped] = fills([{ text: 'x', endCap: custom }, { text: 'y' }]);
    const [flat] = fills([{ text: 'x', endCap: 'flat' }, { text: 'y' }]);
    expect(capped).toBeTruthy();
    expect(capped).not.toBe(flat);
  });
});

describe('package root export', () => {
  it('re-exports Powerline from the package root', () => {
    expect(PkgRoot.Powerline).toBeDefined();
  });

  it('re-exports EDGE_PROFILES from the package root', () => {
    expect(PkgRoot.EDGE_PROFILES).toBeDefined();
    expect(typeof PkgRoot.EDGE_PROFILES.chevron).toBe('function');
  });
});
