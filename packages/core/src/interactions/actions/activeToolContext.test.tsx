import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { ActiveToolContextProvider, useActiveToolContext, type ActiveToolContextValue } from '@weasel-js/routing/react';

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

  // Releases do not have to arrive in stack order: each offhand hold is its own
  // in-flight handle, keyed per held key, so whichever key comes up first ends
  // its own handle. Popping the top instead disengages the wrong tool and
  // leaves the released one engaged with its key up.
  it('popHotkey(id) removes that entry, not whatever is on top', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    act(() => { captured!.pushHotkey('hand'); });
    act(() => { captured!.pushHotkey('eyedropper'); });
    act(() => { captured!.popHotkey('hand'); });
    expect(captured!.hotkeyStack).toEqual(['eyedropper']);
  });

  it('popHotkey(id) for an id not held leaves the stack alone', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    act(() => { captured!.pushHotkey('hand'); });
    act(() => { captured!.popHotkey('eyedropper'); });
    expect(captured!.hotkeyStack).toEqual(['hand']);
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
