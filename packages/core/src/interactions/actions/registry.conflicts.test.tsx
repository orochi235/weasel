import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ActionsProvider, useAction, useActionsRegistry } from './registry';

// The legacy keydown loop is gone; conflict resolution now
// surfaces via the imperative `registry.trigger(id)` path (palette / ActionBar
// callers). The semantics are unchanged — last-writer-wins for the id, and
// unregister cleanups respect the live entry — but the dispatch surface is
// `trigger`, not document keydown.

describe('Action registry conflicts', () => {
  it('a tool registering id "escape" overrides the default while mounted', () => {
    const defaultRun = vi.fn();
    const toolRun = vi.fn();
    let captured: ReturnType<typeof useActionsRegistry> = null;
    function Capture() { captured = useActionsRegistry(); return null; }
    function Default() {
      useAction({ id: 'escape', label: 'Default', invoker: { timing: 'immediate' as const, run: () => { defaultRun(); } } });
      return null;
    }
    function Tool() {
      useAction({ id: 'escape', label: 'Tool',    invoker: { timing: 'immediate' as const, run: () => { toolRun(); } } });
      return null;
    }
    render(<ActionsProvider><Capture /><Default /><Tool /></ActionsProvider>);
    captured!.trigger('escape');
    expect(toolRun).toHaveBeenCalledOnce();
    expect(defaultRun).not.toHaveBeenCalled();
  });

  it('after the tool unmounts, the default fires again on next trigger', () => {
    const defaultRun = vi.fn();
    const toolRun = vi.fn();
    let captured: ReturnType<typeof useActionsRegistry> = null;
    function Capture() { captured = useActionsRegistry(); return null; }
    function Default() {
      useAction({ id: 'escape', label: 'Default', invoker: { timing: 'immediate' as const, run: () => { defaultRun(); } } });
      return null;
    }
    function Tool() {
      useAction({ id: 'escape', label: 'Tool',    invoker: { timing: 'immediate' as const, run: () => { toolRun(); } } });
      return null;
    }
    const { rerender } = render(
      <ActionsProvider><Capture /><Default /><Tool /></ActionsProvider>,
    );
    rerender(<ActionsProvider><Capture /><Default /></ActionsProvider>);
    captured!.trigger('escape');
    expect(defaultRun).toHaveBeenCalled();
  });

  it('two components registering the same custom id "copy" — last-writer-wins, both unregister independently', () => {
    const a = vi.fn(), b = vi.fn();
    let captured: ReturnType<typeof useActionsRegistry> = null;
    function Capture() { captured = useActionsRegistry(); return null; }
    function A() { useAction({ id: 'copy', label: 'A', invoker: { timing: 'immediate' as const, run: () => { a(); } } }); return null; }
    function B() { useAction({ id: 'copy', label: 'B', invoker: { timing: 'immediate' as const, run: () => { b(); } } }); return null; }
    const { rerender } = render(<ActionsProvider><Capture /><A /><B /></ActionsProvider>);
    captured!.trigger('copy');
    expect(b).toHaveBeenCalledOnce();
    expect(a).not.toHaveBeenCalled();
    rerender(<ActionsProvider><Capture /><A /></ActionsProvider>);
    captured!.trigger('copy');
    expect(a).toHaveBeenCalledOnce();
  });
});
