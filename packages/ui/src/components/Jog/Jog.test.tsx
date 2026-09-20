import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Jog } from './Jog';

const props = {
  index: 2,
  count: 24,
  playing: false,
  onPlay: () => {},
  onStep: () => {},
};

describe('Jog', () => {
  it('shows play while stopped and pause while running', () => {
    const { rerender } = render(<Jog {...props} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    rerender(<Jog {...props} playing />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('steps back and forward by one', () => {
    const onStep = vi.fn();
    render(<Jog {...props} onStep={onStep} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(onStep.mock.calls).toEqual([[-1], [1]]);
  });

  it('names the steps after the unit it was given', () => {
    render(<Jog {...props} unit="Beat" onScrub={() => {}} />);
    expect(screen.getByRole('button', { name: 'Previous beat' })).toBeInTheDocument();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Beat 3 of 24');
  });

  it('stops you stepping off either end', () => {
    const { rerender } = render(<Jog {...props} index={0} />);
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled();
    rerender(<Jog {...props} index={23} />);
    expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled();
  });

  it('has nothing to play with fewer than two steps', () => {
    render(<Jog {...props} index={0} count={1} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('draws a scrubber only when something can take the scrub', () => {
    const { rerender } = render(<Jog {...props} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    rerender(<Jog {...props} onScrub={() => {}} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('pads the readout to the widest it can get, so the row cannot shift', () => {
    render(<Jog {...props} index={2} count={120} />);
    // Two figure spaces: `3` in a column three digits wide.
    // U+2007 matches `\s`, so every whitespace-normalizing matcher collapses the padding
    // away. Read it off `textContent` instead.
    expect(screen.getByTestId('jog-readout').textContent).toBe('\u2007\u20073/120');
  });

  it('holds an out-of-range index at the end rather than reporting past it', () => {
    render(<Jog {...props} index={99} count={24} onScrub={() => {}} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Step 24 of 24');
  });
});
