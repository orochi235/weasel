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
    expect(screen.getByRole('slider', { name: /rate/i })).toHaveAttribute('aria-valuetext', '4 times');
  });

  it('offers no scrub bar or reverse switch it was given no handler for', () => {
    render(<Transport {...props} />);
    expect(screen.queryByRole('slider', { name: /position/i })).toBeNull();
    expect(screen.queryByRole('switch', { name: /reverse/i })).toBeNull();
  });

  it('scrubs: a slider over the duration that speaks the playhead in seconds', () => {
    render(<Transport {...props} playhead={480} onSeek={() => {}} />);
    const scrub = screen.getByRole('slider', { name: /position/i });
    expect(scrub).toHaveAttribute('aria-valuemin', '0');
    expect(scrub).toHaveAttribute('aria-valuemax', '2000');
    expect(scrub).toHaveAttribute('aria-valuenow', '480');
    expect(scrub).toHaveAttribute('aria-valuetext', '0.48 seconds');
  });

  it('seeks from the keyboard', () => {
    const onSeek = vi.fn();
    render(<Transport {...props} playhead={480} onSeek={onSeek} />);
    const scrub = screen.getByRole('slider', { name: /position/i });
    fireEvent.keyDown(scrub, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenLastCalledWith(500);
    fireEvent.keyDown(scrub, { key: 'Home' });
    expect(onSeek).toHaveBeenLastCalledWith(0);
  });

  it('reflects and flips the direction on the reverse switch', () => {
    const onReverseChange = vi.fn();
    const { rerender } = render(<Transport {...props} onReverseChange={onReverseChange} />);
    const toggle = screen.getByRole('switch', { name: /reverse/i });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onReverseChange).toHaveBeenCalledWith(true);
    rerender(<Transport {...props} reverse onReverseChange={onReverseChange} />);
    expect(screen.getByRole('switch', { name: /reverse/i })).toBeChecked();
  });
});
