import { useState, type MouseEvent } from 'react';
import { formatShortcut, isApplePlatform } from '@weasel-js/gestures';
import type { MenuEntry } from '@weasel-js/menu';
import { ActionButton } from '../ActionButton/ActionButton';
import { useMenuTrigger } from '../Menu/useMenuTrigger';
import { Icon } from '../../icons/Icon';
import type { ToolRailButton, ToolRailStack } from './items';
import s from './ToolRail.module.css';

/** The modifier that makes a click on a stack step to its next member instead of opening its menu. */
export type StackCycleModifier = 'alt' | 'mod' | 'shift';

const held = (e: MouseEvent, mod: StackCycleModifier): boolean =>
  mod === 'alt' ? e.altKey
    : mod === 'shift' ? e.shiftKey
      : isApplePlatform() ? e.metaKey : e.ctrlKey;

/**
 * One rail button standing for several. It shows the active member when it holds one, and otherwise the one last
 * pressed from it. A click opens a menu of all of them; a click with `cycle` held presses the next enabled one.
 */
export function RailStack(props: {
  stack: ToolRailStack;
  cycle: StackCycleModifier;
  iconSize?: number;
}) {
  const { stack: { members }, cycle, iconSize } = props;
  const trigger = useMenuTrigger();
  const [last, setLast] = useState(members[0].id);
  const current = members.find((m) => m.active);
  if (current && last !== current.id) setLast(current.id);
  const face = current ?? members.find((m) => m.id === last) ?? members[0];
  const anyEnabled = members.some((m) => !m.disabled);

  const choose = (m: ToolRailButton) => { setLast(m.id); m.onPress(); };
  const entries = (): MenuEntry[] => members.map((m) => ({
    kind: 'item',
    key: m.id,
    label: m.label,
    icon: m.icon,
    ...(m.description ? { description: m.description } : {}),
    ...(m.shortcut ? { shortcut: m.shortcut } : {}),
    ...(m.disabled ? { disabled: true } : {}),
    ...(m.active ? { current: true } : {}),
    run: () => choose(m),
  }));
  const onClick = (e: MouseEvent) => {
    if (!anyEnabled) return;
    if (!held(e, cycle)) { trigger.click(e, entries); return; }
    const from = members.indexOf(face);
    for (let step = 1; step < members.length; step++) {
      const next = members[(from + step) % members.length];
      if (!next.disabled) { choose(next); return; }
    }
  };

  return (
    <>
      {trigger.anchor}
      <ActionButton
        icon={<Icon name={face.icon} size={iconSize} />}
        label={face.label}
        description={face.description}
        shortcut={formatShortcut(face.shortcut)}
        active={current !== undefined}
        disabled={!anyEnabled}
        disabledReason={anyEnabled ? undefined : face.disabledReason}
        className={s.item}
        popup={{ type: 'menu', ref: trigger.button, id: trigger.id, expanded: trigger.open, onPointerDown: trigger.press }}
        onPress={onClick}
      />
      {trigger.portal}
    </>
  );
}
