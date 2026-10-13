import { describe, it, expect, vi } from 'vitest';
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

describe('kind: target forms read the classifier’s node kind', () => {
  function fire(el: Element, type: string, init: PointerEventInit = {}) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
  }

  function clickOnce(container: HTMLElement) {
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 10, clientY: 10, pointerId: 1 }); });
  }

  const clickAction = (spy: () => void, target: string): Action => ({
    id: 'demo.kinded',
    label: 'kinded',
    defaultBinding: { kind: 'click', target: target as 'empty' },
    invoker: { timing: 'immediate', run: () => spy() },
  });

  it('fires when the classifier reports the bound kind', () => {
    const spy = vi.fn();
    const { container } = render(
      <Harness>
        <Probe
          actionDef={clickAction(spy, 'kind:text')}
          classifyTarget={() => ({ body: 'unselected-body', kind: 'text' })}
        />
      </Harness>,
    );
    clickOnce(container);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the classifier reports a different kind', () => {
    const spy = vi.fn();
    const { container } = render(
      <Harness>
        <Probe
          actionDef={clickAction(spy, 'kind:text')}
          classifyTarget={() => ({ body: 'unselected-body', kind: 'rect' })}
        />
      </Harness>,
    );
    clickOnce(container);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not fire when the classifier names no kind', () => {
    const spy = vi.fn();
    const { container } = render(
      <Harness>
        <Probe
          actionDef={clickAction(spy, 'kind:text')}
          classifyTarget={() => ({ body: 'unselected-body' })}
        />
      </Harness>,
    );
    clickOnce(container);
    expect(spy).not.toHaveBeenCalled();
  });

  it('the :selected suffix additionally requires the body to be selected', () => {
    const spy = vi.fn();
    const { container } = render(
      <Harness>
        <Probe
          actionDef={clickAction(spy, 'kind:text:selected')}
          classifyTarget={() => ({ body: 'unselected-body', kind: 'text' })}
        />
      </Harness>,
    );
    clickOnce(container);
    expect(spy).not.toHaveBeenCalled();
  });

  it('fires for :selected when the body is in the selection', () => {
    const spy = vi.fn();
    const { container } = render(
      <Harness>
        <Probe
          actionDef={clickAction(spy, 'kind:text:selected')}
          classifyTarget={() => ({ body: 'selected-body', kind: 'text' })}
        />
      </Harness>,
    );
    clickOnce(container);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
