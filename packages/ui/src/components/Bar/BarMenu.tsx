import { useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  buildDepsFromRequires,
  resolveSchemaMenu,
  useLatest,
  useActionsRegistry,
  useOptionalDepRegistry,
} from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import type { MenuEntry } from '@weasel-js/menu';
import { useMenuTrigger } from '../ContextMenu/useMenuTrigger';
import { SegmentTooltip, segmentTooltipContent } from '../segmentTooltip';
import f from '../field.module.css';
import { DockBarContext } from '../ToolbarDock/dockContext';
import { useBarLead } from './barLeadHandle';
import { BarSideContext } from './barSide';
import { PopFace, popIconAttr } from './popFace';
import s from './Bar.module.css';

/** Where a bar's menu reads and writes the values its rows show: the bar's own. */
export interface BarMenuSources {
  values: (path: string) => unknown;
  onChange?: (path: string, value: unknown) => void;
  /** The schema an alias in the menu points into. */
  over?: PrefGroup;
}

/** Props for {@link BarMenu}. */
export interface BarMenuProps extends BarMenuSources {
  /** What the button reads, and what names the menu. */
  label: string;
  /** A glyph before the label. */
  icon?: ReactNode;
  /** The button's tooltip. */
  description?: string;
  /** The menu, as a schema `resolveSchemaMenu` walks: resolved each time it opens, so it shows what holds then. */
  schema: PrefGroup;
  /** Open, as from a pointer, once on mount, leaving focus where it is. */
  defaultOpen?: boolean;
}

/**
 * A bar's cell for a group drawn `as: 'menu'`: a button that opens the group
 * as the DOM menu the context menu host draws — actions as items, flags as
 * checked items, choices as radio rows, nested groups as submenus. Drawn as a
 * bar of a movable `ToolbarDock`, a grip before the button is its handle.
 */
export function BarMenu({ label, icon, description, schema, values, onChange, over, defaultOpen }: BarMenuProps) {
  const registry = useActionsRegistry();
  const resolveMenu = useBarMenuResolver();
  const trigger = useMenuTrigger();
  const side = useContext(BarSideContext);
  const handle = useBarLead(null);

  // `defaultOpen` holds until the menu has opened once or the reader has touched it.
  const pending = useRef(defaultOpen === true);

  const resolve = () => resolveMenu(schema, { values, onChange, over });
  const showQuiet = useLatest(() => trigger.show(resolve(), 'pointer', true, side));

  // An action registered after this mounts can be what makes the menu non-empty, so a shut default retries on each change.
  useEffect(() => {
    if (!pending.current) return;
    const attempt = () => {
      if (pending.current && showQuiet.current()) pending.current = false;
    };
    attempt();
    return registry?.subscribe(attempt);
  }, [registry, showQuiet]);

  return (
    <DockBarContext.Provider value={null}>
      {trigger.anchor}
      {handle && <span className={s.lead} {...handle.attrs}>{handle.content}</span>}
      <SegmentTooltip content={segmentTooltipContent({ description })}>
        <button
          ref={trigger.button}
          id={trigger.id}
          type="button"
          className={`${f.frame} ${s.popTrigger}`}
          {...popIconAttr(icon)}
          aria-haspopup="menu"
          aria-expanded={trigger.open}
          onPointerDown={trigger.press}
          onClick={(e) => {
            pending.current = false;
            trigger.click(e, resolve, side);
          }}
        >
          <PopFace icon={icon} label={label} />
        </button>
      </SegmentTooltip>
      {trigger.portal}
    </DockBarContext.Provider>
  );
}

/** Resolves a menu schema against the nearest actions registry and dep registry, reading and writing through
 *  `sources`: what a bar's menu and a menu bar's title open. */
export function useBarMenuResolver(): (schema: PrefGroup, sources: BarMenuSources) => MenuEntry[] {
  const registry = useActionsRegistry();
  const depReg = useOptionalDepRegistry();
  return (schema, { values, onChange, over }) => resolveSchemaMenu(schema, {
    actions: () => registry?.list() ?? [],
    depsFor: (action) => (depReg ? buildDepsFromRequires(action, depReg) : undefined),
    trigger: (id, params) => registry?.trigger(id, params) ?? false,
    values,
    ...(onChange ? { onChange } : {}),
    ...(over ? { over } : {}),
  });
}
