import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, createEvent, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { asNodeId } from 'core/scene/types';
import { useTools } from 'tools/useTools';
import { defineTool } from 'tools/routing/defineTool';
import { WeaselProvider } from '../WeaselProvider';

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

/** Phase 14e Task 4: with `useResizeTool` deleted, resize gestures flow through
 *  the dispatcher-side `resizeAction`, which fires `onStart` only after the drag
 *  threshold is crossed. Sends down + move + up. Dispatches all three raw events
 *  inside a SINGLE act() (rather than three separate fireEvent act() boundaries)
 *  so a resize update that spans the gesture is acted as one unit — separate
 *  per-event acts let a cross-event update slip through and warn under CI timing.
 *  Events are constructed explicitly because jsdom's PointerEvent ignores
 *  clientX/Y from the dict-init shorthand (matches the Canvas.test.tsx pattern). */
function gestureAt(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  canvas.setPointerCapture = vi.fn();
  const down = createEvent.pointerDown(canvas, { pointerId: 1 });
  Object.defineProperty(down, 'clientX', { value: clientX });
  Object.defineProperty(down, 'clientY', { value: clientY });
  const move = createEvent.pointerMove(canvas, { pointerId: 1 });
  Object.defineProperty(move, 'clientX', { value: clientX + 20 });
  Object.defineProperty(move, 'clientY', { value: clientY + 20 });
  const up = createEvent.pointerUp(canvas, { pointerId: 1 });
  Object.defineProperty(up, 'clientX', { value: clientX + 20 });
  Object.defineProperty(up, 'clientY', { value: clientY + 20 });
  act(() => {
    canvas.dispatchEvent(down);
    canvas.dispatchEvent(move);
    canvas.dispatchEvent(up);
  });
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
          // Phase 14e Task 4: with `useResizeTool` deleted, resize flows
          // through the dispatcher-side `resizeAction`, which gates on
          // `SelectionRequired` by default. Override the static placeholder
          // so the dispatcher dispatches the gesture.
          actions={{ resize: { enabled: () => true } }}
        />
      );
    }
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    // Drop the pointer at the top-left corner-handle (0,0) of the selected rect.
    // jsdom's getBoundingClientRect is zero, so clientX/Y maps 1:1 to world coords.
    // Phase 14e Task 4: resizeAction.onStart fires after the drag threshold,
    // so send a full down→move→up sequence.
    gestureAt(canvas, 0, 0);
    expect(resizeStart).toHaveBeenCalled();
    expect(resizeStart.mock.calls[0][0]).toBe('a');
  });

  it("defaultTools=['select']: corner-drag still routes to dispatcher-side resizeAction", () => {
    // Resize is wired through `resizeAction` + `resizePolicy` dep — both are
    // registered by `useStandardActions` regardless of which builtin tools the
    // consumer mounts via `defaultTools`. With `defaultTools=['select']` the
    // select tool's `handle:*` drag binding still fires, and the dispatcher
    // dispatches the resize action (which is the only resize path post-Phase
    // 14e — there is no longer a legacy `useResizeTool` to suppress).
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
            resize: { behaviors: [{ onStart: (ctx: { draggedIds: string[] }) => resizeStart(ctx.draggedIds[0]) }] },
          }}
        />
      );
    }
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    gestureAt(canvas, 0, 0);
    expect(resizeStart).toHaveBeenCalled();
    expect(resizeStart.mock.calls[0][0]).toBe('a');
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
    render(<WeaselProvider><Harness /></WeaselProvider>);
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
    render(<WeaselProvider><Harness /></WeaselProvider>);
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

describe('SceneCanvas tools prop patch form', () => {
  function emptyHarness(toolsProp: Record<string, unknown> | undefined) {
    let captured: ReturnType<typeof useTools> | null = null;
    function Harness() {
      const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      return (
        <SceneCanvas
          scene={scene}
          width={100} height={100}
          layers={{}}
          // Cast through unknown: the public type permits `true | false | AnyTool`
          // per id, but the test wants to exercise all three plus the unknown-id case.
          tools={toolsProp as never}
          onToolsCreated={(t) => { captured = t; }}
        />
      );
    }
    render(<Harness />);
    return () => captured;
  }

  it('{ pen: true } pulls in the built-in pen even when not in the default tier', () => {
    // Default tier (no defaultTools / toolBundle prop, no viewport): ['select', 'rotate'].
    // 'pen' is in 'exhaustive' only.
    const get = emptyHarness({ pen: true });
    expect(get()!.registry).toHaveProperty('pen');
    expect(get()!.registry).toHaveProperty('select');
  });

  it('{ pen: false } omits a bundled tool', () => {
    // 'pen' would be in registry under toolBundle='exhaustive'; turn it off.
    let captured: ReturnType<typeof useTools> | null = null;
    function Harness() {
      const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      return (
        <SceneCanvas
          scene={scene}
          width={100} height={100}
          layers={{}}
          toolBundle="exhaustive"
          tools={{ pen: false } as never}
          onToolsCreated={(t) => { captured = t; }}
        />
      );
    }
    render(<Harness />);
    expect(captured!.registry).not.toHaveProperty('pen');
    expect(captured!.registry).toHaveProperty('rect');
  });

  it('{ unknownId: true } warns in dev and is ignored', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const get = emptyHarness({ totallyNotARealTool: true });
    expect(get()!.registry).not.toHaveProperty('totallyNotARealTool');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('totallyNotARealTool'));
    warn.mockRestore();
  });

  it('{ pen: customTool } replaces a bundled tool and warns in dev', () => {
    const customPen = defineTool({ id: 'pen', initial: {} });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let captured: ReturnType<typeof useTools> | null = null;
    function Harness() {
      const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      return (
        <SceneCanvas
          scene={scene}
          width={100} height={100}
          layers={{}}
          toolBundle="exhaustive"
          tools={{ pen: customPen } as never}
          onToolsCreated={(t) => { captured = t; }}
        />
      );
    }
    render(<Harness />);
    expect(captured!.registry.pen).toBe(customPen);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"pen"'));
    warn.mockRestore();
  });
});
