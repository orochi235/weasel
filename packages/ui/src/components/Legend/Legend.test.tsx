import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Legend } from './Legend';

const entries = [
  { key: 'contour', label: 'contour', color: '#7d7f86' },
  { key: 'floor', label: 'bend floor', color: '#9a9ca3', mark: 'dash' as const },
  { key: 'authored', label: 'authored', color: '#2aa87a', mark: 'dot' as const },
  { key: 'replaced', label: 'replaced', color: 'rgba(255,107,96,.28)', mark: 'band' as const },
];

const swatches = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('li > [aria-hidden]')];

describe('Legend', () => {
  it('renders one list item per entry', () => {
    render(<Legend entries={entries} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows every label as text', () => {
    render(<Legend entries={entries} />);
    for (const e of entries) expect(screen.getByText(e.label)).toBeInTheDocument();
  });

  it('marks each swatch with its shape, defaulting to a line', () => {
    const { container } = render(<Legend entries={entries} />);
    expect(swatches(container).map((s) => s.dataset.mark)).toEqual(['line', 'dash', 'dot', 'band']);
  });

  it('hides swatches from assistive tech, leaving the label to carry meaning', () => {
    const { container } = render(<Legend entries={entries} />);
    expect(swatches(container)).toHaveLength(4);
    for (const s of swatches(container)) expect(s.getAttribute('aria-hidden')).toBe('true');
  });

  it('takes its color from the entry', () => {
    const { container } = render(<Legend entries={[{ key: 'contour', label: 'contour', color: '#7d7f86' }]} />);
    expect(swatches(container)[0].style.getPropertyValue('--legend-ink')).toBe('#7d7f86');
  });

  it('renders an empty list for no entries', () => {
    render(<Legend entries={[]} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('accepts an extra class name', () => {
    render(<Legend entries={[]} className="is-mine" />);
    expect(screen.getByRole('list').className).toContain('is-mine');
  });
});
