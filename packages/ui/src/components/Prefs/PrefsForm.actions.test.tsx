import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { icon } from '../../icons.gen';
import { renderWithIcons } from '../../testing/withIcons';
import { RegisterActions } from '../../testing/registerAction';

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
  id, label: id, group: 'arrange', invoker: { timing: 'immediate', run }, ...rest,
});

const form = (schema: PrefGroup, actions: Action[] = []) =>
  renderWithIcons(<Host actions={actions}><PrefsForm schema={schema} values={{}} onChange={() => {}} /></Host>);

describe('PrefsForm action rows', () => {
  it('reads an action leaf’s label once, on its button, with its icon', () => {
    const run = vi.fn();
    form({ name: 'T', children: { go: pref.action('front', { name: 'Bring to front' }) } }, [action('front', { icon: icon('core:bringToFront') }, run)]);
    expect(screen.getAllByText('Bring to front')).toHaveLength(1);
    const button = screen.getByRole('button', { name: 'Bring to front' });
    expect(button.querySelector('svg')).not.toBeNull();
    fireEvent.click(button);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('shows the registered label when the leaf names none', () => {
    form({ name: 'T', children: { go: pref.action('front') } }, [action('front', { label: 'Bring to front' })]);
    expect(screen.getAllByText('Bring to front')).toHaveLength(1);
  });

  it('keeps a button whose action is missing focusable, and says which key', () => {
    form({ name: 'T', children: { go: pref.action('nowhere', { name: 'Go' }) } });
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('data-missing', 'nowhere');
    expect(button).not.toBeDisabled();
  });

  it('takes its disabled state and reason from the registry', () => {
    form({ name: 'T', children: { go: pref.action('front') } }, [action('front', { enabled: () => 'selection-required' })]);
    const button = screen.getByRole('button', { name: 'front' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-description', 'Selection required');
  });

  it('draws an actions leaf as one row per entry of its group, variants expanded', () => {
    form({ name: 'T', children: { arrange: pref.actions('arrange', { name: 'Arrange' }) } }, [
      action('front', { label: 'Bring to front' }),
      action('paste', { group: 'clipboard' }),
      action('flip', { variants: [{ key: 'x', label: 'Flip H', params: {} }, { key: 'y', label: 'Flip V', params: {} }] }),
    ]);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Bring to front', 'Flip H', 'Flip V']);
    expect(screen.queryByText('Arrange')).toBeNull();
  });
});

describe('PrefsForm readouts', () => {
  it('draws a readout leaf as its value, with nothing to edit it with', () => {
    const schema: PrefGroup = {
      name: 'T',
      children: {
        size: { ...pref.number('Size', 12), readout: true },
        on: { ...pref.boolean('On', true), readout: true },
        mode: { ...pref.enum('Mode', 'b', ['a', 'b']), readout: true },
      },
    };
    renderWithIcons(<PrefsForm schema={schema} values={{}} onChange={() => {}} />);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('status', { name: 'Size' }).textContent).toBe('12');
    expect(screen.getByRole('status', { name: 'On' }).textContent).toBe('On');
    expect(screen.getByRole('status', { name: 'Mode' }).textContent).toBe('B');
  });
});

describe('PrefsForm bar menus', () => {
  it('opens a menu group in a bar as a menu writing the form’s values', () => {
    const onChange = vi.fn();
    const schema: PrefGroup = {
      name: 'T',
      children: {
        strip: pref.group('Strip', { view: pref.group('View', { grid: pref.boolean('Grid', false) }, { as: 'menu' }) }, { as: 'bar' }),
      },
    };
    renderWithIcons(<PrefsForm schema={schema} values={{ strip: { view: { grid: true } } }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const grid = screen.getByRole('menuitemcheckbox', { name: /Grid/ });
    expect(grid).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(grid);
    expect(onChange).toHaveBeenCalledWith('strip.view.grid', false);
  });
});
