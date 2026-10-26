import type { Meta, StoryObj } from '@weasel-js/forge';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionDisabledReason, ActionsProvider, useMenuHost, useMenus, type Action, type MenuDef,
} from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { ContextMenuHost, useContextMenu } from '@weasel-js/ui/components/ContextMenu';
import s from './ContextMenuHost.stories.module.css';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

const meta: Meta = { title: 'ui/ContextMenu' };
export default meta;

type Story = StoryObj;

const key = (k: string, mods: { mod?: boolean; shift?: boolean; alt?: boolean } = {}) =>
  ({ kind: 'key' as const, key: k, mods }) as Action['defaultBinding'];

function useEditActions(log: (id: string) => void): readonly Action[] {
  const [snap, setSnap] = useState(true);
  const actions = useMemo(() => {
    const a = (id: string, label: string, extra: Partial<Action> = {}): Action => ({
      id, label, invoker: { timing: 'immediate', run: () => { log(id); } }, ...extra,
    });
    return [
      a('cut', 'Cut', { defaultBinding: key('x', { mod: true }) }),
      a('copy', 'Copy', { defaultBinding: key('c', { mod: true }) }),
      a('paste', 'Paste', { defaultBinding: key('v', { mod: true }), enabled: () => ActionDisabledReason.NotApplicable }),
      a('duplicate', 'Duplicate', { defaultBinding: key('d', { mod: true }) }),
      a('forward', 'Bring forward', { defaultBinding: key(']', { mod: true }) }),
      a('front', 'Bring to front', { defaultBinding: key(']', { mod: true, shift: true }) }),
      a('backward', 'Send backward', { defaultBinding: key('[', { mod: true }) }),
      a('back', 'Send to back', { defaultBinding: key('[', { mod: true, shift: true }) }),
      a('snap', 'Snap to grid', {
        active: () => snap,
        invoker: { timing: 'immediate', run: () => { setSnap((on) => !on); log('snap'); } },
      }),
      a('delete', 'Delete', { defaultBinding: key('Backspace') }),
    ];
  }, [log, snap]);
  return actions;
}

const MENUS: MenuDef[] = [{
  id: 'edit',
  menu: pref.group('', {
    edit: pref.group('', {
      cut: pref.action('cut'), copy: pref.action('copy'), paste: pref.action('paste'), duplicate: pref.action('duplicate'),
    }),
    arrange: pref.group('Arrange', {
      ahead: pref.group('', { front: pref.action('front'), forward: pref.action('forward') }),
      behind: pref.group('', { backward: pref.action('backward'), back: pref.action('back') }),
    }, { as: 'menu' }),
    snap: pref.group('', { snap: pref.action('snap') }),
    remove: pref.group('', { delete: pref.action('delete') }),
  }),
}];

function Target({ openOnMount }: { openOnMount?: boolean }) {
  const [last, setLast] = useState<string | null>(null);
  const actions = useEditActions(setLast);
  useMenus(MENUS);
  const host = useMenuHost();
  const onContextMenu = useContextMenu('edit');
  useEffect(() => {
    if (openOnMount) host?.open({ menu: 'edit', client: { x: 140, y: 60 }, source: 'pointer' });
  }, [host, openOnMount]);
  return (
    <div>
      <RegisterActions actions={actions} />
      <ContextMenuHost />
      <div className={s.target} onContextMenu={onContextMenu}>Right-click here</div>
      <p>Last ran: {last ?? 'nothing yet'}</p>
    </div>
  );
}

/** Right-click the box. Rows name registered actions, so each shows its own
 *  label, its key binding as a shortcut, whether it is enabled, and — for an
 *  action with `active` — a check mark. */
export const RightClick: Story = {
  render: () => <ActionsProvider><Target /></ActionsProvider>,
};

/** The same menu, opened as soon as the story mounts. Hover "Arrange" for
 *  the submenu; arrow keys, Enter and typeahead work once it has focus. */
export const Open: Story = {
  render: () => <ActionsProvider><Target openOnMount /></ActionsProvider>,
};
