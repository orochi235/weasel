import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createEvent, act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, BUILTIN_TOOL_IDS } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import type { useTools } from '../tools/overlayBinding';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

type P = { x: number; y: number; width: number; height: number };
type Tools = ReturnType<typeof useTools>;

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 200, height: 200, dpr: 1 };

function clickAt(canvas: HTMLCanvasElement, x: number, y: number) {
  const at = (ev: Event) => {
    Object.defineProperty(ev, 'clientX', { value: x });
    Object.defineProperty(ev, 'clientY', { value: y });
    return ev;
  };
  act(() => {
    canvas.dispatchEvent(at(createEvent.pointerDown(canvas, { pointerId: 1, button: 0, isPrimary: true })));
    canvas.dispatchEvent(at(createEvent.pointerUp(canvas, { pointerId: 1, button: 0, isPrimary: true })));
  });
}

function mount() {
  const captured: { tools: Tools | null } = { tools: null };
  function Harness() {
    const scene = useScene<{ color: string }, 'main', P>({ systemLayers: [{ id: 'main' }], initial: [] });
    return (
      <SceneCanvas
        features={['draw']}
        scene={scene}
        width={200} height={200}
        layers={{}}
        defaultTools={BUILTIN_TOOL_IDS}
        initialActiveTool="pen"
        onToolsCreated={(t) => { captured.tools = t; }}
      />
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas') as HTMLCanvasElement;
  const preview = () =>
    captured.tools!.getActiveOverlays('before-selection').find((l) => l.id === 'penPreview');
  return { canvas, tools: () => captured.tools!, preview };
}

describe('the pen tool draws its own in-progress path', () => {
  it('is in the stack, beneath the selection chrome, while the pen is the active tool', () => {
    const { preview } = mount();
    expect(preview()).toBeDefined();
  });

  it('keeps the path on screen while another tool is held over the pen', () => {
    const { canvas, tools, preview } = mount();
    clickAt(canvas, 40, 40);
    clickAt(canvas, 90, 60);
    expect(preview()!.draw(undefined, VIEW, DIMS).length).toBeGreaterThan(0);

    act(() => { tools().engageHotkey('hand'); });
    expect(tools().hotkeyEngaged).toBe('hand');
    expect(preview()).toBeDefined();
    expect(preview()!.draw(undefined, VIEW, DIMS).length).toBeGreaterThan(0);

    act(() => { tools().disengageHotkey(); });
    expect(preview()!.draw(undefined, VIEW, DIMS).length).toBeGreaterThan(0);
  });

  it('leaves the stack, with the path discarded, when another tool is chosen', () => {
    const { canvas, tools, preview } = mount();
    clickAt(canvas, 40, 40);
    clickAt(canvas, 90, 60);
    const layer = preview()!;
    expect(layer.draw(undefined, VIEW, DIMS).length).toBeGreaterThan(0);

    act(() => { tools().setActive('select'); });
    expect(preview()).toBeUndefined();
    expect(layer.draw(undefined, VIEW, DIMS)).toEqual([]);
  });
});
