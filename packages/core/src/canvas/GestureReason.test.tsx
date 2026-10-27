import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import type { Dispatcher, OngoingOverlay } from '@weasel-js/routing';
import type { View } from 'core/viewport/view';
import { GestureReason } from './GestureReason';

function fakeDispatcher(overlays: () => readonly OngoingOverlay[]) {
  const subs = new Set<() => void>();
  const dispatcher = {
    getInFlightHandles: () => [{ overlay: () => overlays() }],
    subscribe: (fn: () => void) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  } as unknown as Dispatcher;
  return { dispatcher, pump: () => subs.forEach((fn) => fn()) };
}

function mount(overlays: () => readonly OngoingOverlay[]) {
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, right: 500, bottom: 350, width: 400, height: 300, x: 100, y: 50, toJSON: () => ({}) });
  const canvasRef = { current: canvas };
  const viewRef = createRef<View>() as { current: View };
  viewRef.current = { x: 10, y: 0, scale: { x: 2, y: 2 } } as View;
  const { dispatcher, pump } = fakeDispatcher(overlays);
  const out = render(<GestureReason dispatcher={dispatcher} canvasRef={canvasRef} viewRef={viewRef} />);
  return { ...out, pump };
}

describe('GestureReason', () => {
  it('shows an in-flight reason beside the pointer, and nothing once it is gone', () => {
    let overlays: readonly OngoingOverlay[] = [];
    const { pump, queryByRole } = mount(() => overlays);
    expect(queryByRole('status')).toBeNull();
    overlays = [{ kind: 'reason', at: { x: 20, y: 30 }, text: 'Only effects go here' }];
    act(pump);
    const tag = queryByRole('status')!;
    expect(tag.textContent).toBe('Only effects go here');
    // The view's camera stands at x 10, so world (20, 30) is screen (20, 60) on a canvas at (100, 50).
    expect(tag.style.left).toBe(`${100 + 20 + 14}px`);
    expect(tag.style.top).toBe(`${50 + 60 + 14}px`);
    overlays = [{ kind: 'polyline', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], role: 'refused' }];
    act(pump);
    expect(queryByRole('status')).toBeNull();
  });
});
