import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Legend } from './Legend';

const entries = [
  { key: 'contour', label: 'contour', color: '#7d7f86' },
  { key: 'floor', label: 'bend floor', color: '#9a9ca3', mark: 'dash' as const },
  { key: 'authored', label: 'authored', color: '#2aa87a', mark: 'dot' as const },
  { key: 'replaced', label: 'replaced', color: 'rgba(255,107,96,.28)', mark: 'band' as const },
];

describe('Legend', () => {
  it('renders one row per entry', () => {
    const { container } = render(<Legend entries={entries} />);
    expect(container.querySelectorAll('.lk-legend__row')).toHaveLength(4);
  });

  it('shows every label as text', () => {
    render(<Legend entries={entries} />);
    for (const e of entries) expect(screen.getByText(e.label)).toBeInTheDocument();
  });

  it('marks each swatch with its shape, defaulting to a line', () => {
    const { container } = render(<Legend entries={entries} />);
    const swatches = container.querySelectorAll('.lk-legend__swatch');
    expect(swatches[0]?.className).toContain('lk-legend__swatch--line');
    expect(swatches[1]?.className).toContain('lk-legend__swatch--dash');
    expect(swatches[2]?.className).toContain('lk-legend__swatch--dot');
    expect(swatches[3]?.className).toContain('lk-legend__swatch--band');
  });

  it('hides swatches from assistive tech, leaving the label to carry meaning', () => {
    const { container } = render(<Legend entries={entries} />);
    for (const s of container.querySelectorAll('.lk-legend__swatch')) {
      expect(s.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('takes its color from the entry', () => {
    const { container } = render(
      <Legend entries={[{ key: 'contour', label: 'contour', color: '#7d7f86' }]} />,
    );
    const swatch = container.querySelector('.lk-legend__swatch') as HTMLElement;
    expect(swatch.style.getPropertyValue('--lk-legend-ink')).toBe('#7d7f86');
  });

  it('renders nothing but an empty list for no entries', () => {
    const { container } = render(<Legend entries={[]} />);
    expect(container.querySelectorAll('.lk-legend__row')).toHaveLength(0);
    expect(container.querySelector('.lk-legend')).toBeInTheDocument();
  });

  it('accepts an extra class name', () => {
    const { container } = render(<Legend entries={[]} className="is-mine" />);
    expect(container.querySelector('.lk-legend')?.className).toContain('is-mine');
  });
});
