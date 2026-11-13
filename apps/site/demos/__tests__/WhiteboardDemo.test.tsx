import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { WhiteboardDemo } from '../WhiteboardDemo';

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
}
function drag(canvas: HTMLCanvasElement, points: readonly (readonly [number, number])[]) {
  act(() => {
    const [first, ...rest] = points;
    pointer(canvas, 'pointerdown', first![0], first![1]);
    for (const [x, y] of rest) pointer(canvas, 'pointermove', x, y);
    const last = points.at(-1)!;
    pointer(canvas, 'pointerup', last[0], last[1]);
  });
}

type Node = { id: string; data: { text?: string; background?: unknown; path?: unknown } };
const nodes = (): Node[] => window.__weaselTest!.getScene().nodes as unknown as Node[];
const added = (): Node[] => nodes().filter((n) => n.id !== 'a' && n.id !== 'b');

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

describe('WhiteboardDemo', () => {
  it('mounts the pencil, text and sticky tools beside select and the hand', () => {
    render(<WhiteboardDemo />);
    for (const name of [/sticky note/i, /pencil/i, /^text/i, /select/i, /hand/i]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('draws a note with the sticky tool and a stroke with the pencil', () => {
    const { container } = render(<WhiteboardDemo />);
    const canvas = container.querySelector('canvas')!;
    fireEvent.click(screen.getByRole('button', { name: /sticky note/i }));
    drag(canvas, [[400, 220], [450, 260], [500, 300]]);
    expect(added().filter((n) => n.data.background !== undefined)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /pencil/i }));
    drag(canvas, [[60, 260], [90, 280], [120, 300], [150, 310]]);
    expect(added().filter((n) => n.data.path !== undefined)).toHaveLength(1);
  });
});
