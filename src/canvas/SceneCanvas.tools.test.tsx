import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, createEvent, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { asNodeId } from 'core/scene/types';
import { useTools } from 'tools/useTools';
import { defineTool } from 'tools/routing/defineTool';

// jsdom doesn't implement getContext or pointer capture; stub minimally.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

type D = { color: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

/**
 * Drives a pointerdown at (clientX, clientY) on the canvas. Constructs the
 * event explicitly because jsdom's PointerEvent ignores clientX/Y from the
 * dict-init shorthand (matches the Canvas.test.tsx pattern).
 */
function pointerDownAt(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  canvas.setPointerCapture = vi.fn();
  const down = createEvent.pointerDown(canvas, { pointerId: 1 });
  Object.defineProperty(down, 'clientX', { value: clientX });
  Object.defineProperty(down, 'clientY', { value: clientY });
  fireEvent(canvas, down);
}

describe('SceneCanvas defaultTools selector', () => {
  it('omitted defaultTools: resize is registered (corner-drag fires resize.onStart)', () => {
    const resizeStart = vi.fn();
    function Harness() {
      const scene = useScene<D, L, P>({
        systemLayers: [{ id: 'main' }],
        initial: [{
          id: asNodeId('a'),
          kind: 'leaf',
          layer: 'main',
          pose: { x: 0, y: 0, width: 50, height: 50 },
          data: { color: '#f00' },
        }],
      });
      return (
        <SceneCanvas
          scene={scene}
          width={200} height={200}
          layers={{}}
          selectionOptions={{ initial: [asNodeId('a')] }}
          selectTool={{
            handleHitRadius: 8,
            resize: { behaviors: [{ onStart: (ctx: { draggedIds: string[] }) => resizeStart(ctx.draggedIds[0]) }] },
          }}
        />
      );
    }
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    // Drop the pointer at the top-left corner-handle (0,0) of the selected rect.
    // jsdom's getBoundingClientRect is zero, so clientX/Y maps 1:1 to world coords.
    pointerDownAt(canvas, 0, 0);
    expect(resizeStart).toHaveBeenCalled();
    expect(resizeStart.mock.calls[0][0]).toBe('a');
  });

  it("defaultTools=['select']: resize is NOT registered (corner-drag falls through)", () => {
    const resizeStart = vi.fn();
    function Harness() {
      const scene = useScene<D, L, P>({
        systemLayers: [{ id: 'main' }],
        initial: [{
          id: asNodeId('a'),
          kind: 'leaf',
          layer: 'main',
          pose: { x: 0, y: 0, width: 50, height: 50 },
          data: { color: '#f00' },
        }],
      });
      return (
        <SceneCanvas
          scene={scene}
          width={200} height={200}
          layers={{}}
          selectionOptions={{ initial: [asNodeId('a')] }}
          defaultTools={['select']}
          selectTool={{
            handleHitRadius: 8,
            // Resize behavior is registered into selectTool.resize, but with
            // defaultTools=['select'] the resize tool is never mounted — so
            // the spy must never fire.
            resize: { behaviors: [{ onStart: (ctx: { draggedIds: string[] }) => resizeStart(ctx.draggedIds[0]) }] },
          }}
        />
      );
    }
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    // Same corner-handle world point. Without resize registered, the
    // affordance is absent — the click falls through to body-hit move.
    pointerDownAt(canvas, 0, 0);
    expect(resizeStart).not.toHaveBeenCalled();
  });
});

describe('SceneCanvas consumer-tools keybindings auto-wiring', () => {
  function pressKey(key: string): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('auto-wires keybindings when a consumer-supplied `tools` prop is passed', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' }, initial: {} });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' }, initial: {} });

    let captured: ReturnType<typeof useTools> | null = null;
    function Harness() {
      const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      const tools = useTools({ active: 'select', registry: { select, pen } });
      captured = tools;
      return (
        <SceneCanvas
          scene={scene}
          width={100} height={100}
          layers={{}}
          tools={tools}
        />
      );
    }
    render(<Harness />);
    expect(captured!.active).toBe('select');
    act(() => pressKey('p'));
    expect(captured!.active).toBe('pen');
    act(() => pressKey('v'));
    expect(captured!.active).toBe('select');
  });

  it('`enableKeybindings={false}` suppresses the auto-wiring for consumer tools', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' }, initial: {} });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' }, initial: {} });

    let captured: ReturnType<typeof useTools> | null = null;
    function Harness() {
      const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      const tools = useTools({ active: 'select', registry: { select, pen } });
      captured = tools;
      return (
        <SceneCanvas
          scene={scene}
          width={100} height={100}
          layers={{}}
          tools={tools}
          enableKeybindings={false}
        />
      );
    }
    render(<Harness />);
    expect(captured!.active).toBe('select');
    // No `useKeybindings` is wired anywhere; the press is ignored.
    act(() => pressKey('p'));
    expect(captured!.active).toBe('select');
  });

  it('`enableKeybindings={false}` also suppresses the internal-tools auto-wiring', () => {
    // With the default (internal) tools, the `select` tool's declared
    // `v` binding would normally bring `tools.active` back to `'select'`
    // after a hand-switch. Capturing the internal tools via
    // `onToolsCreated` lets us assert opting out really silences both
    // wirings, not just the consumer branch.
    let captured: ReturnType<typeof useTools> | null = null;
    function Harness() {
      const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      return (
        <SceneCanvas
          scene={scene}
          width={100} height={100}
          layers={{}}
          viewport={{ pinchZoom: true }}
          enableKeybindings={false}
          onToolsCreated={(t) => { captured = t; }}
        />
      );
    }
    render(<Harness />);
    // `hand` is in the registry (viewport on) and declares `keybinding: H`.
    // With auto-wire disabled, pressing H must not switch.
    expect(captured!.active).toBe('select');
    act(() => pressKey('h'));
    expect(captured!.active).toBe('select');
  });
});
