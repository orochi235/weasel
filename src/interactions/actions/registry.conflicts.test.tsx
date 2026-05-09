import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ActionsProvider, useAction } from './registry';

describe('Action registry conflicts', () => {
  it('a tool registering id "escape" overrides the default while mounted', () => {
    const defaultRun = vi.fn();
    const toolRun = vi.fn();
    function Default() {
      useAction({ id: 'escape', label: 'Default', defaultBinding: { key: 'Escape' }, run: defaultRun });
      return null;
    }
    function Tool() {
      useAction({ id: 'escape', label: 'Tool',    defaultBinding: { key: 'Escape' }, run: toolRun });
      return null;
    }
    render(<ActionsProvider><Default /><Tool /></ActionsProvider>);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(toolRun).toHaveBeenCalledOnce();
    expect(defaultRun).not.toHaveBeenCalled();
  });

  it('after the tool unmounts, the default fires again on next dispatch', () => {
    const defaultRun = vi.fn();
    const toolRun = vi.fn();
    function Default() {
      useAction({ id: 'escape', label: 'Default', defaultBinding: { key: 'Escape' }, run: defaultRun });
      return null;
    }
    function Tool() {
      useAction({ id: 'escape', label: 'Tool',    defaultBinding: { key: 'Escape' }, run: toolRun });
      return null;
    }
    const { rerender } = render(
      <ActionsProvider><Default /><Tool /></ActionsProvider>,
    );
    rerender(<ActionsProvider><Default /></ActionsProvider>);
    // Default's useEffect re-runs only if its deps change. Since the action
    // object is recreated each render and the cleanup ran when Tool unmounted,
    // Default's most-recent effect already re-registered itself. Verify:
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(defaultRun).toHaveBeenCalled();
  });

  it('two components registering the same custom id "copy" — last-writer-wins, both unregister independently', () => {
    const a = vi.fn(), b = vi.fn();
    function A() { useAction({ id: 'copy', label: 'A', defaultBinding: { key: 'c', mod: true }, run: a }); return null; }
    function B() { useAction({ id: 'copy', label: 'B', defaultBinding: { key: 'c', mod: true }, run: b }); return null; }
    const { rerender } = render(<ActionsProvider><A /><B /></ActionsProvider>);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', metaKey: true, bubbles: true }));
    expect(b).toHaveBeenCalledOnce();
    expect(a).not.toHaveBeenCalled();
    rerender(<ActionsProvider><A /></ActionsProvider>);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', metaKey: true, bubbles: true }));
    expect(a).toHaveBeenCalledOnce();
  });
});
