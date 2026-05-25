import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Action } from '../actions/registry';
import type { OngoingHandle, InvocationCtx } from '../actions/invoker';

function makeOngoingAction(id: string, hooks: Partial<OngoingHandle> & {
  onStart?: (ctx: InvocationCtx) => void;
}): Action {
  return {
    id,
    label: id,
    invoker: {
      timing: 'ongoing',
      start(ctx) {
        hooks.onStart?.(ctx);
        return {
          onMove: hooks.onMove,
          onEnd: hooks.onEnd,
          previewIds: hooks.previewIds,
          previewData: hooks.previewData,
          previewPose: hooks.previewPose,
        };
      },
    },
  };
}

describe('Dispatcher.beginUiOngoing', () => {
  it('returns null when the action is unknown', () => {
    const d = createDispatcher({ getAction: () => undefined });
    expect(d.beginUiOngoing('missing', {})).toBeNull();
  });

  it('returns null when the invoker is not ongoing', () => {
    const action: Action = {
      id: 'immediate',
      label: 'immediate',
      invoker: { timing: 'immediate', run: () => {} },
    };
    const d = createDispatcher({ getAction: (id) => id === action.id ? action : undefined });
    expect(d.beginUiOngoing('immediate', {})).toBeNull();
  });

  it('calls start with the given params, then onMove on update, then onEnd on end', () => {
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const action = makeOngoingAction('test', { onStart, onMove, onEnd });
    const d = createDispatcher({ getAction: (id) => id === 'test' ? action : undefined });

    const ctrl = d.beginUiOngoing('test', { selection: 'sel-stub' }, { color: '#ff0000' });
    expect(ctrl).not.toBeNull();
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart.mock.calls[0][0].params).toEqual({ color: '#ff0000' });
    expect(onStart.mock.calls[0][0].deps).toEqual({ selection: 'sel-stub' });

    ctrl!.update({ color: '#00ff00' });
    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove.mock.calls[0][0].params).toEqual({ color: '#00ff00' });

    ctrl!.end('commit');
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0][1]).toBe('commit');
  });

  it('registers the handle in inFlight so getInFlightHandles reports it', () => {
    const action = makeOngoingAction('test', {
      onMove: vi.fn(),
      onEnd: vi.fn(),
      previewIds: () => ['a'],
    });
    const d = createDispatcher({ getAction: () => action });

    const ctrl = d.beginUiOngoing('test', {}, {});
    expect(ctrl).not.toBeNull();
    expect([...d.getInFlightHandles()].length).toBe(1);
    ctrl!.end('commit');
    expect([...d.getInFlightHandles()].length).toBe(0);
  });

  it('end is idempotent', () => {
    const onEnd = vi.fn();
    const action = makeOngoingAction('test', { onMove: vi.fn(), onEnd });
    const d = createDispatcher({ getAction: () => action });

    const ctrl = d.beginUiOngoing('test', {}, {})!;
    ctrl.end('commit');
    ctrl.end('cancel');
    ctrl.end('commit');
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('update is a no-op after end', () => {
    const onMove = vi.fn();
    const action = makeOngoingAction('test', { onMove, onEnd: vi.fn() });
    const d = createDispatcher({ getAction: () => action });

    const ctrl = d.beginUiOngoing('test', {}, {})!;
    ctrl.end('commit');
    ctrl.update({ color: '#abcdef' });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('auto-commits a prior UI handle for the same actionId before starting a new one', () => {
    const onEnd = vi.fn();
    const action = makeOngoingAction('test', { onMove: vi.fn(), onEnd });
    const d = createDispatcher({ getAction: () => action });

    const a = d.beginUiOngoing('test', {}, { v: 1 })!;
    const b = d.beginUiOngoing('test', {}, { v: 2 })!;
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0][1]).toBe('commit');
    expect(a.gestureId).not.toBe(b.gestureId);
    b.end('commit');
  });

  it('returns null when start returns an empty handle', () => {
    const action = makeOngoingAction('test', {});
    const d = createDispatcher({ getAction: () => action });
    expect(d.beginUiOngoing('test', {}, {})).toBeNull();
  });

  it('cancelAll fires onEnd with cancel reason and clears uiOngoingByAction so the same actionId can be started fresh', () => {
    const onEnd = vi.fn();
    const action = makeOngoingAction('test', { onMove: vi.fn(), onEnd });
    const d = createDispatcher({ getAction: () => action });

    // Start a UI-driven handle.
    d.beginUiOngoing('test', {}, { v: 1 });
    expect([...d.getInFlightHandles()].length).toBe(1);

    // cancelAll should fire onEnd with 'cancel' and clear internal state.
    d.cancelAll('cancel');
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0][1]).toBe('cancel');
    expect([...d.getInFlightHandles()].length).toBe(0);

    // Starting the same actionId again must NOT double-fire onEnd (no stale
    // uiOngoingByAction entry) and must succeed cleanly.
    const ctrl2 = d.beginUiOngoing('test', {}, { v: 2 });
    expect(ctrl2).not.toBeNull();
    expect(onEnd).toHaveBeenCalledOnce(); // still only once
    ctrl2!.end('commit');
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('subscribers are notified on begin / update / end', () => {
    const action = makeOngoingAction('test', { onMove: vi.fn(), onEnd: vi.fn() });
    const d = createDispatcher({ getAction: () => action });
    const sub = vi.fn();
    d.subscribe(sub);

    const ctrl = d.beginUiOngoing('test', {}, {})!;
    expect(sub).toHaveBeenCalledTimes(1);
    ctrl.update({ x: 1 });
    expect(sub).toHaveBeenCalledTimes(2);
    ctrl.end('commit');
    expect(sub).toHaveBeenCalledTimes(3);
  });
});
