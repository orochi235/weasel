import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, fireEvent, createEvent } from '@testing-library/react';
import { createRef } from 'react';
import { Canvas } from './testing/BareCanvas';
import type { RenderLayer } from 'core/layers/render';
import type { CanvasExtensionApi } from './canvasExtension';
import { stubCanvasContext } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('<Canvas>', () => {
  it('renders a <canvas> element with the configured dimensions', () => {
    const { container } = render(<Canvas width={123} height={45} layers={{}} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // jsdom reports the bare attribute, dpr-multiplied isn't asserted here
    expect(canvas!.getAttribute('width')).toBe('123');
    expect(canvas!.getAttribute('height')).toBe('45');
    expect(canvas!.getAttribute('tabindex')).toBe('0');
  });

  it('forwards a ref exposing CanvasExtensionApi', () => {
    const ref = createRef<CanvasExtensionApi>();
    render(<Canvas ref={ref} width={50} height={50} layers={{}} />);
    expect(typeof ref.current?.requestRedraw).toBe('function');
    expect(typeof ref.current?.registerLayer).toBe('function');
  });

  // `<Canvas>` no longer carries select's routing: the tool declares bindings,
  // and bindings are dispatched by `useGestureDispatcher` (mounted by
  // `<SceneCanvas>`), not by the tool-routing dispatcher this file drives.
  // Select's own behavior — applyClick on a body press, topmost collapse,
  // modifier hand-through — is covered directly in
  // `tools/builtin/select/useSelectTool.test.ts` and its z-order sibling.

  it('passes className and style through', () => {
    const { container } = render(
      <Canvas width={10} height={10} layers={{}} className="x" style={{ display: 'block' }} />,
    );
    const canvas = container.querySelector('canvas')!;
    expect(canvas.className).toBe('x');
    expect(canvas.style.display).toBe('block');
  });

  it('forwards onFocus and onBlur from the canvas element', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const { container } = render(
      <Canvas width={10} height={10} layers={{}} onFocus={onFocus} onBlur={onBlur} />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.focus(canvas);
    expect(onFocus).toHaveBeenCalledTimes(1);
    fireEvent.blur(canvas);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('layer.onUncapturedMove fires on pointermove when no gesture is captured', () => {
    const moveSpy = vi.fn();
    const layer: RenderLayer<unknown> = {
      id: 'tracker', label: 'tracker', space: 'screen',
      draw: () => [],
      onUncapturedMove: moveSpy,
    };
    const ref = createRef<CanvasExtensionApi>();
    const { container } = render(
      <Canvas
        ref={ref}
        width={100} height={100}
        layers={{ custom: { layer } }}
        clientToWorld={(_canvas, cx, cy) => [cx, cy]}
      />
    );
    const canvas = container.querySelector('canvas')!;
    // Use createEvent + defineProperty pattern — jsdom's PointerEvent ignores
    // clientX/Y from the init dict shorthand (same pattern as other Canvas tests).
    const ev = createEvent.pointerMove(canvas);
    Object.defineProperty(ev, 'clientX', { value: 30 });
    Object.defineProperty(ev, 'clientY', { value: 40 });
    fireEvent(canvas, ev);
    expect(moveSpy).toHaveBeenCalled();
    const call = moveSpy.mock.calls[0];
    expect(call[0]).toBe(30);  // worldX
    expect(call[1]).toBe(40);  // worldY
  });

  it('layer.onUncapturedLeave fires on pointerleave', () => {
    const leaveSpy = vi.fn();
    const layer: RenderLayer<unknown> = {
      id: 'tracker', label: 'tracker', space: 'screen',
      draw: () => [],
      onUncapturedLeave: leaveSpy,
    };
    const ref = createRef<CanvasExtensionApi>();
    const { container } = render(
      <Canvas
        ref={ref}
        width={100} height={100}
        layers={{ custom: { layer } }}
      />
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerLeave(canvas);
    expect(leaveSpy).toHaveBeenCalled();
  });

  it('layer.onUncapturedMove is suppressed while a pointer is held', () => {
    // `onUncapturedMove` means "hover", so it stands down while a button is
    // down. That used to be decided by asking the tool dispatcher whether a
    // gesture was in flight; `<Canvas>` tracks the press itself now.
    const moveSpy = vi.fn();
    const layer: RenderLayer<unknown> = {
      id: 'tracker', label: 'tracker', space: 'screen',
      draw: () => [],
      onUncapturedMove: moveSpy,
    };
    const { container } = render(
      <Canvas width={100} height={100} layers={{ tracker: { layer } }} />,
    );
    const canvas = container.querySelector('canvas')!;

    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 20 });
    expect(moveSpy).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 30, clientY: 40 });
    expect(moveSpy).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 60 });
    expect(moveSpy).toHaveBeenCalledTimes(2);
  });
});
