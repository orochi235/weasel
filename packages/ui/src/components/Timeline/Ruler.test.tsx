import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Ruler } from './Ruler';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 24,
      width: TRACK_WIDTH, height: 24, toJSON: () => {},
    } as DOMRect;
  };
});

const props = {
  window: { from: 0, to: 1000 },
  bounds: { from: 0, to: 1000 },
  playhead: 250,
  onScrub: () => {},
  onWindowChange: () => {},
};

const ruler = (): HTMLElement => screen.getByTestId('timeline-ruler');

describe('Ruler', () => {
  it('renders tick labels', () => {
    render(<Ruler {...props} />);
    expect(screen.getAllByTestId('timeline-tick').length).toBeGreaterThan(1);
  });

  it('positions the playhead at its fraction of the window', () => {
    render(<Ruler {...props} />);
    expect(screen.getByTestId('timeline-playhead')).toHaveStyle({ left: '25%' });
  });

  it('scrubs to the pointer on pointerdown', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    expect(onScrub).toHaveBeenCalledWith(200);
  });

  it('scrubs continuously through a drag', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 5 });
    fireEvent.pointerUp(document, { clientX: 300, clientY: 5 });
    expect(onScrub).toHaveBeenLastCalledWith(600);
  });

  it('stops scrubbing after pointerup', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 5 });
    onScrub.mockClear();
    fireEvent.pointerMove(document, { clientX: 400, clientY: 5 });
    expect(onScrub).not.toHaveBeenCalled();
  });

  it('stops scrubbing after pointercancel', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    fireEvent.pointerCancel(document, {});
    onScrub.mockClear();
    fireEvent.pointerMove(document, { clientX: 400, clientY: 5 });
    expect(onScrub).not.toHaveBeenCalled();
  });

  it('clamps a scrub past the end of the window', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 900, clientY: 5, button: 0 });
    expect(onScrub).toHaveBeenCalledWith(1000);
  });

  // PROXY ASSERTION. jsdom's setPointerCapture records the call and has no other
  // consequence, so a test asserting the drag still works would pass either way.
  // What actually breaks in a browser is capture killing the click on non-native
  // children, which jsdom cannot show. Asserting the call never happens is the
  // check that can fail on this side of the boundary.
  it('never captures the pointer', () => {
    const capture = vi.fn();
    Element.prototype.setPointerCapture = capture;
    render(<Ruler {...props} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 5 });
    fireEvent.pointerUp(document, { clientX: 300, clientY: 5 });
    expect(capture).not.toHaveBeenCalled();
  });

  it('zooms in on a wheel with ctrl held', () => {
    const onWindowChange = vi.fn();
    render(<Ruler {...props} onWindowChange={onWindowChange} />);
    fireEvent.wheel(ruler(), { deltaY: -100, ctrlKey: true, clientX: 250 });
    const next = onWindowChange.mock.calls[0][0];
    expect(next.to - next.from).toBeLessThan(1000);
  });

  it('pans on a plain wheel', () => {
    const onWindowChange = vi.fn();
    render(<Ruler {...props} window={{ from: 200, to: 700 }} onWindowChange={onWindowChange} />);
    fireEvent.wheel(ruler(), { deltaY: 100, clientX: 250 });
    const next = onWindowChange.mock.calls[0][0];
    expect(next.to - next.from).toBeCloseTo(500, 6);
    expect(next.from).not.toBe(200);
  });
});

describe('Ruler pointer session', () => {
  it('ends a scrub released outside the ruler', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0, buttons: 1 });
    fireEvent.pointerUp(outside, { clientX: 900, clientY: 900, bubbles: true });
    onScrub.mockClear();
    fireEvent.pointerMove(document, { clientX: 400, clientY: 5, buttons: 1 });
    expect(onScrub).not.toHaveBeenCalled();
    outside.remove();
  });

  it('ends the scrub when the ruler loses pointer capture', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0, buttons: 1 });
    fireEvent(ruler(), new PointerEvent('lostpointercapture', { pointerId: 0, bubbles: true }));
    onScrub.mockClear();
    fireEvent.pointerMove(document, { clientX: 400, clientY: 5, buttons: 1 });
    expect(onScrub).not.toHaveBeenCalled();
  });

  it('treats a move with no button held as the release it missed', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 5, buttons: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(600);
    onScrub.mockClear();
    fireEvent.pointerMove(document, { clientX: 400, clientY: 5, buttons: 0 });
    fireEvent.pointerMove(document, { clientX: 450, clientY: 5, buttons: 1 });
    expect(onScrub).not.toHaveBeenCalled();
  });
});
