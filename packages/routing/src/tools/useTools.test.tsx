/**
 * `useTools` compares each render's tools against the last ones it kept, and
 * `has` answers from them. A render React throws away must leave neither its
 * tools nor its comparison behind.
 */
import { describe, expect, it } from 'vitest';
import { useLayoutEffect, useState } from 'react';
import { renderOutsideAct, renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { ActiveToolContextProvider } from '../interactions/actions/activeToolContext';
import { useTools, type ToolsApi } from './useTools';
import type { AnyTool } from './types';

const tool = (id: string): AnyTool => ({ id, eligibility: { focus: true }, bindings: [] }) as unknown as AnyTool;
const a = tool('a');
const b = tool('b');

function setup(): { committed: () => ToolsApi; bump: () => void } {
  let committed!: ToolsApi;
  let bump!: () => void;
  function Host({ registry }: { registry: Record<string, AnyTool> }): null {
    const [, set] = useState(0);
    bump = () => set((n) => n + 1);
    // A fresh literal every render, as callers commonly pass it.
    const tools = useTools({ registry: { ...registry } });
    useLayoutEffect(() => { committed = tools; });
    return null;
  }
  renderThenAbandon<Record<string, AnyTool>>({ a }, { a, b }, (registry) => (
    <ActiveToolContextProvider><Host registry={registry} /></ActiveToolContextProvider>
  ));
  return { committed: () => committed, bump: () => bump() };
}

describe('useTools after an abandoned render', () => {
  it('answers has() from the committed registry', () => {
    expect(setup().committed().has('b')).toBe(false);
  });

  it('keeps its identity on the next render of the same tools', () => {
    const { committed, bump } = setup();
    const before = committed();
    renderOutsideAct(bump);
    expect(committed()).toBe(before);
  });
});
