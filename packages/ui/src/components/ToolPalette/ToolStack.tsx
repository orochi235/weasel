import { useState, type MouseEvent } from 'react';
import type { Tool } from '@weasel-js/core';
import { detectPlatform } from '@weasel-js/gestures';
import type { MenuEntry, MenuShortcut } from '@weasel-js/menu';
import { ToolButton } from '../ToolButton';
import { useMenuTrigger } from '../ContextMenu/useMenuTrigger';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';
import s from './ToolPalette.module.css';

/** The modifier that makes a click on a stack step to its next tool instead of opening its menu. */
export type StackCycleModifier = 'alt' | 'mod' | 'shift';

/** What a {@link ToolStack} needs to know about one of its tools. */
export interface StackMember {
  tool: Tool;
  label: string;
  /** The binding the menu row draws. */
  keys?: MenuShortcut;
  /** The binding as the button's chip reads, which a presentation may override. */
  shortcut?: string;
  enabled: boolean;
}

const held = (e: MouseEvent, mod: StackCycleModifier): boolean =>
  mod === 'alt' ? e.altKey
    : mod === 'shift' ? e.shiftKey
      : detectPlatform() === 'macos' ? e.metaKey : e.ctrlKey;

const glyph = (tool: Tool) => tool.presentation?.icon ?? icon('core:unknown');

/**
 * One palette button standing for several tools. It shows the tool in use when that is one of its
 * own, and otherwise the one last used from it. A click opens a menu of all of them; a click with
 * `cycle` held makes the next one active without opening anything.
 */
export function ToolStack(props: {
  members: readonly StackMember[];
  active: string | null;
  setActive(id: string): void;
  cycle: StackCycleModifier;
}) {
  const { members, active, setActive, cycle } = props;
  const trigger = useMenuTrigger();
  const [last, setLast] = useState(members[0].tool.id);
  const activeHere = members.some((m) => m.tool.id === active);
  if (activeHere && last !== active) setLast(active!);
  const face = members.find((m) => m.tool.id === (activeHere ? active : last)) ?? members[0];
  const anyEnabled = members.some((m) => m.enabled);

  const choose = (id: string) => { setLast(id); setActive(id); };
  const entries = (): MenuEntry[] => members.map((m) => ({
    kind: 'item',
    key: m.tool.id,
    label: m.label,
    icon: glyph(m.tool),
    ...(m.keys ? { shortcut: m.keys } : {}),
    ...(m.enabled ? {} : { disabled: true }),
    ...(m.tool.id === active ? { current: true } : {}),
    run: () => choose(m.tool.id),
  }));
  const onClick = (e: MouseEvent) => {
    if (!anyEnabled) return;
    if (!held(e, cycle)) { trigger.click(e, entries); return; }
    const from = members.indexOf(face);
    for (let step = 1; step < members.length; step++) {
      const next = members[(from + step) % members.length];
      if (next.enabled) { choose(next.tool.id); return; }
    }
  };

  return (
    <>
      {trigger.anchor}
      <ToolButton
        icon={<Icon name={glyph(face.tool)} />}
        label={face.label}
        shortcut={face.shortcut}
        active={activeHere}
        ariaDisabled={!anyEnabled}
        className={[s.paletteBtn, !anyEnabled && s.ineligibleBtn].filter(Boolean).join(' ')}
        menu={{ ref: trigger.button, id: trigger.id, expanded: trigger.open, onPointerDown: trigger.press }}
        onClick={onClick}
      />
      {trigger.portal}
    </>
  );
}
