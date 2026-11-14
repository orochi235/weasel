import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
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
    renderWithIcons(<Transport {...props} />);
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('shows pause while running', () => {
    renderWithIcons(<Transport {...props} paused={false} />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('calls onPlay when play is pressed', () => {
    const onPlay = vi.fn();
    renderWithIcons(<Transport {...props} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('calls onPause when pause is pressed', () => {
    const onPause = vi.fn();
    renderWithIcons(<Transport {...props} paused={false} onPause={onPause} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('reads out the playhead against the duration', () => {
    renderWithIcons(<Transport {...props} playhead={480} />);
    expect(screen.getByTestId('timeline-time')).toHaveTextContent('0.48s / 2.00s');
  });

  it('shows a playhead before zero and spans the scrub bar from start', () => {
    renderWithIcons(<Transport {...props} start={-500} duration={3000} playhead={-500} onSeek={() => {}} />);
    expect(screen.getByTestId('timeline-time')).toHaveTextContent('-0.50s / 3.00s');
    const bar = screen.getByRole('slider', { name: 'Position' });
    expect(bar).toHaveAttribute('aria-valuemin', '-500');
    expect(bar).toHaveAttribute('aria-valuemax', '2500');
  });

  it('sizes the readout for the widest playhead it can show', () => {
    renderWithIcons(
      <Transport {...props} start={-500} duration={3000} playhead={-500} />,
    );
    const readout = screen.getByTestId('timeline-time').textContent ?? '';
    const sizer = screen.getByTestId('timeline-time').parentElement?.querySelector('[aria-hidden="true"]')?.textContent ?? '';
    expect(sizer.length).toBeGreaterThanOrEqual(readout.length);
  });

  it('reflects the loop state on the toggle', () => {
    renderWithIcons(<Transport {...props} loop />);
    expect(screen.getByRole('switch', { name: /loop/i })).toBeChecked();
  });

  it('turns looping on', () => {
    const onLoopChange = vi.fn();
    renderWithIcons(<Transport {...props} onLoopChange={onLoopChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /loop/i }));
    expect(onLoopChange).toHaveBeenCalledWith(true);
  });

  it('turns looping off', () => {
    const onLoopChange = vi.fn();
    renderWithIcons(<Transport {...props} loop onLoopChange={onLoopChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /loop/i }));
    expect(onLoopChange).toHaveBeenCalledWith(false);
  });

  it('treats a finite lap count as looping', () => {
    renderWithIcons(<Transport {...props} loop={3} />);
    expect(screen.getByRole('switch', { name: /loop/i })).toBeChecked();
  });

  // Keyboard, not a pointer: the detents are laid out, and jsdom has no layout,
  // so a click at an x offset would be asserting the emulation.
  it('changes the rate a detent at a time', () => {
    const onRateChange = vi.fn();
    renderWithIcons(<Transport {...props} onRateChange={onRateChange} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: /rate/i }), { key: 'ArrowRight' });
    expect(onRateChange).toHaveBeenCalledWith(2, expect.anything());
  });

  it('draws the rate as a marked-up quantity', () => {
    const { container } = renderWithIcons(<Transport {...props} rate={4} />);
    const shown = container.querySelector('data[value="4"]')!;
    expect(shown.textContent).toBe('4x');
    expect(shown.closest('[aria-hidden]')).toBeNull();
  });

  it('draws the rate as the text a formatRate hands back', () => {
    const { container } = renderWithIcons(<Transport {...props} rate={4} formatRate={(r) => `${r} fps`} />);
    expect(container.querySelector('data')).toBeNull();
    expect(container.textContent).toContain('4 fps');
  });

  it('speaks the rate rather than the detent index', () => {
    renderWithIcons(<Transport {...props} rate={4} />);
    expect(screen.getByRole('slider', { name: /rate/i })).toHaveAttribute('aria-valuetext', '4 times');
  });

  it('offers no scrub bar or reverse switch it was given no handler for', () => {
    renderWithIcons(<Transport {...props} />);
    expect(screen.queryByRole('slider', { name: /position/i })).toBeNull();
    expect(screen.queryByRole('switch', { name: /reverse/i })).toBeNull();
  });

  it('scrubs: a slider over the duration that speaks the playhead in seconds', () => {
    renderWithIcons(<Transport {...props} playhead={480} onSeek={() => {}} />);
    const scrub = screen.getByRole('slider', { name: /position/i });
    expect(scrub).toHaveAttribute('aria-valuemin', '0');
    expect(scrub).toHaveAttribute('aria-valuemax', '2000');
    expect(scrub).toHaveAttribute('aria-valuenow', '480');
    expect(scrub).toHaveAttribute('aria-valuetext', '0.48 seconds');
  });

  it('seeks from the keyboard', () => {
    const onSeek = vi.fn();
    renderWithIcons(<Transport {...props} playhead={480} onSeek={onSeek} />);
    const scrub = screen.getByRole('slider', { name: /position/i });
    fireEvent.keyDown(scrub, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenLastCalledWith(500);
    fireEvent.keyDown(scrub, { key: 'Home' });
    expect(onSeek).toHaveBeenLastCalledWith(0);
  });

  it('reflects and flips the direction on the reverse switch', () => {
    const onReverseChange = vi.fn();
    const { rerender } = renderWithIcons(<Transport {...props} onReverseChange={onReverseChange} />);
    const toggle = screen.getByRole('switch', { name: /reverse/i });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onReverseChange).toHaveBeenCalledWith(true);
    rerender(<Transport {...props} reverse onReverseChange={onReverseChange} />);
    expect(screen.getByRole('switch', { name: /reverse/i })).toBeChecked();
  });

  it('stays left to right in a right-to-left locale, scrub bar and arrow keys with it', () => {
    const onSeek = vi.fn();
    renderWithIcons(<div dir="rtl"><Transport {...props} playhead={500} onSeek={onSeek} /></div>);
    const scrub = screen.getByRole('slider', { name: /position/i });
    expect(scrub.style.left).toBe('25%');
    fireEvent.keyDown(scrub, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenLastCalledWith(520);
  });
});
