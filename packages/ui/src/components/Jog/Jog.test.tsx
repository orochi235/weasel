import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { arcShape, lineShape, trackRun } from '@weasel-js/geom';
import { Along } from '../Along';
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
    const { rerender } = renderWithIcons(<Jog {...props} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    rerender(<Jog {...props} playing />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('steps back and forward by one', () => {
    const onStep = vi.fn();
    renderWithIcons(<Jog {...props} onStep={onStep} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(onStep.mock.calls).toEqual([[-1], [1]]);
  });

  it('names the steps after the unit it was given', () => {
    renderWithIcons(<Jog {...props} unit="Beat" onScrub={() => {}} />);
    expect(screen.getByRole('button', { name: 'Previous beat' })).toBeInTheDocument();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Beat 3 of 24');
  });

  it('stops you stepping off either end', () => {
    const { rerender } = renderWithIcons(<Jog {...props} index={0} />);
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled();
    rerender(<Jog {...props} index={23} />);
    expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled();
  });

  it('has nothing to play with fewer than two steps', () => {
    renderWithIcons(<Jog {...props} index={0} count={1} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('draws a scrubber only when something can take the scrub', () => {
    const { rerender } = renderWithIcons(<Jog {...props} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    rerender(<Jog {...props} onScrub={() => {}} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('pads the readout to the widest it can get, so the row cannot shift', () => {
    renderWithIcons(<Jog {...props} index={2} count={120} />);
    // Two figure spaces: `3` in a column three digits wide.
    // U+2007 matches `\s`, so every whitespace-normalizing matcher collapses the padding
    // away. Read it off `textContent` instead.
    expect(screen.getByTestId('jog-readout').textContent).toBe('\u2007\u20073/120');
  });

  it('reads 0/0 for an empty sequence, and draws no scrubber for it', () => {
    renderWithIcons(<Jog {...props} index={0} count={0} onScrub={() => {}} />);
    expect(screen.getByTestId('jog-readout').textContent).toBe('0/0');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('holds an out-of-range index at the end rather than reporting past it', () => {
    renderWithIcons(<Jog {...props} index={99} count={24} onScrub={() => {}} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Step 24 of 24');
  });

});

describe('Jog along a curve', () => {
  // jsdom lays nothing out: every part is 40 wide untransformed, and every box 200 by 200 at (0, 0).
  const realRect = Element.prototype.getBoundingClientRect;
  const realOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
  beforeAll(() => {
    Element.prototype.getBoundingClientRect = function box() {
      return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => {} } as DOMRect;
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 40 });
  });
  afterAll(() => {
    Element.prototype.getBoundingClientRect = realRect;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffset);
  });

  const shape = arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 270, end: 90 });
  const placed = (el: Element) => {
    const style = (el as HTMLElement).style;
    return { x: Number.parseFloat(style.getPropertyValue('--at-x')), y: Number.parseFloat(style.getPropertyValue('--at-y')), angle: Number.parseFloat(style.getPropertyValue('--at-angle')) };
  };
  const partOf = (el: Element) => el.closest('[data-bar-item]')!;

  it('lays its buttons and readout along the shape, in reading order, each tipped to it', () => {
    renderWithIcons(<Jog {...props} shape={shape} />);
    const [prev, play, next, readout] = [
      screen.getByRole('button', { name: 'Previous step' }),
      screen.getByRole('button', { name: 'Play' }),
      screen.getByRole('button', { name: 'Next step' }),
      screen.getByTestId('jog-readout'),
    ].map((el) => placed(partOf(el)));
    // Four parts 40 long, centered on the run: jsdom reads no stylesheet, so no gap.
    const run = trackRun(shape);
    const want = [20, 60, 100, 140].map((d) => run.at(((run.length - 160) / 2 + d) / run.length));
    [prev, play, next, readout].forEach((got, i) => {
      expect(got!.x).toBeCloseTo(want[i]!.point.x);
      expect(got!.y).toBeCloseTo(want[i]!.point.y);
      expect(got!.angle).toBeCloseTo(want[i]!.angle);
    });
  });

  it('bends its scrubber along the stretch of the run between the buttons and the readout', () => {
    renderWithIcons(
      <Along arc={{ start: 270, end: 90 }}>
        <Jog {...props} onScrub={() => {}} />
      </Along>,
    );
    const curved = screen.getByRole('slider').closest('[data-shape]')!;
    expect(curved).toHaveAttribute('data-shape', 'arc');
    // The scrubber starts where the Next button ends.
    const run = trackRun(arcShape({ center: { x: 100, y: 100 }, radius: 100, start: 270, end: 90 }));
    const next = placed(partOf(screen.getByRole('button', { name: 'Next step' })));
    const band = curved.querySelector('path')!.getAttribute('d')!;
    const start = band.match(/^M (\S+) (\S+)/)!.slice(1).map(Number);
    const want = run.at((3 * 40) / run.length).point;
    expect(start[0]).toBeCloseTo(want.x, 2);
    expect(start[1]).toBeCloseTo(want.y, 2);
    expect(next.x).toBeLessThan(want.x);
  });

  it('stays a straight row on a line', () => {
    renderWithIcons(<Jog {...props} onScrub={() => {}} shape={lineShape({ x: 0, y: 0 }, { x: 200, y: 0 })} />);
    expect(screen.getByRole('slider').closest('[data-shape]')).toBeNull();
    expect(screen.getByTestId('jog-readout').closest('[data-bar-item]')).toBeNull();
  });
});
