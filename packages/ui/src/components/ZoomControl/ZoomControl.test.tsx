import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ZoomControl } from './ZoomControl';

const field = () => screen.getByRole('textbox', { name: 'Zoom' }) as HTMLInputElement;

describe('ZoomControl', () => {
  it('shows the zoom as a percentage', () => {
    render(<ZoomControl zoom={0.5} onZoomChange={() => {}} />);
    expect(field().value).toBe('50%');
  });

  it('puts the slider on log2 of the zoom, so actual size sits mid-track', () => {
    render(<ZoomControl zoom={1} onZoomChange={() => {}} min={0.25} max={4} />);
    const slider = screen.getByRole('slider', { name: 'Zoom' });
    expect(slider.getAttribute('aria-valuemin')).toBe('-2');
    expect(slider.getAttribute('aria-valuemax')).toBe('2');
    expect(slider.getAttribute('aria-valuenow')).toBe('0');
  });

  it('commits a typed zoom through onZoomCommit, held inside its range', () => {
    const onZoomChange = vi.fn();
    const onZoomCommit = vi.fn();
    render(<ZoomControl zoom={1} onZoomChange={onZoomChange} onZoomCommit={onZoomCommit} max={2} />);
    fireEvent.change(field(), { target: { value: '150%' } });
    fireEvent.blur(field());
    expect(onZoomCommit).toHaveBeenCalledWith(1.5);
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it('commits through onZoomChange when there is no onZoomCommit', () => {
    const onZoomChange = vi.fn();
    render(<ZoomControl zoom={1} onZoomChange={onZoomChange} />);
    fireEvent.change(field(), { target: { value: '25%' } });
    fireEvent.blur(field());
    expect(onZoomChange).toHaveBeenCalledWith(0.25);
  });

  it('accepts an extra class name', () => {
    const { container } = render(<ZoomControl zoom={1} onZoomChange={() => {}} className="is-mine" />);
    expect((container.firstChild as HTMLElement).className).toContain('is-mine');
  });
});
