import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';
import { ICON_PATHS, type IconName } from './paths';

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
});
