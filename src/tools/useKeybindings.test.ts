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
    const select = defineTool({ id: 'select', keybinding: 'v' });
    const pen    = defineTool({ id: 'pen',    keybinding: 'p' });
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
    const hand   = defineTool({ id: 'hand', modifier: 'space' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      return tools;
    });

    expect(result.current.modifierEngaged).toBe(null);
    act(() => press(' ', 'keydown'));
    expect(result.current.modifierEngaged).toBe('hand');
    act(() => press(' ', 'keyup'));
    expect(result.current.modifierEngaged).toBe(null);
  });

  it('overrides remap a key to a different tool', () => {
    const select = defineTool({ id: 'select', keybinding: 'v' });
    const pen    = defineTool({ id: 'pen',    keybinding: 'p' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools, { overrides: { v: 'pen' } });
      return tools;
    });

    act(() => press('v'));
    expect(result.current.active).toBe('pen');
  });

  it('disable: true skips all wiring', () => {
    const select = defineTool({ id: 'select', keybinding: 'v' });
    const pen    = defineTool({ id: 'pen',    keybinding: 'p' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools, { disable: true });
      return tools;
    });

    act(() => press('p'));
    expect(result.current.active).toBe('select');
  });

  it('skips when focus is in an editable element', () => {
    const select = defineTool({ id: 'select', keybinding: 'v' });
    const pen    = defineTool({ id: 'pen',    keybinding: 'p' });
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
});
