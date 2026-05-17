import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  ActiveToolContextProvider,
  useActiveToolContext,
  type ActiveToolContextValue,
} from './activeToolContext';

describe('ActiveToolContext', () => {
  function Probe({ onValue }: { onValue: (v: ActiveToolContextValue) => void }) {
    const value = useActiveToolContext();
    onValue(value);
    return null;
  }

  it('default initialActive is "select"', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    expect(captured).not.toBeNull();
    expect(captured!.active).toBe('select');
    expect(captured!.hotkeyStack).toEqual([]);
  });

  it('initialActive prop overrides the default', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider initialActive="rect">
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    expect(captured).not.toBeNull();
    expect(captured!.active).toBe('rect');
  });

  it('setActive updates the active id', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    expect(captured).not.toBeNull();
    act(() => { captured!.setActive('text'); });
    expect(captured!.active).toBe('text');
  });

  it('pushHotkey appends to hotkeyStack; popHotkey removes the top', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    expect(captured).not.toBeNull();
    act(() => { captured!.pushHotkey('hand'); });
    expect(captured!.hotkeyStack).toEqual(['hand']);
    act(() => { captured!.pushHotkey('eyedropper'); });
    expect(captured!.hotkeyStack).toEqual(['hand', 'eyedropper']);
    act(() => { captured!.popHotkey(); });
    expect(captured!.hotkeyStack).toEqual(['hand']);
    act(() => { captured!.popHotkey(); });
    expect(captured!.hotkeyStack).toEqual([]);
  });

  it('popHotkey on empty stack is a safe no-op', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    expect(captured).not.toBeNull();
    act(() => { captured!.popHotkey(); });
    expect(captured!.hotkeyStack).toEqual([]);
  });

  it('useActiveToolContext outside a provider throws a clear error', () => {
    function Bare() {
      useActiveToolContext();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/ActiveToolContextProvider/);
    spy.mockRestore();
  });
});
