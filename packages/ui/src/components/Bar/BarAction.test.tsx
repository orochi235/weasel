import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionsProvider, DepRegistryProvider, useDepRegistry, useDepSource,
  type Action, type DepName, type DepRegistry,
} from '@weasel-js/core';
import type { PrefAction } from '@weasel-js/prefs';
import { PrefActionButton } from '../Prefs/PrefActionButton';
import { BarAction, BarActionButton } from './BarAction';
import { RegisterActions } from '../../testing/registerAction';

function Host({ actions, children }: { actions: Action[]; children: React.ReactNode }) {
  return (
    <ActionsProvider>
      <RegisterActions actions={actions} />
      {children}
    </ActionsProvider>
  );
}

const action = (id: string, rest: Partial<Action> = {}, run: () => void = () => {}): Action => ({
  id,
  label: id,
  invoker: { timing: 'immediate', run },
  ...rest,
});

const leaf = (rest: Partial<PrefAction> = {}): PrefAction => ({
  kind: 'action',
  name: 'Bold',
  description: '',
  default: undefined,
  ...rest,
});

describe('BarAction', () => {
  it('fires the registered action its leaf names', () => {
    const run = vi.fn();
    render(
      <Host actions={[action('text.bold', {}, run)]}>
        <BarAction leaf={leaf({ action: 'text.bold' })} path="bold" />
      </Host>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('fires one variant of a parametric action by `id:variant`', () => {
    const run = vi.fn();
    const align = action('align', { variants: [{ key: 'left', label: 'Align left', params: { to: 'left' } }] });
    align.invoker = { timing: 'immediate', run: (_deps, params) => run(params) };
    render(
      <Host actions={[align]}>
        <BarAction leaf={leaf({ name: 'Left', action: 'align:left' })} path="left" />
      </Host>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Left' }));
    expect(run).toHaveBeenCalledWith({ to: 'left' });
  });

  it('draws a leaf naming a bare parametric id as one button per variant, as a menu does', () => {
    const run = vi.fn();
    const align = action('align', { variants: [
      { key: 'left', label: 'Align left', params: { to: 'left' } },
      { key: 'right', label: 'Align right', params: { to: 'right' } },
    ] });
    align.invoker = { timing: 'immediate', run: (_deps, params) => run(params) };
    render(
      <Host actions={[align]}>
        <BarAction leaf={leaf({ name: 'Align', action: 'align' })} path="align" />
        <PrefActionButton pref={leaf({ name: 'Align', action: 'align' })} path="align2" />
      </Host>,
    );
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Align left', 'Align right', 'Align left', 'Align right']);
    expect(document.querySelector('[data-missing]')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Align right' })[0]!);
    expect(run).toHaveBeenCalledWith({ to: 'right' });
  });

  it('is disabled while the action says it cannot run, and stays focusable to say why', () => {
    render(
      <Host actions={[action('text.bold', { enabled: () => 'selection-required' })]}>
        <BarAction leaf={leaf({ action: 'text.bold' })} path="bold" />
      </Host>,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-description', 'Selection required');
  });

  it('follows a dep whose owner says it changed', () => {
    const gate = { open: false };
    let registry!: DepRegistry;
    function Gate() {
      registry = useDepRegistry();
      useDepSource('gate' as DepName, () => gate.open as never);
      return null;
    }
    const bold = action('text.bold', {
      requires: ['gate' as DepName],
      enabled: (deps) => ((deps as Record<string, unknown> | undefined)?.gate ? true : 'selection-required'),
    });
    render(
      <DepRegistryProvider>
        <Host actions={[bold]}>
          <Gate />
          <BarAction leaf={leaf({ action: 'text.bold' })} path="bold" />
        </Host>
      </DepRegistryProvider>,
    );
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-disabled', 'true');
    act(() => { gate.open = true; registry.changed!(); });
    expect(screen.getByRole('button', { name: 'Bold' })).not.toHaveAttribute('aria-disabled');
  });

  it('reads as held down while the action says it is active', () => {
    render(
      <Host actions={[action('text.bold', { active: () => true }), action('text.italic', { active: () => false })]}>
        <BarAction leaf={leaf({ action: 'text.bold' })} path="bold" />
        <BarAction leaf={leaf({ name: 'Italic', action: 'text.italic' })} path="italic" />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('gives an action with no pressed state no pressed state', () => {
    render(
      <Host actions={[action('file.save')]}>
        <BarAction leaf={leaf({ name: 'Save', action: 'file.save' })} path="save" />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-pressed');
  });

  it('draws a key nothing answers to as a dead button that names the key', () => {
    render(
      <Host actions={[]}>
        <BarAction leaf={leaf({ action: 'gone.missing' })} path="bold" />
      </Host>,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('data-missing', 'gone.missing');
  });

  it('keeps a disabled button focusable and says why, given a reason', () => {
    render(<BarActionButton label="Move by" labeled disabled disabledReason="Selection required" onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Move by' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-description', 'Selection required');
  });

  it('is a dead button with no registry above it', () => {
    render(<BarAction leaf={leaf({ action: 'text.bold' })} path="bold" />);
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('reads its label beside its icon as a `button`', () => {
    render(
      <Host actions={[action('text.bold')]}>
        <BarAction leaf={leaf({ action: 'text.bold', control: 'button' })} path="bold" />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveTextContent('Bold');
  });

  it('calls `run` where the leaf names no action, and waits out its promise', async () => {
    let settle = (): void => {};
    const run = vi.fn(() => new Promise<void>((r) => { settle = r; }));
    render(<BarAction leaf={leaf({ name: 'Export', run })} path="file.export" />);
    const button = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(button);
    expect(run).toHaveBeenCalledWith({ path: 'file.export' });
    expect(button).toBeDisabled();
    await act(async () => { settle(); });
    expect(button).not.toBeDisabled();
  });
});

/** Enter keyboard modality, then focus: React Aria opens a tooltip only on focus-visible. */
function keyboardFocus(el: HTMLElement) {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
}

describe('BarAction tooltip', () => {
  it('reads the leaf’s description, with the shortcut after it', () => {
    render(<BarActionButton label="Save" description="Save as SVG" shortcut="Ctrl+S" onPress={() => {}} />);
    keyboardFocus(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Save as SVG (Ctrl+S)');
  });

  it('reads the label and shortcut where there is no description', () => {
    render(<BarActionButton label="Save" shortcut="Ctrl+S" onPress={() => {}} />);
    keyboardFocus(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Save (Ctrl+S)');
  });

  it('takes the description from an action leaf', () => {
    render(
      <Host actions={[action('file.save')]}>
        <BarAction leaf={leaf({ name: 'Save', action: 'file.save', description: 'Save as SVG' })} path="save" />
      </Host>,
    );
    keyboardFocus(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Save as SVG');
  });
});

describe('PrefActionButton', () => {
  it('fires a registered action by key from a row, under the leaf’s name', () => {
    const run = vi.fn();
    render(
      <Host actions={[action('text.bold', { label: 'Toggle bold' }, run)]}>
        <PrefActionButton pref={leaf({ action: 'text.bold' })} path="bold" />
      </Host>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
