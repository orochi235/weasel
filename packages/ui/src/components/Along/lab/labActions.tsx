import { useMemo, type ReactElement, type ReactNode } from 'react';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import type { IconRef } from '@weasel-js/icons';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { icon } from '../../../icons.gen';

/** The actions a lab's bars are built from, in the order a bar of `n` takes them. */
export const LAB_ACTIONS: readonly { key: string; name: string; glyph: IconRef }[] = [
  { key: 'undo', name: 'Undo', glyph: icon('core:undo') },
  { key: 'redo', name: 'Redo', glyph: icon('core:redo') },
  { key: 'flipX', name: 'Flip across', glyph: icon('core:flipX') },
  { key: 'flipY', name: 'Flip down', glyph: icon('core:flipY') },
  { key: 'front', name: 'Bring to front', glyph: icon('core:bringToFront') },
  { key: 'back', name: 'Send to back', glyph: icon('core:sendToBack') },
  { key: 'group', name: 'Group', glyph: icon('core:group') },
  { key: 'ungroup', name: 'Ungroup', glyph: icon('core:ungroup') },
  { key: 'copy', name: 'Copy', glyph: icon('core:copy') },
  { key: 'paste', name: 'Paste', glyph: icon('core:paste') },
];

/** The leaf for lab action `key`, bound to the action `lab.<key>`. */
export function actionLeaf(key: string): PrefLeaf {
  const a = LAB_ACTIONS.find((x) => x.key === key)!;
  return { kind: 'action', name: a.name, description: '', default: undefined, action: `lab.${a.key}`, icon: a.glyph } as PrefLeaf;
}

/** A bar's schema of the first `n` lab actions. */
export function actionsSchema(n: number, name = 'Actions'): PrefGroup {
  return { name, children: Object.fromEntries(LAB_ACTIONS.slice(0, n).map((a) => [a.key, actionLeaf(a.key)])) };
}

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

/** Every lab action registered, each reporting its key to `onPress`, around `children`. */
export function LabActions({ onPress, children }: { onPress?: (key: string) => void; children: ReactNode }): ReactElement {
  const actions = useMemo<Action[]>(
    () => LAB_ACTIONS.map((a) => ({ id: `lab.${a.key}`, label: a.name, icon: a.glyph, invoker: { timing: 'immediate', run: () => onPress?.(a.key) } })),
    [onPress],
  );
  return (
    <ActionsProvider>
      {actions.map((a) => <Register key={a.id} action={a} />)}
      {children}
    </ActionsProvider>
  );
}
