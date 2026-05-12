// src/tools/integration.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Canvas } from 'canvas/Canvas';
import { useTools } from './useTools';
import { useKeybindings } from './useKeybindings';
import { defineTool } from './defineTool';

describe('Phase 1 integration: define → use → key → canvas', () => {
  it('keybinding switches active tool, drag routes through new tool', () => {
    const selectDrag = vi.fn(() => 'claim' as const);
    const penDrag    = vi.fn(() => 'claim' as const);

    function App() {
      const tools = useTools({
        active: 'select',
        registry: {
          select: defineTool({ id: 'select', keybinding: { key: 'v' }, drag: { onStart: selectDrag } }),
          pen:    defineTool({ id: 'pen',    keybinding: { key: 'p' }, drag: { onStart: penDrag } }),
        },
      });
      useKeybindings(tools);
      return <Canvas width={100} height={100} adapter={{} as never} layers={{}} tools={tools} />;
    }

    const { container } = render(<App />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    // 1. Drag with select active.
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(selectDrag).toHaveBeenCalledOnce();
    expect(penDrag).not.toHaveBeenCalled();

    // 2. Press 'p' to switch.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    });

    // 3. Drag with pen active.
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(penDrag).toHaveBeenCalledOnce();
    expect(selectDrag).toHaveBeenCalledOnce(); // not called again
  });

  it('modifier-slot tool engages while space is held', () => {
    const handDrag = vi.fn(() => 'claim' as const);
    const selectDrag = vi.fn(() => 'claim' as const);

    function App() {
      const tools = useTools({
        active: 'select',
        registry: {
          select: defineTool({ id: 'select', drag: { onStart: selectDrag } }),
          hand:   defineTool({ id: 'hand', hotkey: 'space', drag: { onStart: handDrag } }),
        },
      });
      useKeybindings(tools);
      return <Canvas width={100} height={100} adapter={{} as never} layers={{}} tools={tools} />;
    }

    const { container } = render(<App />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = vi.fn();

    // Engage space.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });

    // Drag — should hit hand, not select.
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(handDrag).toHaveBeenCalledOnce();
    expect(selectDrag).not.toHaveBeenCalled();

    // Release space.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    });

    // Drag — back to select.
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 50, clientY: 10, pointerId: 1 });

    expect(selectDrag).toHaveBeenCalledOnce();
    expect(handDrag).toHaveBeenCalledOnce(); // not called again
  });
});
