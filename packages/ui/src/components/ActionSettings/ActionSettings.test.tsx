import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { ActionDisabledReason, ActionsProvider, useAction, type Action } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { ActionBar } from '../ActionBar';
import { CommandPalette } from '../CommandPalette';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const FORM: PrefGroup = {
  name: 'Snap Settings',
  children: { strict: { kind: 'boolean', name: 'Strict', description: '', default: false } },
};

function snapAction(run: (params?: Record<string, unknown>) => void, enabled = true): Action {
  return {
    id: 'snapSettings',
    label: 'Snap',
    group: 'g',
    enabled: () => (enabled ? true : ActionDisabledReason.NotApplicable),
    invoker: { timing: 'immediate', run: (_deps, params) => run(params) },
    settings: {
      schema: FORM,
      read: () => ({ values: { strict: true } }),
      params: (path, value) => ({ [path]: value, from: 'form' }),
    },
  };
}

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

describe('an action carrying settings, on a bar', () => {
  it('opens its form rather than running, and runs with each change', () => {
    const run = vi.fn();
    renderWithIcons(<ActionsProvider><Register action={snapAction(run)} /><ActionBar group="g" /></ActionsProvider>);
    const button = screen.getByRole('button', { name: 'Snap' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(button);
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Snap Settings' })).toBeInTheDocument();
    const strict = screen.getByRole('checkbox', { name: 'Strict' });
    expect(strict).toBeChecked();
    fireEvent.click(strict);
    expect(run).toHaveBeenCalledWith({ strict: false, from: 'form' });
  });

  it('opens nothing while the action cannot run', () => {
    renderWithIcons(<ActionsProvider><Register action={snapAction(vi.fn(), false)} /><ActionBar group="g" /></ActionsProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Snap' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

function PaletteHarness({ run }: { run: (params?: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ActionsProvider>
      <Register action={snapAction(run)} />
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </ActionsProvider>
  );
}

describe('an action carrying settings, in the palette', () => {
  it('opens its form in a dialog when chosen, rather than running bare', async () => {
    const run = vi.fn();
    renderWithIcons(<PaletteHarness run={run} />);
    fireEvent.mouseDown(screen.getByRole('option', { name: /Snap/ }));
    await act(async () => {});
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Snap Settings' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Strict' }));
    expect(run).toHaveBeenCalledWith({ strict: false, from: 'form' });
  });
});
