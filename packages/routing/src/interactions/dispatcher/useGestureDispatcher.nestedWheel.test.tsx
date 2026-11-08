/** Which of two nested surfaces a wheel goes to: the innermost it landed in, then the one around it. */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';

const NO_ENTRIES = new Map();

function Root({ children }: { children: ReactNode }): ReactNode {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>{children}</ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

/** A dispatcher on `surface` whose wheel binding calls `run`, or binds nothing when `run` is absent. */
function WheelOn({ surface, run }: { surface: RefObject<HTMLElement | null>; run?: () => void }): null {
  const registry = useActionsRegistry()!;
  useEffect(() => (run ? registry.register({
    id: 'test.wheel',
    label: 'Wheel',
    defaultBinding: { kind: 'wheel' },
    invoker: { timing: 'immediate', run: () => run() },
  } satisfies Action) : undefined), [registry, run]);
  useGestureDispatcher({ canvasRef: surface, actions: registry, entriesById: NO_ENTRIES });
  return null;
}

function Nested({ outer, inner }: { outer: () => void; inner?: () => void }): ReactNode {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLCanvasElement | null>(null);
  return (
    <div ref={outerRef}>
      <WheelOn surface={outerRef} run={outer} />
      <Root>
        <WheelOn surface={innerRef} {...(inner ? { run: inner } : {})} />
        <canvas ref={innerRef} />
      </Root>
    </div>
  );
}

const wheel = (): void => {
  act(() => { document.querySelector('canvas')!.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true, cancelable: true })); });
};

describe('a wheel over a surface nested in another', () => {
  it('goes to the inner surface, and not on to the outer one once taken', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(<Root><Nested outer={outer} inner={inner} /></Root>);
    wheel();
    expect([outer.mock.calls.length, inner.mock.calls.length]).toEqual([0, 1]);
  });

  it('goes on to the outer surface when the inner one binds no wheel', () => {
    const outer = vi.fn();
    render(<Root><Nested outer={outer} /></Root>);
    wheel();
    expect(outer).toHaveBeenCalledTimes(1);
  });
});
