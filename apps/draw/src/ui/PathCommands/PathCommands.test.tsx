import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const edits = vi.hoisted(() => new Map<string, { input: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }>());

vi.mock('@weasel-js/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  useOngoingAction: (id: string) => {
    if (!edits.has(id)) edits.set(id, { input: vi.fn(), commit: vi.fn(), cancel: vi.fn() });
    return edits.get(id)!;
  },
}));

import { ActionsProvider, useActionsRegistry, type Action, type ActionsRegistry } from '@weasel-js/core';
import { PathCommands } from './PathCommands';

afterEach(() => {
  cleanup();
  edits.clear();
});

function openPopover(name: string) {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('PathCommands', () => {
  it('drives Simplify from its slider: a step previews and commits the tolerance', () => {
    render(<PathCommands />);
    openPopover('Simplify');
    const slider = screen.getByRole('slider', { name: 'Simplify tolerance' });
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
    });
    const simplify = edits.get('simplifyPath')!;
    expect(simplify.input).toHaveBeenCalledWith({ tolerance: expect.closeTo(1.1, 5) });
    expect(simplify.commit).toHaveBeenCalledWith({ tolerance: expect.closeTo(1.1, 5) });
  });

  it('drives Offset Path from its slider, by distance', () => {
    render(<PathCommands />);
    openPopover('Offset');
    const slider = screen.getByRole('slider', { name: 'Offset distance' });
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    });
    expect(edits.get('offsetPath')!.commit).toHaveBeenCalledWith({ distance: -0.5 });
  });

  it("tunes the Simplify brush to the Simplify slider's tolerance", () => {
    const run = vi.fn();
    const brush: Action = { id: 'simplifyBrush', label: 'Simplify brush', invoker: { timing: 'immediate', run } };
    let registry: ActionsRegistry | null = null;
    function Grab() {
      registry = useActionsRegistry();
      return null;
    }
    render(<ActionsProvider><Grab /><PathCommands /></ActionsProvider>);
    act(() => { registry!.register(brush); });
    openPopover('Simplify');
    act(() => {
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Simplify tolerance' }), { key: 'ArrowRight' });
    });
    const tuned = registry!.list().find((a) => a.id === 'simplifyBrush')!;
    if (tuned.invoker?.timing !== 'immediate') throw new Error('timing');
    tuned.invoker.run({}, undefined);
    expect(run.mock.calls[0][1]).toEqual({ tolerance: expect.closeTo(1.1, 5) });
  });
});
