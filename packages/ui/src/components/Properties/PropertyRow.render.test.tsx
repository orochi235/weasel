import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropertyRow } from './PropertyRow';
import s from './Properties.module.css';

describe('PropertyRow', () => {
  it('renders label and optional readout', () => {
    render(
      <PropertyRow label="Opacity" readout="0.65">
        <input type="range" defaultValue={50} />
      </PropertyRow>,
    );
    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('0.65')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    const { container } = render(
      <PropertyRow label="L" variant="color">
        <input type="color" defaultValue="#fff" />
      </PropertyRow>,
    );
    expect(container.querySelector(`.${s.rowColor}`)).not.toBeNull();
  });

  it('spans the grid when span is set', () => {
    const { container, rerender } = render(
      <PropertyRow label="L" span>
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(container.querySelector(`.${s.row}`)).toHaveClass(s.span);
    rerender(
      <PropertyRow label="L">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(container.querySelector(`.${s.row}`)).not.toHaveClass(s.span);
  });
});
