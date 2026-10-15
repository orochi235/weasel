import type { MenuEntry } from '@weasel-js/menu';
import { mergeMenuDefs, pickMenu } from './pickMenu';
import { resolveMenu, type MenuSources } from './resolveMenu';
import type { MenuDef, MenuHit, OwnedMenuDef } from './types';

type XY = { x: number; y: number };

/** Ask to open a menu: by id (chrome) or by what was hit (canvas). */
export interface MenuOpenRequest {
  menu?: string;
  hit?: MenuHit;
  /** Viewport point the menu is placed at. */
  client: XY;
  /** World point, passed to `enabled` and to every item. */
  world?: XY;
  viewId?: string | null;
  params?: Record<string, unknown>;
  source?: 'pointer' | 'keyboard';
}

/** The menu on screen. `seq` changes on every open, so a renderer remounts. */
export interface OpenMenu {
  seq: number;
  entries: readonly MenuEntry[];
  client: XY;
  world?: XY;
  viewId?: string | null;
  source: 'pointer' | 'keyboard';
}

/** Holds the declared menus and the one open menu. */
export interface MenuHost {
  /** Declare a menu; `owner` is a tool id, or `null` for always. Returns a release. */
  define(def: MenuDef, owner?: string | null): () => void;
  /** Pick, resolve and show. False when nothing matched or nothing resolved. */
  open(req: MenuOpenRequest): boolean;
  close(): void;
  current(): OpenMenu | null;
  subscribe(fn: () => void): () => void;
}

export function createMenuHost(src: MenuSources & { activeTool(): string | null }): MenuHost {
  const defs: OwnedMenuDef[] = [];
  const listeners = new Set<() => void>();
  let open: OpenMenu | null = null;
  let seq = 0;
  const emit = () => { for (const fn of listeners) fn(); };

  return {
    define(def, owner = null) {
      const entry = { def, owner };
      defs.push(entry);
      return () => {
        const i = defs.indexOf(entry);
        if (i >= 0) defs.splice(i, 1);
      };
    },
    open(req) {
      const live = mergeMenuDefs(defs, src.activeTool());
      const def = req.menu !== undefined
        ? live.find((d) => d.id === req.menu)
        : req.hit ? pickMenu(live, req.hit) : undefined;
      const entries = def ? resolveMenu(def, src, req.world, req.params) : [];
      if (!entries.length) return false;
      open = {
        seq: ++seq, entries, client: req.client, world: req.world, viewId: req.viewId,
        source: req.source ?? 'pointer',
      };
      emit();
      return true;
    },
    close() {
      if (!open) return;
      open = null;
      emit();
    },
    current: () => open,
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}
