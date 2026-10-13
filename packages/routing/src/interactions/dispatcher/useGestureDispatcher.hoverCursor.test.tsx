import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';

function Probe({ actionDef, enabled = true, keyboard, affordanceAt, classifyTarget }: {
  actionDef: Action;
  enabled?: boolean;
  keyboard?: boolean;
  affordanceAt?: (p: { x: number; y: number }) => import('../actions/invoker').AffordanceHit | null;
  classifyTarget?: (p: { x: number; y: number }) => import('@weasel-js/gestures').BodyClassification;
}) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Always register (last-writer-wins is safe here)
  registry?.register(actionDef);
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById: new Map(),
    enabled,
    ...(keyboard !== undefined ? { keyboard } : {}),
    affordanceAt,
    classifyTarget,
  });
  return <canvas ref={canvasRef} />;
}

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          {children}
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}

describe('hover-cursor pump', () => {
  /** Fires a synthetic PointerEvent on the canvas element. */
  function fire(el: Element, type: string, init: PointerEventInit = {}) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
  }

  const panAction: Action = {
    id: 'viewport.dragPan',
    label: 'pan',
    defaultBinding: { kind: 'drag' },
    cursor: 'grab',
    invoker: {
      timing: 'ongoing',
      start: () => ({ onMove: () => {}, onEnd: () => {} }),
    },
  };

  it('idle pointermove applies the predicted action cursor; pointerleave clears it', () => {
    const { container } = render(
      <Harness>
        <Probe actionDef={panAction} classifyTarget={() => ({ body: 'empty' })} />
      </Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40 }); });
    expect(canvas.style.cursor).toBe('grab');
    act(() => { fire(canvas, 'pointerleave'); });
    expect(canvas.style.cursor).toBe('');
  });

  it('affordance hit cursor wins over action prediction', () => {
    const { container } = render(
      <Harness>
        <Probe
          actionDef={panAction}
          classifyTarget={() => ({ body: 'empty' })}
          affordanceAt={() => ({ kind: 'handle:min-min', cursor: 'nwse-resize' })}
        />
      </Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40 }); });
    expect(canvas.style.cursor).toBe('nwse-resize');
  });

  it('swaps to the in-flight action cursor once the gesture starts', () => {
    const grabbing: Action = { ...panAction, activeCursor: 'grabbing' };
    const { container } = render(
      <Harness>
        <Probe actionDef={grabbing} classifyTarget={() => ({ body: 'empty' })} />
      </Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointermove', { clientX: 0, clientY: 0 }); });
    expect(canvas.style.cursor).toBe('grab');
    // Press + drag past threshold: the pan handle opens.
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 30, clientY: 30, pointerId: 1 }); });
    expect(canvas.style.cursor).toBe('grabbing');
  });

  it('an in-flight action with no activeCursor holds its hover hint', () => {
    const { container } = render(
      <Harness>
        <Probe actionDef={panAction} classifyTarget={() => ({ body: 'empty' })} />
      </Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointermove', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 30, clientY: 30, pointerId: 1 }); });
    expect(canvas.style.cursor).toBe('grab');
  });

  it('leaves the cursor alone when the predicted action declares none', () => {
    const noCursorAction: Action = { ...panAction, id: 'no-cursor' };
    delete (noCursorAction as { cursor?: string }).cursor;
    const { container } = render(
      <Harness>
        <Probe actionDef={noCursorAction} classifyTarget={() => ({ body: 'empty' })} />
      </Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 40 }); });
    expect(canvas.style.cursor).toBe('');
  });

  const altClickAction: Action = {
    id: 'probe.altClick',
    label: 'alt click',
    defaultBinding: { kind: 'click', mods: { alt: true } },
    cursor: 'copy',
    enabled: (_deps, at) => (at === undefined || at.x < 20 ? true : 'not-applicable'),
    invoker: { timing: 'immediate', run: () => {} },
  };

  it('shows a click action\u2019s cursor where no drag would claim the press', () => {
    const { container } = render(<Harness><Probe actionDef={altClickAction} /></Harness>);
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointermove', { clientX: 10, clientY: 10, altKey: true }); });
    expect(canvas.style.cursor).toBe('copy');
    act(() => { fire(canvas, 'pointermove', { clientX: 10, clientY: 10 }); });
    expect(canvas.style.cursor).toBe('');
  });

  it('asks the click action\u2019s gate about the hovered point', () => {
    const { container } = render(<Harness><Probe actionDef={altClickAction} /></Harness>);
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointermove', { clientX: 40, clientY: 10, altKey: true }); });
    expect(canvas.style.cursor).toBe('');
  });
});
