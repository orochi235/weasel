// src/tools/integration.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Canvas } from 'canvas/Canvas';
import { useTools } from './useTools';
import { useKeybindings } from './useKeybindings';
import { defineTool } from './routing/defineTool';
import { begin, claim } from './routing/result';
import { ActiveToolContextProvider } from '../interactions/actions/activeToolContext';

describe('integration: define → use → key → canvas', () => {
  it('keybinding switches active tool, drag routes through new tool', () => {
    const selectDrag = vi.fn();
    const penDrag    = vi.fn();

    function App() {
      const tools = useTools({
        active: 'select',
        registry: {
          select: defineTool({
            id: 'select',
            keybinding: { key: 'v' },
            initial: {
              drag: () => {
                selectDrag();
                return begin({ scratch: null, onRelease: () => claim() });
              },
            },
          }),
          pen: defineTool({
            id: 'pen',
            keybinding: { key: 'p' },
            initial: {
              drag: () => {
                penDrag();
                return begin({ scratch: null, onRelease: () => claim() });
              },
            },
          }),
        },
      });
      useKeybindings(tools);
      return <Canvas width={100} height={100} adapter={{} as never} layers={{}} tools={tools} />;
    }

    const { container } = render(<ActiveToolContextProvider initialActive="select"><App /></ActiveToolContextProvider>);
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

});
