import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Transport } from './Transport';

const props = {
  paused: true,
  loop: false as boolean | number,
  rate: 1,
  playhead: 0,
  duration: 2000,
  onPlay: () => {},
  onPause: () => {},
  onLoopChange: () => {},
  onRateChange: () => {},
};

describe('Transport', () => {
  it('shows play while paused', () => {
    render(<Transport {...props} />);
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('shows pause while running', () => {
    render(<Transport {...props} paused={false} />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('calls onPlay when play is pressed', () => {
    const onPlay = vi.fn();
    render(<Transport {...props} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('calls onPause when pause is pressed', () => {
    const onPause = vi.fn();
    render(<Transport {...props} paused={false} onPause={onPause} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('reads out the playhead against the duration', () => {
    render(<Transport {...props} playhead={480} />);
    expect(screen.getByTestId('timeline-time')).toHaveTextContent('0.48s / 2.00s');
  });

  it('reflects the loop state on the toggle', () => {
    render(<Transport {...props} loop />);
    expect(screen.getByRole('switch', { name: /loop/i })).toBeChecked();
  });

  it('turns looping on', () => {
    const onLoopChange = vi.fn();
    render(<Transport {...props} onLoopChange={onLoopChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /loop/i }));
    expect(onLoopChange).toHaveBeenCalledWith(true);
  });

  it('turns looping off', () => {
    const onLoopChange = vi.fn();
    render(<Transport {...props} loop onLoopChange={onLoopChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /loop/i }));
    expect(onLoopChange).toHaveBeenCalledWith(false);
  });

  it('treats a finite lap count as looping', () => {
    render(<Transport {...props} loop={3} />);
    expect(screen.getByRole('switch', { name: /loop/i })).toBeChecked();
  });

  // Keyboard, not a pointer: the detents are laid out, and jsdom has no layout,
  // so a click at an x offset would be asserting the emulation.
  it('changes the rate a detent at a time', () => {
    const onRateChange = vi.fn();
    render(<Transport {...props} onRateChange={onRateChange} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: /rate/i }), { key: 'ArrowRight' });
    expect(onRateChange).toHaveBeenCalledWith(2, expect.anything());
  });

  it('speaks the rate rather than the detent index', () => {
    render(<Transport {...props} rate={4} />);
    expect(screen.getByRole('slider', { name: /rate/i })).toHaveAttribute('aria-valuetext', '4x');
  });
});
