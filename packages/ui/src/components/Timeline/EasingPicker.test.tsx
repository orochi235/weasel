import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { EasingPicker } from './EasingPicker';

describe('EasingPicker', () => {
  it('shows linear when there is no easing', () => {
    render(<EasingPicker value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText(/easing/i)).toHaveValue('linear');
  });

  it('shows the name of a named easing', () => {
    render(<EasingPicker value="easeOutBack" onChange={() => {}} />);
    expect(screen.getByLabelText(/easing/i)).toHaveValue('easeOutBack');
  });

  it('offers every built-in name', () => {
    render(<EasingPicker value={undefined} onChange={() => {}} />);
    expect(screen.getByRole('option', { name: 'easeInOutCubic' })).toBeInTheDocument();
  });

  it('writes a name when one is chosen', () => {
    const onChange = vi.fn();
    render(<EasingPicker value={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/easing/i), { target: { value: 'easeOutBack' } });
    expect(onChange).toHaveBeenCalledWith('easeOutBack');
  });

  it('clears the easing when linear is chosen', () => {
    const onChange = vi.fn();
    render(<EasingPicker value="easeOutBack" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/easing/i), { target: { value: 'linear' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows a bezier spec as a custom entry rather than a name', () => {
    render(<EasingPicker value={{ bezier: [0.4, 0, 0.2, 1] }} onChange={() => {}} />);
    expect(screen.getByLabelText(/easing/i)).toHaveValue('custom');
    expect(screen.getByText('cubic-bezier(0.4, 0, 0.2, 1)')).toBeInTheDocument();
  });

  it('converts a named easing to control points on request', () => {
    const onChange = vi.fn();
    render(<EasingPicker value="easeInOutCubic" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /convert to bezier/i }));
    expect(onChange).toHaveBeenCalledWith({ bezier: [0.65, 0, 0.35, 1] });
  });

  it('draws the curve it is showing', () => {
    render(<EasingPicker value="easeInQuad" onChange={() => {}} />);
    const pts = screen.getByTestId('easing-preview').querySelector('polyline')!.getAttribute('points')!;
    expect(pts.split(' ').length).toBeGreaterThan(4);
  });
});
