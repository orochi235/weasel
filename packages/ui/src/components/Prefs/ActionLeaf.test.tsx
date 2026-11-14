import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionsProvider, DepRegistryProvider, useDepRegistry, useDepSource,
  type Action, type DepName, type DepRegistry,
} from '@weasel-js/core';
import type { PrefAction } from '@weasel-js/prefs';
import { ActionButton } from '../ActionButton/ActionButton';
import { FormScope } from '../ActionButton/controlForm';
import { ActionLeaf } from './ActionLeaf';
import { icon } from '../../icons.gen';
import { renderWithIcons } from '../../testing/withIcons';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

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

describe('ActionLeaf', () => {
  it("draws as a menu row in a bar's overflow: icon, label, and shortcut", () => {
    render(
      <Host actions={[action('text.bold', { label: 'Bold' })]}>
        <FormScope form="menu">
          <ActionLeaf leaf={leaf({ action: 'text.bold' })} path="bold" />
        </FormScope>
      </Host>,
    );
    const row = screen.getByRole('button', { name: 'Bold' });
    expect(row.textContent).toContain('Bold');
  });

  it('fires the registered action its leaf names', () => {
    const run = vi.fn();
    render(
      <Host actions={[action('text.bold', {}, run)]}>
        <ActionLeaf leaf={leaf({ action: 'text.bold' })} path="bold" />
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
        <ActionLeaf leaf={leaf({ name: 'Left', action: 'align:left' })} path="left" />
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
        <ActionLeaf leaf={leaf({ name: 'Align', action: 'align' })} path="align" />
        <ActionLeaf leaf={leaf({ name: 'Align', action: 'align' })} path="align2" form="row" />
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
        <ActionLeaf leaf={leaf({ action: 'text.bold' })} path="bold" />
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
          <ActionLeaf leaf={leaf({ action: 'text.bold' })} path="bold" />
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
        <ActionLeaf leaf={leaf({ action: 'text.bold' })} path="bold" />
        <ActionLeaf leaf={leaf({ name: 'Italic', action: 'text.italic' })} path="italic" />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('gives an action with no pressed state no pressed state', () => {
    render(
      <Host actions={[action('file.save')]}>
        <ActionLeaf leaf={leaf({ name: 'Save', action: 'file.save' })} path="save" />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-pressed');
  });

  it('draws a key nothing answers to as a dead button that names the key', () => {
    render(
      <Host actions={[]}>
        <ActionLeaf leaf={leaf({ action: 'gone.missing' })} path="bold" />
      </Host>,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('data-missing', 'gone.missing');
  });

  it('keeps a disabled button focusable and says why, given a reason', () => {
    render(<ActionButton label="Move by" labeled disabled disabledReason="Selection required" onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Move by' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-description', 'Selection required');
  });

  it('is a dead button with no registry above it', () => {
    render(<ActionLeaf leaf={leaf({ action: 'text.bold' })} path="bold" />);
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('reads its label beside its icon as a `button`', () => {
    render(
      <Host actions={[action('text.bold')]}>
        <ActionLeaf leaf={leaf({ action: 'text.bold', control: 'button' })} path="bold" />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveTextContent('Bold');
  });

  it('calls `run` where the leaf names no action, and waits out its promise', async () => {
    let settle = (): void => {};
    const run = vi.fn(() => new Promise<void>((r) => { settle = r; }));
    render(<ActionLeaf leaf={leaf({ name: 'Export', run })} path="file.export" />);
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

describe('ActionLeaf tooltip', () => {
  it('reads the leaf’s description, with the shortcut after it', () => {
    render(<ActionButton label="Save" description="Save as SVG" shortcut="Ctrl+S" onPress={() => {}} />);
    keyboardFocus(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Save as SVG (Ctrl+S)');
  });

  it('reads the label and shortcut where there is no description', () => {
    render(<ActionButton label="Save" shortcut="Ctrl+S" onPress={() => {}} />);
    keyboardFocus(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Save (Ctrl+S)');
  });

  it('takes the description from an action leaf', () => {
    render(
      <Host actions={[action('file.save')]}>
        <ActionLeaf leaf={leaf({ name: 'Save', action: 'file.save', description: 'Save as SVG' })} path="save" />
      </Host>,
    );
    keyboardFocus(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Save as SVG');
  });
});

describe('ActionLeaf in a row', () => {
  it('fires a registered action by key, under the leaf’s name, its label beside its icon', () => {
    const run = vi.fn();
    render(
      <Host actions={[action('text.bold', { label: 'Toggle bold' }, run)]}>
        <ActionLeaf leaf={leaf({ action: 'text.bold' })} path="bold" form="row" />
      </Host>,
    );
    const button = screen.getByRole('button', { name: 'Bold' });
    expect(button).toHaveAttribute('data-form', 'row');
    expect(button).toHaveTextContent('Bold');
    fireEvent.click(button);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('draws its icon alone for `control: \'icon\'`', () => {
    renderWithIcons(
      <Host actions={[action('text.bold', { icon: icon('core:undo') })]}>
        <ActionLeaf leaf={leaf({ action: 'text.bold', control: 'icon' })} path="bold" form="row" />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Bold' }).textContent).toBe('');
  });
});
