// src/tools/useKeybindings.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useTools } from './useTools';
import { useKeybindings } from './useKeybindings';
import { defineTool } from './routing/defineTool';
import { ActiveToolContextProvider } from '../interactions/actions/activeToolContext';
import { ActionsProvider } from '../interactions/actions/registry';
import { useActionsRegistry } from '../interactions/actions/registry';

function press(key: string, type: 'keydown' | 'keyup' = 'keydown'): void {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

function makeWrapper(initialActive = 'select') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      ActionsProvider,
      null,
      createElement(ActiveToolContextProvider, { initialActive, children }),
    );
  };
}

describe('useKeybindings', () => {
  it('switches active tool on ToolDef keybinding press', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' }, initial: {} });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' }, initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return tools;
    }, { wrapper: makeWrapper('select') });

    expect(result.current.active).toBe('select');
    act(() => press('p'));
    expect(result.current.active).toBe('pen');
    act(() => press('v'));
    expect(result.current.active).toBe('select');
  });

  it('registers tool.select.<id> actions for built-in tools in BUILTIN_SELECT_KEYS', () => {
    const select = defineTool({ id: 'select', initial: {} });
    const pen    = defineTool({ id: 'pen',    initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const ids = result.current?.list().map((a) => a.id) ?? [];
    expect(ids).toContain('tool.select.select');
    expect(ids).toContain('tool.select.pen');
  });

  it('registers tool.select.<id> action for tools with a ToolDef keybinding', () => {
    const select = defineTool({ id: 'select', initial: {} });
    const lasso  = defineTool({ id: 'lasso',  keybinding: { key: 'L' }, initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, lasso } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const action = result.current?.list().find((a) => a.id === 'tool.select.lasso');
    expect(action).toBeDefined();
    expect(action?.defaultBinding).toMatchObject({ kind: 'key', key: 'L' });
  });

  it('registers a tool.hold.hand action in the actions registry (static BUILTIN_HOLD_ACTIONS)', () => {
    const select = defineTool({ id: 'select', initial: {} });
    const hand   = defineTool({ id: 'hand',   initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const ids = result.current?.list().map((a) => a.id) ?? [];
    expect(ids).toContain('tool.hold.hand');
    // No hold action for select (not in BUILTIN_HOLD_ACTIONS)
    expect(ids).not.toContain('tool.hold.select');
  });

  it('tool.hold.hand action has key-held defaultBinding for Space', () => {
    const select = defineTool({ id: 'select', initial: {} });
    const hand   = defineTool({ id: 'hand',   initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const holdAction = result.current?.list().find((a) => a.id === 'tool.hold.hand');
    expect(holdAction).toBeDefined();
    expect(holdAction?.defaultBinding).toMatchObject({ kind: 'key-held', key: ' ' });
  });

  it('does not register tool.hold.hand when hand tool is absent from the registry', () => {
    const select = defineTool({ id: 'select', initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const ids = result.current?.list().map((a) => a.id) ?? [];
    expect(ids).not.toContain('tool.hold.hand');
  });

  it('lets meta/ctrl combos through (system shortcuts like Cmd-R reload)', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' }, initial: {} });
    const insert = defineTool({ id: 'insert', keybinding: { key: 'r' }, initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, insert } });
      useKeybindings(tools);
      return tools;
    }, { wrapper: makeWrapper('select') });

    // Cmd-R must NOT switch tools (browser reload).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', metaKey: true, bubbles: true }));
    });
    expect(result.current.active).toBe('select');

    // Ctrl-R likewise.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));
    });
    expect(result.current.active).toBe('select');

    // Bare R still switches.
    act(() => press('r'));
    expect(result.current.active).toBe('insert');
  });

  it('supports mod-aware bindings (Cmd+D)', () => {
    const select  = defineTool({ id: 'select', keybinding: { key: 'v' }, initial: {} });
    const stylize = defineTool({ id: 'stylize', keybinding: { key: 'd', mod: true }, initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, stylize } });
      useKeybindings(tools);
      return tools;
    }, { wrapper: makeWrapper('select') });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));
    });
    expect(result.current.active).toBe('stylize');
  });

  it('disable: true skips all wiring', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' }, initial: {} });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' }, initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools, { disable: true });
      return tools;
    }, { wrapper: makeWrapper('select') });

    act(() => press('p'));
    expect(result.current.active).toBe('select');
  });

  it('disable: true also skips tool.hold registration', () => {
    const select = defineTool({ id: 'select', initial: {} });
    const hand   = defineTool({ id: 'hand',   initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools, { disable: true });
      const reg = useActionsRegistry();
      return reg?.list() ?? [];
    }, { wrapper: makeWrapper('select') });

    const ids = result.current.map((a) => a.id);
    expect(ids).not.toContain('tool.hold.hand');
    expect(ids).not.toContain('tool.select.select');
  });

  it('skips when focus is in an editable element', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' }, initial: {} });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' }, initial: {} });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return tools;
    }, { wrapper: makeWrapper('select') });

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    });
    expect(result.current.active).toBe('select');

    document.body.removeChild(input);
  });

  describe('Escape returns to default tool', () => {
    it('Escape switches active tool back to the initial active by default', () => {
      const select = defineTool({ id: 'select', initial: {} });
      const pen    = defineTool({ id: 'pen', keybinding: { key: 'p' }, initial: {} });
      const { result } = renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen } });
        useKeybindings(tools);
        return tools;
      }, { wrapper: makeWrapper('select') });

      act(() => press('p'));
      expect(result.current.active).toBe('pen');
      act(() => press('Escape'));
      expect(result.current.active).toBe('select');
    });

    it('explicit defaultTool wins over the snapshotted initial', () => {
      const select = defineTool({ id: 'select', initial: {} });
      const pen    = defineTool({ id: 'pen', keybinding: { key: 'p' }, initial: {} });
      const hand   = defineTool({ id: 'hand', keybinding: { key: 'h' }, initial: {} });
      const { result } = renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen, hand } });
        useKeybindings(tools, { defaultTool: 'hand' });
        return tools;
      }, { wrapper: makeWrapper('select') });

      act(() => press('p'));
      expect(result.current.active).toBe('pen');
      act(() => press('Escape'));
      expect(result.current.active).toBe('hand');
    });

    it('defaultTool: null disables the Escape behavior', () => {
      const select = defineTool({ id: 'select', initial: {} });
      const pen    = defineTool({ id: 'pen', keybinding: { key: 'p' }, initial: {} });
      const { result } = renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen } });
        useKeybindings(tools, { defaultTool: null });
        return tools;
      }, { wrapper: makeWrapper('select') });

      act(() => press('p'));
      expect(result.current.active).toBe('pen');
      act(() => press('Escape'));
      expect(result.current.active).toBe('pen');
    });
  });
});
