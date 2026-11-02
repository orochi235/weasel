import type { MenuEntry, MenuSide, Rect } from '@weasel-js/menu';
import { mergeMenuDefs, pickMenu } from './pickMenu';
import { resolveMenu, type MenuSources } from './resolveMenu';
import type { MenuDef, MenuHit, OwnedMenuDef } from './types';
import type { Point } from '@weasel-js/geom';
import { createEmitter } from '@weasel-js/registry';

/** Ask to open a menu: by id (chrome) or by what was hit (canvas). */
export interface MenuOpenRequest {
  menu?: string;
  hit?: MenuHit;
  /** Viewport point the menu is placed at, unless `under` is set. */
  client: Point;
  /** Viewport rect of the button the menu hangs from: placed below it, or above when below does not fit. */
  under?: Rect;
  /** With `under`: the side of the button it opens on when it fits there, flipping to the opposite side when it does not.
   *  Default below. The canvas HUD menu host places below only and ignores it. */
  side?: MenuSide;
  /** World point, passed to `enabled` and to every item. */
  world?: Point;
  params?: Record<string, unknown>;
  source?: 'pointer' | 'keyboard';
}

/** The menu on screen. `seq` changes on every open, so a renderer remounts. */
export interface OpenMenu {
  seq: number;
  entries: readonly MenuEntry[];
  client: Point;
  under?: Rect;
  /** `MenuOpenRequest.side`, carried to the renderer. */
  side?: MenuSide;
  world?: Point;
  source: 'pointer' | 'keyboard';
}

/** Holds the declared menus and the one open menu. */
export interface MenuHost {
  /** Declare a menu; `owner` is a tool id, or `null` for always. Returns a release. */
  define(def: MenuDef, owner?: string | null): () => void;
  /** Pick, resolve and show. False when nothing matched or nothing resolved. */
  open(req: MenuOpenRequest): boolean;
  /** Whether `open(req)` would show anything. Changes no state and notifies no one. */
  has(req: MenuOpenRequest): boolean;
  close(): void;
  current(): OpenMenu | null;
  subscribe(fn: () => void): () => void;
}

/** Creates the host that decides which context menu is open, from the menus registered to it. */
export function createMenuHost(src: MenuSources & { activeTool(): string | null }): MenuHost {
  const defs: OwnedMenuDef[] = [];
  const listeners = createEmitter();
  let open: OpenMenu | null = null;
  let seq = 0;
  const emit = () => listeners.emit();

  const close = () => {
    if (!open) return;
    open = null;
    emit();
  };

  const resolve = (req: MenuOpenRequest): readonly MenuEntry[] => {
    const live = mergeMenuDefs(defs, src.activeTool());
    const def = req.menu !== undefined
      ? live.find((d) => d.id === req.menu)
      : req.hit ? pickMenu(live, req.hit) : undefined;
    return def ? resolveMenu(def, src, req.world, req.params) : [];
  };

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
      const entries = resolve(req);
      if (!entries.length) {
        close();
        return false;
      }
      open = {
        seq: ++seq, entries, client: req.client, world: req.world,
        ...(req.under ? { under: req.under } : {}),
        ...(req.side ? { side: req.side } : {}),
        source: req.source ?? 'pointer',
      };
      emit();
      return true;
    },
    has: (req) => resolve(req).length > 0,
    close,
    current: () => open,
    subscribe(fn) {
      return listeners.subscribe(fn);
    },
  };
}
