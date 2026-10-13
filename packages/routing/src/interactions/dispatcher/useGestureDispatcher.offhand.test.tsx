import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { DepRegistryProvider, useDepSource } from '../actions/depRegistry';
import { ActiveToolContextProvider, useActiveToolContext, type ActiveToolContextValue } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import { makeToolOffhandAction, buildToolOffhandBindings } from '../../index';

describe('tool.offhand integration via gesture dispatcher', () => {
  it('Space keydown pushes hand to hotkeyStack; keyup pops it', () => {
    let ctxValue!: ActiveToolContextValue;

    function CtxCapture() {
      ctxValue = useActiveToolContext();
      return null;
    }

    function ActiveToolDepSource() {
      const ctx = useActiveToolContext();
      useDepSource('activeTool', () => ctx);
      return null;
    }

    function RegisterToolHold() {
      const r = useActionsRegistry();
      r?.register(makeToolOffhandAction(buildToolOffhandBindings([
        { toolId: 'hand', key: ' ' },
      ])));
      return null;
    }

    function MountDispatcher() {
      const ref = useRef<HTMLCanvasElement | null>(null);
      const r = useActionsRegistry();
      useGestureDispatcher({ canvasRef: ref, actions: r!, entriesById: new Map() });
      return <canvas ref={ref} />;
    }

    render(
      <DepRegistryProvider>
        <ActiveToolContextProvider>
            <ActionsProvider>
              <ActiveToolDepSource />
              <RegisterToolHold />
              <MountDispatcher />
              <CtxCapture />
            </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>,
    );

    // Initial state: no tools held
    expect(ctxValue.hotkeyStack).toEqual([]);

    // Press Space
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });
    expect(ctxValue.hotkeyStack).toEqual(['hand']);

    // Release Space
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    });
    expect(ctxValue.hotkeyStack).toEqual([]);
  });

  it('Space held across a window blur is released, not stuck', () => {
    let ctxValue!: ActiveToolContextValue;

    function CtxCapture() {
      ctxValue = useActiveToolContext();
      return null;
    }

    function ActiveToolDepSource() {
      const ctx = useActiveToolContext();
      useDepSource('activeTool', () => ctx);
      return null;
    }

    function RegisterToolHold() {
      const r = useActionsRegistry();
      r?.register(makeToolOffhandAction(buildToolOffhandBindings([
        { toolId: 'hand', key: ' ' },
      ])));
      return null;
    }

    function MountDispatcher() {
      const ref = useRef<HTMLCanvasElement | null>(null);
      const r = useActionsRegistry();
      useGestureDispatcher({ canvasRef: ref, actions: r!, entriesById: new Map() });
      return <canvas ref={ref} />;
    }

    render(
      <DepRegistryProvider>
        <ActiveToolContextProvider>
            <ActionsProvider>
              <ActiveToolDepSource />
              <RegisterToolHold />
              <MountDispatcher />
              <CtxCapture />
            </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });
    expect(ctxValue.hotkeyStack).toEqual(['hand']);

    // The window loses focus mid-hold, so the keyup never arrives.
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(ctxValue.hotkeyStack).toEqual([]);
  });
});
