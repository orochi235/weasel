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

import { useState } from 'react';
import { ActionsProvider, useActionsRegistry, type Action, type ActionsRegistry } from '@weasel-js/core';
import { OffsetSlider, SimplifySlider, useSimplifyTolerance } from './PathCommands';

function Simplify() {
  const [tolerance, setTolerance] = useState(1);
  return <SimplifySlider tolerance={tolerance} onTolerance={setTolerance} />;
}

function TunedSimplify() {
  const [tolerance, setTolerance] = useSimplifyTolerance();
  return <SimplifySlider tolerance={tolerance} onTolerance={setTolerance} />;
}

afterEach(() => {
  cleanup();
  edits.clear();
});

describe('the path command sliders', () => {
  it('drives Simplify from its slider: a step previews and commits the tolerance', () => {
    render(<Simplify />);
    const slider = screen.getByRole('slider', { name: 'Simplify tolerance' });
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
    });
    const simplify = edits.get('simplifyPath')!;
    expect(simplify.input).toHaveBeenCalledWith({ tolerance: expect.closeTo(1.1, 5) });
    expect(simplify.commit).toHaveBeenCalledWith({ tolerance: expect.closeTo(1.1, 5) });
  });

  it('drives Offset Path from its slider, by distance', () => {
    render(<OffsetSlider />);
    const slider = screen.getByRole('slider', { name: 'Offset distance' });
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    });
    expect(edits.get('offsetPath')!.commit).toHaveBeenCalledWith({ distance: -0.5 });
  });

  it("tunes the Simplify brush to the tolerance useSimplifyTolerance holds", () => {
    const run = vi.fn();
    const brush: Action = { id: 'simplifyBrush', label: 'Simplify brush', invoker: { timing: 'immediate', run } };
    let registry: ActionsRegistry | null = null;
    function Grab() {
      registry = useActionsRegistry();
      return null;
    }
    render(<ActionsProvider><Grab /><TunedSimplify /></ActionsProvider>);
    act(() => { registry!.register(brush); });
    act(() => {
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Simplify tolerance' }), { key: 'ArrowRight' });
    });
    const tuned = registry!.list().find((a) => a.id === 'simplifyBrush')!;
    if (tuned.invoker?.timing !== 'immediate') throw new Error('timing');
    tuned.invoker.run({}, undefined);
    expect(run.mock.calls[0][1]).toEqual({ tolerance: expect.closeTo(1.1, 5) });
  });
});
