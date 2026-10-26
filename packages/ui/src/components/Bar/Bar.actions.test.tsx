import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { ActionsProvider, type Action } from '@weasel-js/core';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar } from './Bar';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

afterEach(cleanup);

function Host({ actions, children }: { actions: Action[]; children: ReactNode }) {
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
  group: 'arrange',
  invoker: { timing: 'immediate', run },
  ...rest,
});

const actions = (extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'actions', name: 'Arrange', description: '', default: undefined, group: 'arrange', ...extra }) as PrefLeaf;

const schema = (extra: Record<string, unknown> = {}): PrefGroup => ({
  name: 'Tools',
  children: { on: { kind: 'boolean', name: 'On', description: '', default: true }, arrange: actions(extra) },
});

const REGISTERED = [
  action('front', { label: 'Bring to front' }),
  action('paste', { label: 'Paste', group: 'clipboard' }),
  action('flip', {
    label: 'Flip',
    variants: [
      { key: 'x', label: 'Flip horizontally', params: { axis: 'x' } },
      { key: 'y', label: 'Flip vertically', params: { axis: 'y' } },
    ],
  }),
];

describe('Bar actions leaf', () => {
  it('draws one button per action in its group, in registry order, a variant each', () => {
    render(
      <Host actions={REGISTERED}>
        <Bar schema={schema()} label="Tools" />
      </Host>,
    );
    const names = within(screen.getByRole('toolbar')).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['On', 'Bring to front', 'Flip horizontally', 'Flip vertically']);
  });

  it('fires the action, with the variant’s params', () => {
    const run = vi.fn();
    const flip = action('flip', { variants: [{ key: 'x', label: 'Flip H', params: { axis: 'x' } }] });
    flip.invoker = { timing: 'immediate', run: (_deps, params) => run(params) };
    render(
      <Host actions={[flip]}>
        <Bar schema={schema()} />
      </Host>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Flip H' }));
    expect(run).toHaveBeenCalledWith({ axis: 'x' });
  });

  it('draws an action registered later without the schema changing', () => {
    function Late() {
      const [more, setMore] = useState(false);
      return (
        <Host actions={more ? [action('front'), action('back')] : [action('front')]}>
          <button type="button" onClick={() => setMore(true)}>register</button>
          <Bar schema={schema()} label="Tools" />
        </Host>
      );
    }
    render(<Late />);
    expect(screen.queryByRole('button', { name: 'back' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'register' }));
    expect(screen.getByRole('button', { name: 'back' })).toBeDefined();
  });

  it('disables every button while the leaf’s enableIf fails', () => {
    render(
      <Host actions={REGISTERED}>
        <Bar schema={schema({ enableIf: { path: 'on' } })} values={{ on: false }} />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Bring to front' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Flip vertically' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('keeps its buttons on the line of a vertical bar', () => {
    render(
      <Host actions={REGISTERED}>
        <Bar schema={schema()} orientation="vertical" label="Tools" />
      </Host>,
    );
    expect(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Bring to front' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Arrange' })).toBeNull();
  });

  it('draws no cell with no registry above', () => {
    const { container } = render(<Bar schema={{ name: '', children: { arrange: actions() } }} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
