import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { StickyNotesDemo } from '../StickyNotesDemo';

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
}
function click(canvas: HTMLCanvasElement, x: number, y: number) {
  act(() => {
    pointer(canvas, 'pointerdown', x, y);
    pointer(canvas, 'pointerup', x, y);
  });
}
function drag(canvas: HTMLCanvasElement, [x0, y0]: number[], [x1, y1]: number[]) {
  act(() => {
    pointer(canvas, 'pointerdown', x0, y0);
    pointer(canvas, 'pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    pointer(canvas, 'pointermove', x1, y1);
    pointer(canvas, 'pointerup', x1, y1);
  });
}

type Note = { id: string; pose: { x: number; y: number; width: number; height: number }; data: { text?: string; background?: unknown } };
const notes = (): Note[] => window.__weaselTest!.getScene().nodes as unknown as Note[];
const added = (): Note[] => notes().filter((n) => n.id !== 'a' && n.id !== 'b');

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

describe('StickyNotesDemo', () => {
  it('places a default-size note centered on a click, and opens its editor', () => {
    const { container } = render(<StickyNotesDemo />);
    const canvas = container.querySelector('canvas')!;
    click(canvas, 420, 260);
    expect(added()).toHaveLength(1);
    const [note] = added();
    expect(note.pose).toMatchObject({ x: 340, y: 180, width: 160, height: 160 });
    expect(note.data.background).toBeDefined();
    expect(container.querySelector('[contenteditable="true"]')).not.toBeNull();
  });

  it('draws a note the size of a drag', () => {
    const { container } = render(<StickyNotesDemo />);
    const canvas = container.querySelector('canvas')!;
    drag(canvas, [380, 220], [480, 300]);
    expect(added()).toHaveLength(1);
    expect(added()[0].pose).toMatchObject({ x: 380, y: 220, width: 100, height: 80 });
  });
});
