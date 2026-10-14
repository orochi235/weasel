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
});
