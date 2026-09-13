import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { rainbowVertexColors, solidVertexColors } from '@weasel-js/core';
import { VertexColorAnimationDemo } from '../VertexColorAnimationDemo';

const RAINBOW = rainbowVertexColors(7);

function strokeColors(id: string): number[] {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === id)!;
  return [...(node.data as { stroke: { vertexColors: number[] } }).stroke.vertexColors];
}

function click(name: string) {
  act(() => { fireEvent.click(screen.getByRole('button', { name })); });
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});
afterEach(() => {
  vi.useRealTimers();
  // The hook installs once and stays bound to the first canvas's scene.
  delete window.__weaselTest;
});

describe('VertexColorAnimationDemo', () => {
  it('commits a tween to the node only when it ends, and tweens back on the next click', () => {
    render(<VertexColorAnimationDemo />);
    expect(strokeColors('tween')).toEqual(RAINBOW);

    click('tween');
    advance(400);
    // Mid-flight the colors live in the animator's override, not the scene.
    expect(strokeColors('tween')).toEqual(RAINBOW);
    advance(1000);
    expect(strokeColors('tween')).toEqual(solidVertexColors(7, 0.95, 0.25, 0.3));

    click('tween');
    advance(1000);
    expect(strokeColors('tween')).toEqual(RAINBOW);
  });

  it('commits a stagger once its last anchor finishes', () => {
    render(<VertexColorAnimationDemo />);

    click('stagger');
    // Seven anchors 120ms apart, 400ms each: the last one ends at 1120ms.
    advance(900);
    expect(strokeColors('stagger')).toEqual(RAINBOW);
    advance(500);
    expect(strokeColors('stagger')).toEqual(solidVertexColors(7, 1, 1, 1));
  });
});
