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
  it('switches active tool on keybinding press', () => {
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

  it('registers a tool.hold.<id> action in the actions registry for each tool with a hotkey', () => {
    const select = defineTool({ id: 'select', initial: {} });
    const hand   = defineTool({ id: 'hand', hotkey: 'space', initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      // Return the registry ref so tests can call .list() after effects run.
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    // Effects have run at this point (renderHook flushes them).
    const ids = result.current?.list().map((a) => a.id) ?? [];
    expect(ids).toContain('tool.hold.hand');
    // No hold action for select (no hotkey)
    expect(ids).not.toContain('tool.hold.select');
  });

  it('tool.hold action has key-held defaultBinding for the correct key', () => {
    const select = defineTool({ id: 'select', initial: {} });
    const hand   = defineTool({ id: 'hand', hotkey: 'space', initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const holdAction = result.current?.list().find((a) => a.id === 'tool.hold.hand');
    expect(holdAction).toBeDefined();
    // defaultBinding should be a key-held spec for Space (' ')
    expect(holdAction?.defaultBinding).toMatchObject({ kind: 'key-held', key: ' ' });
  });

  it('registers hold actions for alt, ctrl, meta, shift hotkeys with correct keys', () => {
    const select    = defineTool({ id: 'select',     initial: {} });
    const altTool   = defineTool({ id: 'altTool',    hotkey: 'alt',   initial: {} });
    const ctrlTool  = defineTool({ id: 'ctrlTool',   hotkey: 'ctrl',  initial: {} });
    const metaTool  = defineTool({ id: 'metaTool',   hotkey: 'meta',  initial: {} });
    const shiftTool = defineTool({ id: 'shiftTool',  hotkey: 'shift', initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({
        active: 'select',
        registry: { select, altTool, ctrlTool, metaTool, shiftTool },
      });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const byId = Object.fromEntries((result.current?.list() ?? []).map((a) => [a.id, a]));
    expect(byId['tool.hold.altTool']?.defaultBinding).toMatchObject({ kind: 'key-held', key: 'Alt' });
    expect(byId['tool.hold.ctrlTool']?.defaultBinding).toMatchObject({ kind: 'key-held', key: 'Control' });
    expect(byId['tool.hold.metaTool']?.defaultBinding).toMatchObject({ kind: 'key-held', key: 'Meta' });
    expect(byId['tool.hold.shiftTool']?.defaultBinding).toMatchObject({ kind: 'key-held', key: 'Shift' });
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

  it('overrides remap a tool to a different binding', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' }, initial: {} });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' }, initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      // Remap `pen` to the `v` key — `select`'s `v` binding still loses out
      // because pen sits earlier in the override-aware match walk.
      useKeybindings(tools, { overrides: { pen: { key: 'v' } } });
      return tools;
    }, { wrapper: makeWrapper('select') });

    act(() => press('v'));
    expect(result.current.active).toBe('pen');
  });

  it('overrides: null unbinds the tool entirely', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' }, initial: {} });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' }, initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools, { overrides: { pen: null } });
      return tools;
    }, { wrapper: makeWrapper('select') });
    act(() => press('p'));
    expect(result.current.active).toBe('select');
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
    const hand   = defineTool({ id: 'hand', hotkey: 'space', initial: {} });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools, { disable: true });
      const reg = useActionsRegistry();
      return reg?.list() ?? [];
    }, { wrapper: makeWrapper('select') });

    const ids = result.current.map((a) => a.id);
    expect(ids).not.toContain('tool.hold.hand');
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
