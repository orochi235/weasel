import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, useActionsRegistry, useOngoingAction } from '@weasel-js/routing/react';
import type { Action, ActionsRegistry } from '@weasel-js/routing';
import { createDispatcher } from '@weasel-js/routing';

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

interface Calls {
  start: Array<Record<string, unknown> | undefined>;
  move: Array<Record<string, unknown> | undefined>;
  end: Array<'commit' | 'cancel'>;
}

function recording(id: string, calls: Calls): Action {
  return {
    id,
    label: id,
    invoker: {
      timing: 'ongoing',
      start: (ctx) => {
        calls.start.push(ctx.params);
        return {
          onMove: (c) => { calls.move.push(c.params); },
          onEnd: (_c, reason) => { calls.end.push(reason); },
        };
      },
    },
  };
}

/** A registry wired to a dispatcher, with `ids` registered as recording
 *  ongoing actions, and the hook under test mounted beside it. */
function setup(ids: string[], initialId = ids[0]) {
  const calls: Record<string, Calls> = {};
  for (const id of ids) calls[id] = { start: [], move: [], end: [] };
  const hook = renderHook(
    ({ id }: { id: string }) => ({ reg: useActionsRegistry(), edit: useOngoingAction(id) }),
    { wrapper: wrap, initialProps: { id: initialId } },
  );
  const reg = hook.result.current.reg as ActionsRegistry;
  act(() => { for (const id of ids) reg.register(recording(id, calls[id])); });
  const d = createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) });
  act(() => { reg.setDispatcher(d); });
  return { hook, calls };
}

describe('useOngoingAction', () => {
  it('opens the action on the first input and moves it on the rest', () => {
    const { hook, calls } = setup(['paint']);
    act(() => { hook.result.current.edit.input({ color: '#f00' }); });
    act(() => { hook.result.current.edit.input({ color: '#0f0' }); });
    act(() => { hook.result.current.edit.input({ color: '#00f' }); });
    expect(calls.paint.start).toEqual([{ color: '#f00' }]);
    expect(calls.paint.move).toEqual([{ color: '#0f0' }, { color: '#00f' }]);
    expect(calls.paint.end).toEqual([]);
  });

  it('commits with final params, then starts fresh on the next input', () => {
    const { hook, calls } = setup(['paint']);
    act(() => { hook.result.current.edit.input({ color: '#f00' }); });
    act(() => { hook.result.current.edit.commit({ color: '#0f0' }); });
    expect(calls.paint.move).toEqual([{ color: '#0f0' }]);
    expect(calls.paint.end).toEqual(['commit']);
    act(() => { hook.result.current.edit.input({ color: '#00f' }); });
    expect(calls.paint.start).toEqual([{ color: '#f00' }, { color: '#00f' }]);
  });

  it('runs a commit with no preceding input as one whole edit', () => {
    const { hook, calls } = setup(['paint']);
    act(() => { hook.result.current.edit.commit({ color: '#f00' }); });
    expect(calls.paint.start).toEqual([{ color: '#f00' }]);
    expect(calls.paint.move).toEqual([]);
    expect(calls.paint.end).toEqual(['commit']);
  });

  it('does nothing on a bare commit or cancel with no edit open', () => {
    const { hook, calls } = setup(['paint']);
    act(() => { hook.result.current.edit.commit(); });
    act(() => { hook.result.current.edit.cancel(); });
    expect(calls.paint.start).toEqual([]);
    expect(calls.paint.end).toEqual([]);
  });

  it('cancels an open edit', () => {
    const { hook, calls } = setup(['paint']);
    act(() => { hook.result.current.edit.input({ color: '#f00' }); });
    act(() => { hook.result.current.edit.cancel(); });
    act(() => { hook.result.current.edit.commit(); });
    expect(calls.paint.end).toEqual(['cancel']);
  });

  it('commits an open edit when the control unmounts', () => {
    const { hook, calls } = setup(['paint']);
    act(() => { hook.result.current.edit.input({ color: '#f00' }); });
    hook.unmount();
    expect(calls.paint.end).toEqual(['commit']);
  });

  it('commits the open edit on the old action when the id changes', () => {
    const { hook, calls } = setup(['fill', 'stroke']);
    act(() => { hook.result.current.edit.input({ color: '#f00' }); });
    hook.rerender({ id: 'stroke' });
    expect(calls.fill.end).toEqual(['commit']);
    act(() => { hook.result.current.edit.input({ color: '#0f0' }); });
    expect(calls.stroke.start).toEqual([{ color: '#0f0' }]);
  });

  it('keeps the same object across renders', () => {
    const { hook } = setup(['paint']);
    const first = hook.result.current.edit;
    hook.rerender({ id: 'paint' });
    expect(hook.result.current.edit).toBe(first);
  });

  it('is inert with no provider in scope', () => {
    const { result } = renderHook(() => useOngoingAction('paint'));
    expect(() => act(() => {
      result.current.input({ color: '#f00' });
      result.current.commit({ color: '#f00' });
      result.current.cancel();
    })).not.toThrow();
  });
});
