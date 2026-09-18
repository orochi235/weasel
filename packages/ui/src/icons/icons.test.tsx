import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';
import { isFillable } from './Icon';
import { ICON_FILLS, ICON_GROUPS, ICON_PATHS, type IconName } from './paths';

const NAMES = Object.keys(ICON_PATHS) as IconName[];

describe('icon set', () => {
  it('renders every glyph with drawable content', () => {
    for (const name of NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 20 20');
      expect(svg?.children.length, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it('hides unlabeled glyphs from assistive tech and names labeled ones', () => {
    const { container: bare } = render(<Icon name="close" />);
    expect(bare.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    const { container: named } = render(<Icon name="close" label="Close trial" />);
    const svg = named.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('Close trial');
  });

  // Guards the emitter bug that fused `d="…"` to a following attribute.
  it('keeps every path element well formed', () => {
    for (const name of NAMES) {
      expect(ICON_PATHS[name], name).not.toMatch(/"[a-z-]+=/);
    }
  });

  it('files every glyph under exactly one group', () => {
    const grouped = ICON_GROUPS.flatMap((g) => g.names);
    expect([...grouped].sort()).toEqual([...NAMES].sort());
  });

  it('names a glyph for every fill', () => {
    for (const name of Object.keys(ICON_FILLS)) {
      expect(ICON_PATHS, name).toHaveProperty(name);
      expect(isFillable(name as IconName), name).toBe(true);
    }
  });

  it('draws the shade behind the stroke, and only when asked', () => {
    const { container: plain, unmount } = render(<Icon name="shapeHexagon" />);
    expect(plain.querySelectorAll('path')).toHaveLength(1);
    unmount();

    const { container } = render(<Icon name="shapeHexagon" filled />);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('fill')).toBe('currentColor');
    expect(paths[0]?.getAttribute('stroke')).toBe('none');
    expect(container.querySelector('svg')?.getAttribute('fill-opacity')).toBe('0.16');
  });

  // A curve with poles or an unbounded branch encloses nothing, so `filled` has to
  // be a no-op on it rather than an error — a caller sets it across a whole set.
  it('ignores filled on a glyph with no enclosed region', () => {
    expect(isFillable('curveTangent')).toBe(false);
    const { container } = render(<Icon name="curveTangent" filled />);
    expect(container.querySelector('svg')?.getAttribute('fill-opacity')).toBeNull();
  });

  it('marks the glyphs whose corners must stay points', () => {
    expect(ICON_PATHS.shapePentagram).toContain('stroke-linejoin="miter"');
    expect(ICON_PATHS.shapeCircle).not.toContain('stroke-linejoin');
    // A waveform's acute corners grow spikes under miter, so they stay round.
    expect(ICON_PATHS.arcZigzag).not.toContain('stroke-linejoin');
  });
});
