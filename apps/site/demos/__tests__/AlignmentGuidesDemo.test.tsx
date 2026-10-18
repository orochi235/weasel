import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AlignmentGuidesDemo } from '../AlignmentGuidesDemo';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  const proto = HTMLCanvasElement.prototype as unknown as {
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

const pose = (id: string) => window.__weaselTest!.getScene().nodes.find((n) => n.id === id)!.pose;

describe('AlignmentGuidesDemo', () => {
  it("snaps the purple rect's top onto the green rect's", () => {
    const { container } = render(<AlignmentGuidesDemo />);
    const canvas = container.querySelector('canvas')!;
    const fire = (type: string, x: number, y: number) => act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    });
    // Its top at 60 dragged up 7 to 53, three short of the green rect's top at 50.
    fire('pointerdown', 275, 95);
    fire('pointermove', 275, 92);
    fire('pointermove', 275, 88);
    fire('pointerup', 275, 88);
    expect(pose('drag')).toMatchObject({ y: 50 });
  });
});
