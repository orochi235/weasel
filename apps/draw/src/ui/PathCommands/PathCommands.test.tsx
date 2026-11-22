import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';

const edits = vi.hoisted(() => new Map<string, { input: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }>());

vi.mock('@weasel-js/routing/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/routing/react')>()),
  useOngoingAction: (id: string) => {
    if (!edits.has(id)) edits.set(id, { input: vi.fn(), commit: vi.fn(), cancel: vi.fn() });
    return edits.get(id)!;
  },
}));

import { useState } from 'react';
import { drawPrefs } from '../../prefs';
import { drawToolOptionValues } from '../../toolOptions';
import { OffsetSlider, SimplifySlider, useSimplifyTolerance } from './PathCommands';

/** Drags `name`'s slider, over a 200 px track, from its middle to `x`, then presses Escape. */
function dragAndCancel(name: string, x: number) {
  const slider = screen.getByRole('slider', { name });
  const track = { x: 0, y: 0, width: 200, height: 24, top: 0, left: 0, right: 200, bottom: 24, toJSON: () => ({}) };
  slider.parentElement!.getBoundingClientRect = () => track;
  act(() => {
    fireEvent.pointerDown(slider, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
  });
  act(() => {
    fireEvent.pointerMove(document, { clientX: x, clientY: 12, pointerId: 1 });
  });
  act(() => {
    fireEvent.keyDown(slider, { key: 'Escape' });
  });
  act(() => {
    fireEvent.pointerUp(document, { clientX: x, clientY: 12, pointerId: 1 });
  });
  return slider;
}

function Simplify() {
  const [tolerance, setTolerance] = useState(1);
  return <SimplifySlider tolerance={tolerance} onTolerance={setTolerance} />;
}

function TunedSimplify() {
  const [tolerance, setTolerance] = useSimplifyTolerance();
  return <SimplifySlider tolerance={tolerance} onTolerance={setTolerance} />;
}

afterEach(() => {
  cleanup();
  edits.clear();
  drawPrefs().reset('tools.sand');
});

describe('the path command sliders', () => {
  it('drives Simplify from its slider: a step previews and commits the tolerance', () => {
    render(<Simplify />);
    const slider = screen.getByRole('slider', { name: 'Simplify tolerance' });
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
    });
    const simplify = edits.get('simplifyPath')!;
    expect(simplify.input).toHaveBeenCalledWith({ tolerance: expect.closeTo(1.1, 5) });
    expect(simplify.commit).toHaveBeenCalledWith({ tolerance: expect.closeTo(1.1, 5) });
  });

  it('shows and speaks each value to one decimal place', () => {
    render(<Simplify />);
    const slider = screen.getByRole('slider', { name: 'Simplify tolerance' });
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
    });
    expect(slider).toHaveAttribute('aria-valuetext', '1.1');
    expect(screen.getByText('1.1')).toBeInTheDocument();
  });

  it('drives Offset Path from its slider, by distance', () => {
    render(<OffsetSlider />);
    const slider = screen.getByRole('slider', { name: 'Offset distance' });
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    });
    expect(edits.get('offsetPath')!.commit).toHaveBeenCalledWith({ distance: -0.5 });
  });

  it("keeps the tolerance as Sand's tolerance option", () => {
    render(<TunedSimplify />);
    act(() => {
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Simplify tolerance' }), { key: 'ArrowRight' });
    });
    expect(drawToolOptionValues().get('sand').tolerance).toBeCloseTo(1.1, 5);
  });

  it("leaves Sand's tolerance, and the slider, where they were when a drag is canceled", () => {
    render(<TunedSimplify />);
    const before = drawToolOptionValues().get('sand').tolerance;
    const slider = dragAndCancel('Simplify tolerance', 180);
    expect(edits.get('simplifyPath')!.cancel).toHaveBeenCalled();
    expect(drawToolOptionValues().get('sand').tolerance).toBe(before);
    expect(slider).toHaveAttribute('aria-valuenow', String(before));
  });

  it('leaves Offset at its distance when a drag is canceled', () => {
    render(<OffsetSlider />);
    const slider = screen.getByRole('slider', { name: 'Offset distance' });
    const before = slider.getAttribute('aria-valuenow');
    dragAndCancel('Offset distance', 180);
    expect(edits.get('offsetPath')!.cancel).toHaveBeenCalled();
    expect(slider).toHaveAttribute('aria-valuenow', before);
  });

  it('hands back the same tolerance setter on every render', () => {
    const { result, rerender } = renderHook(() => useSimplifyTolerance());
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });
});
