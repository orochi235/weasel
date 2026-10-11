/**
 * `onActivate` and `onDeactivate` bracket one stretch of a tool being live,
 * so what the first leaves on `scratch` is there for the second to release.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import {
  ActiveToolContextProvider,
  useActiveToolContext,
  type ActiveToolContextValue,
} from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Tool } from '../../tools/types';

interface Scratch { subscription?: string }

function mount(): { tools: () => ActiveToolContextValue; log: string[] } {
  const log: string[] = [];
  let made = 0;
  const pen: Tool<Scratch> = {
    id: 'pen',
    eligibility: { focus: true },
    initScratch: () => { made += 1; return {}; },
    onActivate: ({ scratch }) => { scratch.subscription = `sub-${made}`; },
    onDeactivate: ({ scratch }) => { log.push(`released ${scratch.subscription}`); },
  };
  const entries = new Map([[pen.id, pen as Tool<unknown>]]);
  let ctx!: ActiveToolContextValue;
  function Mount(): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    ctx = useActiveToolContext();
    useGestureDispatcher({ canvasRef, actions: registry!, entriesById: entries });
    return <canvas ref={canvasRef} />;
  }
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Mount /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return { tools: () => ctx, log };
}

describe('a tool\'s lifecycle scratch', () => {
  it('is the same object from onActivate to onDeactivate', () => {
    const { tools, log } = mount();
    act(() => { tools().setActive('pen'); });
    act(() => { tools().setActive(null); });
    expect(log).toEqual(['released sub-1']);
  });

  it('is made afresh each time the tool becomes live', () => {
    const { tools, log } = mount();
    act(() => { tools().setActive('pen'); });
    act(() => { tools().setActive(null); });
    act(() => { tools().setActive('pen'); });
    act(() => { tools().setActive(null); });
    expect(log).toEqual(['released sub-1', 'released sub-2']);
  });
});
