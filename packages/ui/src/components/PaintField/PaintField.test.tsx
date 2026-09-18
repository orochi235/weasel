import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FillStyle } from '@weasel-js/core';
import { PaintField } from './PaintField';

const GRADIENT: FillStyle = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  stops: [
    { offset: 0, color: '#ff0000ff' },
    { offset: 1, color: '#0000ffff' },
  ],
  units: 'bounds',
};

describe('PaintField', () => {
  it('names the kind it is holding, so a closed field still says what it is', () => {
    render(<PaintField value={GRADIENT} onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByRole('button', { name: /Fill/ })).toHaveTextContent('Linear');
  });

  it('opens the whole paint editor, not a color input', () => {
    render(<PaintField value={GRADIENT} onChange={() => {}} aria-label="Fill" />);
    fireEvent.click(screen.getByRole('button', { name: /Fill/ }));
    expect(screen.getByLabelText('Stop 1 at 0%')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Radial' })).toBeInTheDocument();
  });

  it('keeps a gradient a gradient when a stop is recolored', () => {
    const onChange = vi.fn();
    render(<PaintField value={GRADIENT} onChange={onChange} aria-label="Fill" />);
    fireEvent.click(screen.getByRole('button', { name: /Fill/ }));
    const swatch = screen.getByLabelText('Stop 1 at 0%');
    fireEvent.input(swatch, { target: { value: '#00ff00' } });
    fireEvent.blur(swatch);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      stops: [
        { offset: 0, color: '#00ff00ff' },
        { offset: 1, color: '#0000ffff' },
      ],
    });
  });

  it('says so when the paint is mixed across a selection', () => {
    render(<PaintField value={undefined} mixed onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByRole('button', { name: /Fill/ })).toHaveTextContent('Mixed');
  });

  it('says so when there is no paint at all', () => {
    render(<PaintField value={null} onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByRole('button', { name: /Fill/ })).toHaveTextContent('None');
  });
});
