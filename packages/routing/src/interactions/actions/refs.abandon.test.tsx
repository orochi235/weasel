/**
 * Hooks in the actions layer hold their latest arguments in refs for code
 * that runs later — a dep read at dispatch, a control's input. A render React
 * throws away must not leave its arguments there.
 */
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { useEffect, useLayoutEffect } from 'react';
import { renderThenAbandon } from '../../testing/abandonRender';
import { DepRegistryProvider, useDepRegistry, useDepSource, type DepRegistry } from './depRegistry';
import { ActionsProvider, useAction, useActionsRegistry } from './ActionsProvider';
import { createDispatcher } from '../dispatcher/dispatcher';
import { useOngoingAction, type OngoingAction } from './useOngoingAction';
import type { Action } from './action';

describe('useDepSource after an abandoned render', () => {
  it('answers with the committed source', () => {
    let registry!: DepRegistry;
    function Source({ v }: { v: string }): null {
      registry = useDepRegistry();
      useDepSource('activeTool', () => v as never);
      return null;
    }
    renderThenAbandon('committed', 'abandoned', (v) => (
      <DepRegistryProvider><Source v={v} /></DepRegistryProvider>
    ));
    expect(registry.get('activeTool')).toBe('committed');
  });
});

describe('useOngoingAction after an abandoned render', () => {
  it('opens the committed action id', () => {
    const begun: string[] = [];
    const ongoing = (id: string): Action => ({
      id,
      label: id,
      invoker: { timing: 'ongoing', start: () => { begun.push(id); return {}; } },
    });
    const a = ongoing('a');
    const b = ongoing('b');
    let edit!: OngoingAction;
    function Control({ id }: { id: string }): null {
      const reg = useActionsRegistry()!;
      useAction(a);
      useAction(b);
      useEffect(() => reg.setDispatcher(createDispatcher({ getAction: (x) => reg.list().find((r) => r.id === x) })), [reg]);
      const e = useOngoingAction(id);
      useLayoutEffect(() => { edit = e; });
      return null;
    }
    renderThenAbandon('a', 'b', (id) => (
      <DepRegistryProvider><ActionsProvider><Control id={id} /></ActionsProvider></DepRegistryProvider>
    ));
    act(() => { edit.input({}); });
    expect(begun).toEqual(['a']);
  });
});
