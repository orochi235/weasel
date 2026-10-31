/**
 * A mode's `defaultTool` becomes active as the mode is entered, and the tool it
 * replaced comes back as the mode is left.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createModeRegistry, NORMAL, type ModeDefinition } from '@weasel-js/modes';
import { ActiveToolContextProvider } from '../interactions/actions/activeToolContext';
import { useTools } from './useTools';
import type { AnyTool } from './types';

const tool = (id: string): AnyTool => ({ id, eligibility: { focus: true }, bindings: [] }) as unknown as AnyTool;
const registry = { select: tool('select'), anchors: tool('anchors'), brush: tool('brush') };

const EDIT: ModeDefinition = { id: 'edit', kind: 'soft', allows: [], scoping: false, defaultTool: 'anchors' };
const BARE: ModeDefinition = { id: 'bare', kind: 'soft', allows: [], scoping: false };
const MISSING: ModeDefinition = { id: 'missing', kind: 'soft', allows: [], scoping: false, defaultTool: 'nope' };

function setup(initial = 'normal') {
  const modes = createModeRegistry({ modes: [NORMAL, EDIT, BARE, MISSING], initial });
  const wrapper = ({ children }: { children: ReactNode }) => <ActiveToolContextProvider>{children}</ActiveToolContextProvider>;
  const { result } = renderHook(() => useTools({ active: 'select', registry, modes }), { wrapper });
  const enter = (id: string) => act(() => modes.setMode(id));
  return { result, enter };
}

describe('a mode with a default tool', () => {
  it('activates it on entry and restores the prior tool on exit', () => {
    const { result, enter } = setup();
    enter('edit');
    expect(result.current.active).toBe('anchors');
    act(() => result.current.setActive('brush'));
    enter('normal');
    expect(result.current.active).toBe('select');
  });

  it('activates it when the canvas mounts already in the mode', () => {
    const { result, enter } = setup('edit');
    expect(result.current.active).toBe('anchors');
    enter('normal');
    expect(result.current.active).toBe('select');
  });

  it('restores the prior tool when leaving for a mode with none', () => {
    const { result, enter } = setup();
    enter('edit');
    enter('bare');
    expect(result.current.active).toBe('select');
  });

  it('leaves the tool alone in a mode with none, or one the canvas does not mount', () => {
    const { result, enter } = setup();
    enter('bare');
    expect(result.current.active).toBe('select');
    enter('missing');
    expect(result.current.active).toBe('select');
  });
});
