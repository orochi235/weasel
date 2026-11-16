import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import type { SharedAnchor } from '@weasel-js/geom/curves';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CurveLabDemo } from '../CurveLabDemo';
import { REPS } from '../curveLab/curveScene';
import { withIcons } from '../../testIcons';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const anchors = () => window.__weaselTest!.getScene().doc?.['curveLab:anchors'] as SharedAnchor[];
const curves = () => window.__weaselTest!.getScene().nodes.map((n) => n.pose);
const START = { x: 60, y: 220 };

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]) {
  const at = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  act(() => {
    at('pointerdown', x0, y0);
    at('pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    at('pointermove', x1, y1);
    at('pointerup', x1, y1);
  });
}

const key = (shiftKey: boolean) =>
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey })); });

describe('CurveLabDemo', () => {
  it('moves an anchor in every panel, and takes the drag back as one step with Undo and Mod+Z', async () => {
    const { container } = await renderSettled(<CurveLabDemo />, { wrapper: withIcons });
    const canvases = container.querySelectorAll('canvas');
    expect(canvases).toHaveLength(4);
    expect(anchors()[0]).toMatchObject(START);
    const before = curves();

    drag(canvases[2]!, [START.x, START.y], [100, 260]);
    expect(anchors()[0]).toMatchObject({ x: 100, y: 260 });
    expect(curves()).toEqual(REPS.map((rep) => rep.toPath(anchors())));

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(anchors()[0]).toMatchObject(START);
    expect(curves()).toEqual(before);

    await userEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(anchors()[0]).toMatchObject({ x: 100, y: 260 });

    key(false);
    expect(anchors()[0]).toMatchObject(START);
    key(true);
    expect(anchors()[0]).toMatchObject({ x: 100, y: 260 });
  });

  it('shows one overlay alone on Alt-click, and every overlay on a second', async () => {
    await renderSettled(<CurveLabDemo />, { wrapper: withIcons });
    const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
    const shown = () => ['anchors', 'curvature comb', 'inflections + extrema'].map((n) => box(n).checked);
    fireEvent.click(box('curvature comb'), { altKey: true });
    expect(shown()).toEqual([false, true, false]);
    fireEvent.click(box('curvature comb'), { altKey: true });
    expect(shown()).toEqual([true, true, true]);
  });
});
