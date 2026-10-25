import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { barMenuRoot } from './barMenuRoot';
import { Bar } from './Bar';
import { RegisterActions } from '../../testing/registerAction';

afterEach(cleanup);

const front = vi.fn();
const ACTIONS: Action[] = [
  { id: 'front', label: 'Bring to front', group: 'arrange', invoker: { timing: 'immediate', run: front } },
  { id: 'back', label: 'Send to back', group: 'arrange', invoker: { timing: 'immediate', run: () => {} } },
];

const schema: PrefGroup = pref.group('Tools', {
  view: pref.group('', {
    arrange: pref.group('Arrange', {
      order: pref.actions('arrange'),
      snap: pref.boolean('Snap', false),
      align: pref.enum('Align', 'left', ['left', 'right']),
      gap: pref.number('Gap', 4),
    }, { as: 'menu' }),
  }),
});

function bar(values: Record<string, unknown>, onChange = vi.fn()) {
  render(
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <Bar schema={schema} values={values} onChange={onChange} label="Tools" />
    </ActionsProvider>,
  );
  return onChange;
}

describe('Bar menu group', () => {
  it('opens as a menu: actions as items, a flag checked, a choice as radio rows, a number as a field', () => {
    bar({ 'view.arrange.snap': true, 'view.arrange.align': 'right' });
    const trigger = screen.getByRole('button', { name: 'Arrange' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Bring to front' })).toBeDefined();
    expect(screen.getByRole('menuitemcheckbox', { name: /Snap/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: /Right/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitem', { name: /Gap/ })).toContainElement(screen.getByRole('spinbutton', { name: 'Gap' }));
  });

  it('writes through the bar’s onChange at the bar’s own path', () => {
    const onChange = bar({ 'view.arrange.snap': false });
    fireEvent.click(screen.getByRole('button', { name: 'Arrange' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Snap/ }));
    expect(onChange).toHaveBeenCalledWith('view.arrange.snap', true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('fires an action from its row', () => {
    bar({});
    fireEvent.click(screen.getByRole('button', { name: 'Arrange' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bring to front' }));
    expect(front).toHaveBeenCalled();
  });

  it('opens nothing where no row resolves: no registry, and no writer for its flag and choice', () => {
    render(<Bar schema={schema} label="Tools" />);
    fireEvent.click(screen.getByRole('button', { name: 'Arrange' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Bar menu tooltip', () => {
  it('reads the group’s description', () => {
    const described: PrefGroup = pref.group('Tools', {
      file: pref.group('New', { order: pref.actions('arrange') }, { as: 'menu', description: 'New document' }),
    });
    render(<ActionsProvider><Bar schema={described} label="Tools" /></ActionsProvider>);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => screen.getByRole('button', { name: 'New' }).focus());
    expect(screen.getByRole('tooltip').textContent).toBe('New document');
  });
});

describe('barMenuRoot', () => {
  it('nests the group’s children under inline groups at its path', () => {
    const group = pref.group('Arrange', { snap: pref.boolean('Snap', false) }, { as: 'menu' });
    const root = barMenuRoot(group, 'a.b');
    const b = (root.children.a as PrefGroup).children.b as PrefGroup;
    expect(b.as).toBeUndefined();
    expect(Object.keys(b.children)).toEqual(['snap']);
  });
});
