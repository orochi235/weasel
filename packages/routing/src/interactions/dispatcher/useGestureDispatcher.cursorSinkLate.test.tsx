/** A surface's cursor sink that arrives after the hover cursor has already written to the canvas. */
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef, type ReactNode } from 'react';
import type { CursorSink } from '@weasel-js/cursor';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';

const pan: Action = {
  id: 'viewport.dragPan',
  label: 'pan',
  defaultBinding: { kind: 'drag' },
  cursor: 'grab',
  invoker: { timing: 'ongoing', start: () => ({ onMove: () => {}, onEnd: () => {} }) },
};

function Probe({ sink }: { sink: () => CursorSink | undefined }): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  registry.register(pan);
  useGestureDispatcher({
    canvasRef, actions: registry, entriesById: new Map(), cursorSink: sink,
    classifyTarget: () => ({ bodyTarget: 'empty' }),
  });
  return <canvas ref={canvasRef} />;
}

describe('a cursor sink that arrives after the first hover', () => {
  it('clears the override the canvas was given before it', () => {
    const held: { sink?: CursorSink } = {};
    const { container } = render(
      <DepRegistryProvider><ActiveToolContextProvider><ActionsProvider>
        <Probe sink={() => held.sink} />
      </ActionsProvider></ActiveToolContextProvider></DepRegistryProvider>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 40, clientY: 40 })); });
    expect(canvas.style.cursor).toBe('grab');
    held.sink = { setBase: () => {}, setOverride: () => {} };
    act(() => { canvas.dispatchEvent(new PointerEvent('pointerleave')); });
    expect(canvas.style.cursor).toBe('');
  });
});
