// src/tools/useKeybindings.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTools } from './useTools';
import { useKeybindings } from './useKeybindings';
import { defineTool } from './defineTool';

function press(key: string, type: 'keydown' | 'keyup' = 'keydown'): void {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

describe('useKeybindings', () => {
  it('switches active tool on keybinding press', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return tools;
    });

    expect(result.current.active).toBe('select');
    act(() => press('p'));
    expect(result.current.active).toBe('pen');
    act(() => press('v'));
    expect(result.current.active).toBe('select');
  });

  it('engages modifier-slot tool on modifier-key down, disengages on key-up', () => {
    const select = defineTool({ id: 'select' });
    const hand   = defineTool({ id: 'hand', hotkey: 'space' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      return tools;
    });

    expect(result.current.hotkeyEngaged).toBe(null);
    act(() => press(' ', 'keydown'));
    expect(result.current.hotkeyEngaged).toBe('hand');
    act(() => press(' ', 'keyup'));
    expect(result.current.hotkeyEngaged).toBe(null);
  });

  it('lets meta/ctrl combos through (system shortcuts like Cmd-R reload)', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const insert = defineTool({ id: 'insert', keybinding: { key: 'r' } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, insert } });
      useKeybindings(tools);
      return tools;
    });

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
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      // Remap `pen` to the `v` key — `select`'s `v` binding still loses out
      // because pen sits earlier in the override-aware match walk.
      useKeybindings(tools, { overrides: { pen: { key: 'v' } } });
      return tools;
    });

    act(() => press('v'));
    expect(result.current.active).toBe('pen');
  });

  it('overrides: null unbinds the tool entirely', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools, { overrides: { pen: null } });
      return tools;
    });
    act(() => press('p'));
    expect(result.current.active).toBe('select');
  });

  it('supports mod-aware bindings (Cmd+D)', () => {
    const select  = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const stylize = defineTool({ id: 'stylize', keybinding: { key: 'd', mod: true } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, stylize } });
      useKeybindings(tools);
      return tools;
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));
    });
    expect(result.current.active).toBe('stylize');
  });

  it('disable: true skips all wiring', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools, { disable: true });
      return tools;
    });

    act(() => press('p'));
    expect(result.current.active).toBe('select');
  });

  it('skips when focus is in an editable element', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' } });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return tools;
    });

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    });
    expect(result.current.active).toBe('select');

    document.body.removeChild(input);
  });

  describe('Escape returns to default tool', () => {
    it('Escape switches active tool back to the initial active by default', () => {
      const select = defineTool({ id: 'select' });
      const pen    = defineTool({ id: 'pen', keybinding: { key: 'p' } });
      const { result } = renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen } });
        useKeybindings(tools);
        return tools;
      });

      act(() => press('p'));
      expect(result.current.active).toBe('pen');
      act(() => press('Escape'));
      expect(result.current.active).toBe('select');
    });

    it('explicit defaultTool wins over the snapshotted initial', () => {
      const select = defineTool({ id: 'select' });
      const pen    = defineTool({ id: 'pen', keybinding: { key: 'p' } });
      const hand   = defineTool({ id: 'hand', keybinding: { key: 'h' } });
      const { result } = renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen, hand } });
        useKeybindings(tools, { defaultTool: 'hand' });
        return tools;
      });

      act(() => press('p'));
      expect(result.current.active).toBe('pen');
      act(() => press('Escape'));
      expect(result.current.active).toBe('hand');
    });

    it('defaultTool: null disables the Escape behavior', () => {
      const select = defineTool({ id: 'select' });
      const pen    = defineTool({ id: 'pen', keybinding: { key: 'p' } });
      const { result } = renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen } });
        useKeybindings(tools, { defaultTool: null });
        return tools;
      });

      act(() => press('p'));
      expect(result.current.active).toBe('pen');
      act(() => press('Escape'));
      expect(result.current.active).toBe('pen');
    });
  });
});
