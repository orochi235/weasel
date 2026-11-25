/** A window blur mid-pinch ends the dispatched pinch; the rest of that WebKit gesture is held from the page, not stepped from a reset baseline. */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';

function Probe({ run }: { run: (scale: unknown) => void }): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => registry.register({
    id: 'test.pinch', label: 'pinch', defaultBinding: { kind: 'pinch' },
    invoker: { timing: 'immediate', run: (_deps, params) => run((params as { scale?: unknown } | undefined)?.scale) },
  }), [registry, run]);
  useGestureDispatcher({ canvasRef, actions: registry, entriesById: new Map() });
  return <canvas ref={canvasRef} />;
}

const gesture = (type: string, scale: number): Event =>
  Object.assign(new Event(type, { bubbles: true, cancelable: true }), { scale, rotation: 0, clientX: 0, clientY: 0 });

describe('a window blur during a WebKit pinch', () => {
  it('dispatches no step from the rest of that gesture, and keeps it from the page', () => {
    const run = vi.fn();
    render(
      <DepRegistryProvider><ActionsProvider><ActiveToolContextProvider><Probe run={run} /></ActiveToolContextProvider></ActionsProvider></DepRegistryProvider>,
    );
    const c = document.querySelector('canvas')!;
    act(() => {
      c.dispatchEvent(gesture('gesturestart', 1));
      c.dispatchEvent(gesture('gesturechange', 1.8));
      window.dispatchEvent(new Event('blur'));
    });
    const late = gesture('gesturechange', 1.82);
    act(() => { c.dispatchEvent(late); });
    expect(run).toHaveBeenCalledTimes(1);
    expect(late.defaultPrevented).toBe(true);

    act(() => {
      c.dispatchEvent(gesture('gestureend', 1.82));
      c.dispatchEvent(gesture('gesturestart', 1));
      c.dispatchEvent(gesture('gesturechange', 1.1));
    });
    expect(run).toHaveBeenCalledTimes(2);
  });
});
