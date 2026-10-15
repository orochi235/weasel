# Context Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-click (or Shift+F10) on a weasel canvas or on app chrome opens a menu of registered actions, drawn by a DOM renderer now and a WebGL renderer later from one headless model.

**Architecture:** `@weasel-js/menu` is a dependency-free model (entries, keyboard/hover controller, placement). `@weasel-js/routing` adds declared menus (`MenuDef`, action references only), a `MenuHost` store created by `ActionsProvider` that picks, resolves and holds the open menu, and `menus` on tools and contributions. `@weasel-js/core` adds the `menu.context` standard action plus `menuHost` and `worldToClient` deps. `@weasel-js/ui` renders the open menu in the DOM; `@weasel-js/hud` renders it in WebGL (arc 3, last).

**Tech Stack:** TypeScript, React 18, vitest (jsdom `weasel-ui`/`core` projects, `browser` project for layout), tsup, changesets.

**Spec:** `docs/superpowers/specs/2026-10-15-context-menu-design.md`

**Worktree:** `/Users/mike/src/weasel-context-menu`, branch `context-menu`. Run `npm ci` there before the first build or smoke test (CLAUDE.md trap: a worktree without its own `node_modules` builds against main's).

## Global Constraints

- Every changeset is `patch`. Never write a `bump-approved` marker.
- No file over 400 lines, no function over 120 (`npm run check:size`). Never grow a file listed in `scripts/check-size.allow.json`; split it first.
- No inline styles except computed coordinates written through `el.style` in a layout effect (a menu's position cannot be a class). No `!important`.
- No bare `requestAnimationFrame`/`setInterval` (`npm run check:frame-loops`). Timers here are `setTimeout` behind an injectable scheduler.
- Every package's imports must be declared in its `package.json` (`npm run check:imports`).
- Core tests: `npx vitest run --project=core <path>`. `packages/*` other than core: `--project=weasel-ui`. Browser tests: `*.browser.test.tsx`, `npm run test:browser`.
- Typecheck: `npm run typecheck` (both programs), not bare `tsc`.
- US English; comments sparingly (CLAUDE.md "Comment sparingly").
- Commit after each task with an imperative, lower-case subject and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Spec adjustments made while planning

Recorded in the spec in Task 0. Each replaces a spec line that would not have worked:

- Menus resolve inside `MenuHost.open`, not in the action: an immediate action's `deps` hold only its own `requires`, and resolving needs every listed action's deps. The host has the registry and dep registry.
- `<SceneCanvas menus>` becomes `useMenus(defs)` (routing/react) plus `Contribution.menus`/`ToolDef.menus`. `SceneCanvas.tsx` is on the size allowlist and cannot grow.
- `actionShortcuts` moves from core to routing so `resolveMenu` can read shortcut chips; core re-exports it.
- A keyboard open needs a client point, so core adds a `worldToClient` dep.
- "Close when the view changes" is a wheel outside the panel: every pan and zoom while the menu has focus starts as a wheel or a press outside.

## Review Focus

1. **Right-click an unselected shape while another is selected:** the clicked shape becomes the only selection and the selection menu opens for it. Test in Task 8.
2. **Right-click near the window's right or bottom edge, and a submenu near the right edge:** both stay fully on screen (flip, then shift). Test in Task 1 (math) and Task 11 (browser).
3. **Right-click again while a menu is open:** one menu, at the new point, never the browser's. Test in Task 10 (`seq` remount) and Task 6 (`open` replaces).
4. **An item whose action became disabled after the menu opened:** choosing it closes the menu and does nothing, no throw. Test in Task 5.
5. **Escape after a pointer open:** focus returns to the canvas, so Delete still deletes. Test in Task 10.

---

## Arc 1 — model and plumbing

### Task 0: Record the planning adjustments in the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-context-menu-design.md`

- [ ] **Step 1: Edit the spec**

In "Layers", change the routing row to: `MenuDef`; `menus` on `ToolDef` and `Contribution`; `useMenus`; `MenuHost` (picks, resolves and holds the open menu); `resolveMenu`; `actionShortcuts` (moved from core); `evaluateEnabled` takes `at`. Change the core row to add the `worldToClient` dep.

In "Contents", replace "`<SceneCanvas menus>`" with "`useMenus(defs)` from `@weasel-js/routing/react`".

In "Opening", replace the action's step 3 with "`menuHost.open({ hit, client, world, source })`; the host picks the menu, resolves it and holds it." Replace "the view changing while open" with "a wheel outside the menu (every pan and zoom while the menu holds focus starts with one)".

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-10-15-context-menu-design.md
git commit -m "context-menu spec: resolve in the host, useMenus, worldToClient dep"
```

### Task 1: `@weasel-js/menu` package, entry types and placement

**Files:**
- Create: `packages/menu/package.json`, `packages/menu/tsconfig.json`, `packages/menu/tsup.config.ts`, `packages/menu/typedoc.config.mjs`, `packages/menu/README.md`, `packages/menu/LICENSE` (copy `packages/history/LICENSE`)
- Create: `packages/menu/src/index.ts`, `packages/menu/src/entries.ts`, `packages/menu/src/placement.ts`
- Test: `packages/menu/src/placement.test.ts`, `packages/menu/src/entries.test.ts`
- Modify: `tsconfig.json` (paths), `packages/core/tsconfig.json` (paths), `.changeset/config.json` (fixed group), `package.json` (`build:leaves`), `typedoc/categories.mjs`, `scripts/smoke-consumer-bundle.mjs` (import + `mods`)
- Create: `.changeset/menu-package.md`

**Interfaces:**
- Produces:
  - `type MenuEntry = MenuItemEntry | MenuSeparatorEntry | SubmenuEntry`
  - `interface MenuItemEntry { kind: 'item'; key: string; label: string; icon?: unknown; shortcut?: MenuShortcut; disabled?: boolean; checked?: boolean; run(): void }`
  - `interface MenuSeparatorEntry { kind: 'separator'; key: string }`
  - `interface SubmenuEntry { kind: 'submenu'; key: string; label: string; icon?: unknown; disabled?: boolean; entries: readonly MenuEntry[] }`
  - `interface MenuShortcut { key: string; mod: boolean; alt: boolean; shift: boolean }`
  - `isRow(e: MenuEntry): e is MenuItemEntry | SubmenuEntry`
  - `entriesAt(root: readonly MenuEntry[], stack: readonly (number | null)[], level: number): readonly MenuEntry[]`
  - `interface Rect { x: number; y: number; w: number; h: number }`, `interface Size { w: number; h: number }`, `interface Point { x: number; y: number }`
  - `placeMenu(size: Size, anchor: Point, bounds: Rect): Point`
  - `placeSubmenu(size: Size, row: Rect, bounds: Rect): Point`

- [ ] **Step 1: Scaffold the package**

`packages/menu/package.json` — copy `packages/history/package.json`, then set `"name": "@weasel-js/menu"`, `"description": "Headless menu model: entries, keyboard and pointer behavior, placement. No React, no DOM."`, `"directory": "packages/menu"`, and remove `dependencies`. Keep the version identical to every other package (the fixed group).

`tsconfig.json`, `tsup.config.ts`, `typedoc.config.mjs`: copy `packages/history`'s verbatim.

`README.md`: copy `packages/history/README.md`, replacing the name, description and `#pkg/history` with `#pkg/menu`.

Register it everywhere `@weasel-js/history` is registered:
- `tsconfig.json` paths: `"@weasel-js/menu": ["./packages/menu/src/index.ts"],`
- `packages/core/tsconfig.json` paths: `"@weasel-js/menu": ["../menu/src/index.ts"],`
- `.changeset/config.json`: add `"@weasel-js/menu"` to the `fixed` group beside `@weasel-js/history`.
- `package.json` `build:leaves`: add `-w @weasel-js/menu`.
- `typedoc/categories.mjs`: `['packages/menu/src', 'Menu'],`
- `scripts/smoke-consumer-bundle.mjs`: `import * as menu from '@weasel-js/menu';` beside the history import, and `menu` in the `mods` object.

`.changeset/menu-package.md`:

```md
---
'@weasel-js/menu': patch
---

New package: the headless model behind context menus — menu entries, keyboard and pointer behavior, and placement that keeps a menu and its submenus inside their bounds. It draws nothing; `@weasel-js/ui` and `@weasel-js/hud` render it.
```

- [ ] **Step 2: Write the failing tests**

`packages/menu/src/placement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { placeMenu, placeSubmenu } from './placement';

const bounds = { x: 0, y: 0, w: 800, h: 600 };
const size = { w: 200, h: 300 };

describe('placeMenu', () => {
  it('opens down and right of the anchor when it fits', () => {
    expect(placeMenu(size, { x: 100, y: 100 }, bounds)).toEqual({ x: 100, y: 100 });
  });
  it('flips left at the right edge', () => {
    expect(placeMenu(size, { x: 700, y: 100 }, bounds)).toEqual({ x: 500, y: 100 });
  });
  it('flips up at the bottom edge', () => {
    expect(placeMenu(size, { x: 100, y: 500 }, bounds)).toEqual({ x: 100, y: 200 });
  });
  it('shifts inside when neither side fits', () => {
    expect(placeMenu({ w: 200, h: 500 }, { x: 100, y: 300 }, bounds)).toEqual({ x: 100, y: 100 });
  });
  it('pins to the near edge when the menu is larger than the bounds', () => {
    expect(placeMenu({ w: 200, h: 900 }, { x: 100, y: 300 }, bounds)).toEqual({ x: 100, y: 0 });
  });
  it('respects a bounds origin that is not zero', () => {
    expect(placeMenu(size, { x: 950, y: 150 }, { x: 100, y: 100, w: 900, h: 600 }))
      .toEqual({ x: 750, y: 150 });
  });
});

describe('placeSubmenu', () => {
  const row = { x: 100, y: 120, w: 200, h: 24 };
  it('opens to the right of its row, top-aligned', () => {
    expect(placeSubmenu(size, row, bounds)).toEqual({ x: 300, y: 120 });
  });
  it('opens to the left when the right side does not fit', () => {
    expect(placeSubmenu(size, { ...row, x: 500 }, bounds)).toEqual({ x: 300, y: 120 });
  });
  it('shifts up so its bottom stays inside', () => {
    expect(placeSubmenu(size, { ...row, y: 500 }, bounds)).toEqual({ x: 300, y: 300 });
  });
});
```

`packages/menu/src/entries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { entriesAt, isRow, type MenuEntry } from './entries';

const run = () => {};
const root: MenuEntry[] = [
  { kind: 'item', key: 'a', label: 'A', run },
  { kind: 'separator', key: 's' },
  { kind: 'submenu', key: 'b', label: 'B', entries: [{ kind: 'item', key: 'b1', label: 'B1', run }] },
];

describe('entries', () => {
  it('tells rows from separators', () => {
    expect(root.map(isRow)).toEqual([true, false, true]);
  });
  it('walks the stack to a level', () => {
    expect(entriesAt(root, [2, null], 0)).toBe(root);
    expect(entriesAt(root, [2, null], 1).map((e) => e.key)).toEqual(['b1']);
  });
  it('returns nothing for a level whose parent is not a submenu', () => {
    expect(entriesAt(root, [0, null], 1)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run --project=weasel-ui packages/menu`
Expected: FAIL, modules `./placement` and `./entries` not found.

- [ ] **Step 4: Implement**

`packages/menu/src/entries.ts`:

```ts
/** A key chip, structurally the `ActionShortcut` routing derives from bindings. */
export interface MenuShortcut {
  key: string;
  mod: boolean;
  alt: boolean;
  shift: boolean;
}

/** A row that runs something when chosen. */
export interface MenuItemEntry {
  kind: 'item';
  key: string;
  label: string;
  /** Opaque to the model; each renderer knows what it can draw. */
  icon?: unknown;
  shortcut?: MenuShortcut;
  disabled?: boolean;
  /** `undefined` for a row with no on/off state. */
  checked?: boolean;
  run(): void;
}

/** A rule between groups of rows. Never highlighted. */
export interface MenuSeparatorEntry {
  kind: 'separator';
  key: string;
}

/** A row that opens another level. */
export interface SubmenuEntry {
  kind: 'submenu';
  key: string;
  label: string;
  icon?: unknown;
  disabled?: boolean;
  entries: readonly MenuEntry[];
}

/** One line of a menu. */
export type MenuEntry = MenuItemEntry | MenuSeparatorEntry | SubmenuEntry;

/** True for an entry the highlight can land on. */
export function isRow(e: MenuEntry): e is MenuItemEntry | SubmenuEntry {
  return e.kind !== 'separator';
}

/**
 * The entries shown at `level`, following `stack` (the highlighted index at
 * each open level) down from `root`. Empty when the path does not lead to a
 * submenu.
 */
export function entriesAt(
  root: readonly MenuEntry[],
  stack: readonly (number | null)[],
  level: number,
): readonly MenuEntry[] {
  let entries = root;
  for (let i = 0; i < level; i++) {
    const at = stack[i];
    const e = at == null ? undefined : entries[at];
    if (e?.kind !== 'submenu') return [];
    entries = e.entries;
  }
  return entries;
}
```

`packages/menu/src/placement.ts`:

```ts
export interface Point { x: number; y: number }
export interface Size { w: number; h: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** Start at `at`, else end there (flip), else slide inside `[lo, lo + span]`. */
function flipOrShift(at: number, len: number, lo: number, span: number): number {
  const hi = lo + span;
  if (at + len <= hi) return Math.max(lo, at);
  if (at - len >= lo) return at - len;
  return Math.max(lo, hi - len);
}

/** Where a menu of `size` opened at `anchor` goes: down and right of the
 *  anchor, flipped on an axis that does not fit, shifted inside `bounds`
 *  when neither side does. */
export function placeMenu(size: Size, anchor: Point, bounds: Rect): Point {
  return {
    x: flipOrShift(anchor.x, size.w, bounds.x, bounds.w),
    y: flipOrShift(anchor.y, size.h, bounds.y, bounds.h),
  };
}

/** Where a submenu goes: beside `row`, right first, left if that does not
 *  fit, top-aligned with the row and shifted up to stay inside `bounds`. */
export function placeSubmenu(size: Size, row: Rect, bounds: Rect): Point {
  const right = row.x + row.w;
  const hiX = bounds.x + bounds.w;
  const x = right + size.w <= hiX
    ? right
    : row.x - size.w >= bounds.x ? row.x - size.w : Math.max(bounds.x, hiX - size.w);
  const y = Math.max(bounds.y, Math.min(row.y, bounds.y + bounds.h - size.h));
  return { x, y };
}
```

`packages/menu/src/index.ts`:

```ts
/**
 * @weasel-js/menu — the headless model behind weasel's menus.
 *
 * @packageDocumentation
 */
export { entriesAt, isRow } from './entries';
export type { MenuEntry, MenuItemEntry, MenuSeparatorEntry, SubmenuEntry, MenuShortcut } from './entries';
export { placeMenu, placeSubmenu } from './placement';
export type { Point, Rect, Size } from './placement';
```

- [ ] **Step 5: Run the tests and the package checks**

Run: `npx vitest run --project=weasel-ui packages/menu && npm run check:test-projects && npm run check:imports && npm run typecheck`
Expected: all PASS; `check:test-projects` lists `packages/menu` under `weasel-ui`.

- [ ] **Step 6: Commit**

```bash
git add packages/menu tsconfig.json packages/core/tsconfig.json .changeset package.json typedoc/categories.mjs scripts/smoke-consumer-bundle.mjs
git commit -m "add @weasel-js/menu: menu entries and edge-aware placement"
```

### Task 2: Keyboard navigation and typeahead

**Files:**
- Create: `packages/menu/src/keys.ts`, `packages/menu/src/typeahead.ts`
- Test: `packages/menu/src/keys.test.ts`, `packages/menu/src/typeahead.test.ts`
- Modify: `packages/menu/src/index.ts`

**Interfaces:**
- Consumes: `MenuEntry`, `entriesAt`, `isRow` (Task 1)
- Produces:
  - `type MenuStack = readonly (number | null)[]` — highlighted index per open level; `length` is the number of open levels.
  - `type KeyEffect = { kind: 'none' } | { kind: 'choose'; level: number; index: number } | { kind: 'close' }`
  - `keyStep(root: readonly MenuEntry[], stack: MenuStack, key: string): { stack: MenuStack; effect: KeyEffect; handled: boolean }`
  - `firstRow(entries: readonly MenuEntry[]): number | null`
  - `typeaheadMatch(entries: readonly MenuEntry[], from: number | null, query: string): number | null`

- [ ] **Step 1: Write the failing tests**

`packages/menu/src/keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { keyStep } from './keys';
import type { MenuEntry } from './entries';

const run = () => {};
const root: MenuEntry[] = [
  { kind: 'item', key: 'cut', label: 'Cut', run },
  { kind: 'separator', key: 's1' },
  { kind: 'item', key: 'copy', label: 'Copy', run, disabled: true },
  { kind: 'submenu', key: 'arr', label: 'Arrange', entries: [
    { kind: 'item', key: 'fwd', label: 'Forward', run },
    { kind: 'item', key: 'back', label: 'Backward', run },
  ] },
];

describe('keyStep', () => {
  it('ArrowDown from nothing lands on the first row', () => {
    expect(keyStep(root, [null], 'ArrowDown').stack).toEqual([0]);
  });
  it('ArrowDown skips separators but not disabled rows', () => {
    expect(keyStep(root, [0], 'ArrowDown').stack).toEqual([2]);
  });
  it('ArrowDown wraps', () => {
    expect(keyStep(root, [3], 'ArrowDown').stack).toEqual([0]);
  });
  it('ArrowUp from nothing lands on the last row', () => {
    expect(keyStep(root, [null], 'ArrowUp').stack).toEqual([3]);
  });
  it('Home and End', () => {
    expect(keyStep(root, [2], 'Home').stack).toEqual([0]);
    expect(keyStep(root, [0], 'End').stack).toEqual([3]);
  });
  it('ArrowRight on a submenu opens it on its first row', () => {
    expect(keyStep(root, [3], 'ArrowRight').stack).toEqual([3, 0]);
  });
  it('ArrowRight on an item is handled and changes nothing', () => {
    const r = keyStep(root, [0], 'ArrowRight');
    expect(r).toMatchObject({ stack: [0], handled: true });
  });
  it('ArrowLeft closes a submenu level and not the root', () => {
    expect(keyStep(root, [3, 1], 'ArrowLeft').stack).toEqual([3]);
    expect(keyStep(root, [3], 'ArrowLeft').stack).toEqual([3]);
  });
  it('Enter on an enabled item chooses it', () => {
    expect(keyStep(root, [3, 1], 'Enter').effect).toEqual({ kind: 'choose', level: 1, index: 1 });
  });
  it('Enter on a disabled item does nothing', () => {
    expect(keyStep(root, [2], 'Enter').effect).toEqual({ kind: 'none' });
  });
  it('Space on a submenu opens it', () => {
    expect(keyStep(root, [3], ' ').stack).toEqual([3, 0]);
  });
  it('Escape closes one level, then the menu', () => {
    expect(keyStep(root, [3, 0], 'Escape').stack).toEqual([3]);
    expect(keyStep(root, [3], 'Escape').effect).toEqual({ kind: 'close' });
  });
  it('Tab closes the menu', () => {
    expect(keyStep(root, [0], 'Tab').effect).toEqual({ kind: 'close' });
  });
  it('leaves other keys unhandled', () => {
    expect(keyStep(root, [0], 'x').handled).toBe(false);
  });
});
```

`packages/menu/src/typeahead.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { typeaheadMatch } from './typeahead';
import type { MenuEntry } from './entries';

const run = () => {};
const rows: MenuEntry[] = [
  { kind: 'item', key: 'a', label: 'Copy', run },
  { kind: 'item', key: 'b', label: 'Cut', run },
  { kind: 'separator', key: 's' },
  { kind: 'item', key: 'c', label: 'Clear', run },
];

describe('typeaheadMatch', () => {
  it('finds the next row starting with one letter, after the highlight', () => {
    expect(typeaheadMatch(rows, 0, 'c')).toBe(1);
    expect(typeaheadMatch(rows, 1, 'c')).toBe(3);
  });
  it('wraps', () => {
    expect(typeaheadMatch(rows, 3, 'c')).toBe(0);
  });
  it('matches a longer query from the highlight itself', () => {
    expect(typeaheadMatch(rows, 1, 'cu')).toBe(1);
    expect(typeaheadMatch(rows, 0, 'cl')).toBe(3);
  });
  it('ignores case and returns null on no match', () => {
    expect(typeaheadMatch(rows, null, 'CO')).toBe(0);
    expect(typeaheadMatch(rows, null, 'z')).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project=weasel-ui packages/menu`
Expected: FAIL, `./keys` and `./typeahead` not found.

- [ ] **Step 3: Implement**

`packages/menu/src/keys.ts`:

```ts
import { entriesAt, isRow, type MenuEntry } from './entries';

/** The highlighted index at each open level; its length is how many are open. */
export type MenuStack = readonly (number | null)[];

/** What a key asks the owner of the menu to do beyond moving the highlight. */
export type KeyEffect =
  | { kind: 'none' }
  | { kind: 'choose'; level: number; index: number }
  | { kind: 'close' };

const NONE: KeyEffect = { kind: 'none' };

/** Index of the first row, or null for a level with none. */
export function firstRow(entries: readonly MenuEntry[]): number | null {
  const i = entries.findIndex(isRow);
  return i < 0 ? null : i;
}

function step(entries: readonly MenuEntry[], from: number | null, dir: 1 | -1): number | null {
  const n = entries.length;
  let i = from ?? (dir === 1 ? -1 : n);
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    if (isRow(entries[i]!)) return i;
  }
  return null;
}

function withTop(stack: MenuStack, index: number | null): MenuStack {
  return [...stack.slice(0, -1), index];
}

function openSub(root: readonly MenuEntry[], stack: MenuStack): MenuStack | null {
  const level = stack.length - 1;
  const at = stack[level];
  const e = at == null ? undefined : entriesAt(root, stack, level)[at];
  if (e?.kind !== 'submenu' || e.disabled) return null;
  return [...stack, firstRow(e.entries)];
}

/** Apply one key to the menu: the new stack, any effect, and whether the key
 *  was the menu's (an unhandled key goes on to typeahead). */
export function keyStep(
  root: readonly MenuEntry[],
  stack: MenuStack,
  key: string,
): { stack: MenuStack; effect: KeyEffect; handled: boolean } {
  const level = stack.length - 1;
  const rows = entriesAt(root, stack, level);
  const at = stack[level] ?? null;
  const done = (s: MenuStack, effect: KeyEffect = NONE) => ({ stack: s, effect, handled: true });
  switch (key) {
    case 'ArrowDown': return done(withTop(stack, step(rows, at, 1)));
    case 'ArrowUp': return done(withTop(stack, step(rows, at, -1)));
    case 'Home': return done(withTop(stack, step(rows, null, 1)));
    case 'End': return done(withTop(stack, step(rows, null, -1)));
    case 'ArrowRight': return done(openSub(root, stack) ?? stack);
    case 'ArrowLeft': return done(level > 0 ? stack.slice(0, -1) : stack);
    case 'Escape': return level > 0 ? done(stack.slice(0, -1)) : done(stack, { kind: 'close' });
    case 'Tab': return done(stack, { kind: 'close' });
    case 'Enter':
    case ' ': {
      const e = at == null ? undefined : rows[at];
      if (e?.kind === 'submenu') return done(openSub(root, stack) ?? stack);
      if (e?.kind === 'item' && !e.disabled) return done(stack, { kind: 'choose', level, index: at! });
      return done(stack);
    }
    default: return { stack, effect: NONE, handled: false };
  }
}
```

`packages/menu/src/typeahead.ts`:

```ts
import { isRow, type MenuEntry } from './entries';

/** The row a typed `query` lands on, searching forward from `from` with
 *  wrap. A one-letter query starts after the highlight so repeating a letter
 *  cycles; a longer one starts at it so typing on keeps the match. */
export function typeaheadMatch(
  entries: readonly MenuEntry[],
  from: number | null,
  query: string,
): number | null {
  const q = query.toLowerCase();
  const n = entries.length;
  const start = from == null ? 0 : q.length === 1 ? from + 1 : from;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    const e = entries[i]!;
    if (isRow(e) && e.label.toLowerCase().startsWith(q)) return i;
  }
  return null;
}
```

Add to `index.ts`:

```ts
export { keyStep, firstRow } from './keys';
export type { KeyEffect, MenuStack } from './keys';
export { typeaheadMatch } from './typeahead';
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=weasel-ui packages/menu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/menu
git commit -m "menu model: keyboard navigation and typeahead"
```

### Task 3: Menu controller (pointer, submenu delay, diagonal allowance)

**Files:**
- Create: `packages/menu/src/controller.ts`, `packages/menu/src/triangle.ts`
- Test: `packages/menu/src/controller.test.ts`, `packages/menu/src/triangle.test.ts`
- Modify: `packages/menu/src/index.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `interface MenuScheduler { now(): number; set(fn: () => void, ms: number): () => void }`
  - `const timerScheduler: MenuScheduler`
  - `interface MenuControllerOptions { entries: readonly MenuEntry[]; highlightFirst?: boolean; onClose(): void; scheduler?: MenuScheduler }`
  - `interface MenuController { stack(): MenuStack; entriesAt(level: number): readonly MenuEntry[]; key(key: string): boolean; hover(level: number, index: number | null, point?: Point): void; press(level: number, index: number): void; setPanel(level: number, rect: Rect): void; subscribe(fn: () => void): () => void; dispose(): void }`
  - `createMenuController(opts: MenuControllerOptions): MenuController`
  - `SUBMENU_OPEN_MS = 200`, `DIAGONAL_GRACE_MS = 300`, `TYPEAHEAD_RESET_MS = 500`
  - `inTriangle(p: Point, a: Point, b: Point, c: Point): boolean`

- [ ] **Step 1: Write the failing tests**

`packages/menu/src/triangle.test.ts`:

```ts
import { expect, it } from 'vitest';
import { inTriangle } from './triangle';

it('tells inside from outside, edges counting as inside', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: -10 }, c = { x: 10, y: 10 };
  expect(inTriangle({ x: 5, y: 0 }, a, b, c)).toBe(true);
  expect(inTriangle({ x: 5, y: 5 }, a, b, c)).toBe(true);
  expect(inTriangle({ x: 5, y: 8 }, a, b, c)).toBe(false);
  expect(inTriangle({ x: -1, y: 0 }, a, b, c)).toBe(false);
});
```

`packages/menu/src/controller.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createMenuController, type MenuScheduler } from './controller';
import type { MenuEntry } from './entries';

function fakeScheduler() {
  let now = 0;
  let timers: { at: number; fn: () => void }[] = [];
  const s: MenuScheduler = {
    now: () => now,
    set(fn, ms) {
      const t = { at: now + ms, fn };
      timers.push(t);
      return () => { timers = timers.filter((x) => x !== t); };
    },
  };
  const advance = (ms: number) => {
    now += ms;
    const due = timers.filter((t) => t.at <= now);
    timers = timers.filter((t) => t.at > now);
    for (const t of due) t.fn();
  };
  return { s, advance };
}

function setup(highlightFirst = false) {
  const ran: string[] = [];
  const run = (k: string) => () => { ran.push(k); };
  const entries: MenuEntry[] = [
    { kind: 'item', key: 'cut', label: 'Cut', run: run('cut') },
    { kind: 'item', key: 'off', label: 'Off', run: run('off'), disabled: true },
    { kind: 'submenu', key: 'arr', label: 'Arrange', entries: [
      { kind: 'item', key: 'fwd', label: 'Forward', run: run('fwd') },
    ] },
    { kind: 'item', key: 'del', label: 'Delete', run: run('del') },
  ];
  const onClose = vi.fn();
  const { s, advance } = fakeScheduler();
  const c = createMenuController({ entries, onClose, scheduler: s, highlightFirst });
  return { c, ran, onClose, advance };
}

describe('createMenuController', () => {
  it('starts with nothing highlighted on a pointer open, the first row on a keyboard open', () => {
    expect(setup().c.stack()).toEqual([null]);
    expect(setup(true).c.stack()).toEqual([0]);
  });

  it('closes before running a chosen item', () => {
    const { c, ran, onClose } = setup();
    c.press(0, 0);
    expect(onClose).toHaveBeenCalledOnce();
    expect(ran).toEqual(['cut']);
  });

  it('ignores a press on a disabled item', () => {
    const { c, ran, onClose } = setup();
    c.press(0, 1);
    expect(onClose).not.toHaveBeenCalled();
    expect(ran).toEqual([]);
  });

  it('opens a submenu on hover only after the delay', () => {
    const { c, advance } = setup();
    c.hover(0, 2, { x: 10, y: 50 });
    expect(c.stack()).toEqual([2]);
    advance(199);
    expect(c.stack()).toEqual([2]);
    advance(1);
    expect(c.stack()).toEqual([2, null]);
  });

  it('opens a submenu at once on press', () => {
    const { c } = setup();
    c.press(0, 2);
    expect(c.stack()).toEqual([2, null]);
  });

  it('keeps a submenu open while the pointer heads diagonally into it', () => {
    const { c, advance } = setup();
    c.setPanel(0, { x: 0, y: 0, w: 100, h: 100 });
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.setPanel(1, { x: 100, y: 40, w: 100, h: 60 });
    c.hover(0, 3, { x: 70, y: 60 });
    expect(c.stack()).toEqual([2, null]);
    c.hover(1, 0, { x: 110, y: 60 });
    expect(c.stack()).toEqual([2, 0]);
  });

  it('switches rows once the diagonal grace runs out', () => {
    const { c, advance } = setup();
    c.setPanel(0, { x: 0, y: 0, w: 100, h: 100 });
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.setPanel(1, { x: 100, y: 40, w: 100, h: 60 });
    c.hover(0, 3, { x: 70, y: 60 });
    advance(300);
    expect(c.stack()).toEqual([3]);
  });

  it('switches at once when the pointer moves away from the submenu', () => {
    const { c, advance } = setup();
    c.setPanel(0, { x: 0, y: 0, w: 100, h: 100 });
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.setPanel(1, { x: 100, y: 40, w: 100, h: 60 });
    c.hover(0, 3, { x: 30, y: 80 });
    expect(c.stack()).toEqual([3]);
  });

  it('typeahead accumulates within the reset window', () => {
    const { c, advance } = setup(true);
    c.key('d');
    expect(c.stack()).toEqual([3]);
    advance(600);
    c.key('c');
    expect(c.stack()).toEqual([0]);
  });

  it('Escape at the root closes', () => {
    const { c, onClose } = setup();
    c.key('Escape');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('notifies subscribers and stops timers on dispose', () => {
    const { c, advance } = setup();
    const fn = vi.fn();
    c.subscribe(fn);
    c.hover(0, 2, { x: 0, y: 0 });
    expect(fn).toHaveBeenCalled();
    c.dispose();
    advance(500);
    expect(c.stack()).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project=weasel-ui packages/menu`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`packages/menu/src/triangle.ts`:

```ts
import type { Point } from './placement';

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Whether `p` lies in triangle `abc`, edges included. */
export function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = cross(p, a, b), d2 = cross(p, b, c), d3 = cross(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
```

`packages/menu/src/controller.ts`:

```ts
import { entriesAt, type MenuEntry } from './entries';
import { firstRow, keyStep, type MenuStack } from './keys';
import type { Point, Rect } from './placement';
import { inTriangle } from './triangle';
import { typeaheadMatch } from './typeahead';

export const SUBMENU_OPEN_MS = 200;
export const DIAGONAL_GRACE_MS = 300;
export const TYPEAHEAD_RESET_MS = 500;

/** Clock and timer, injected so tests and headless hosts control time. */
export interface MenuScheduler {
  now(): number;
  /** Run `fn` after `ms`; returns a cancel. */
  set(fn: () => void, ms: number): () => void;
}

export const timerScheduler: MenuScheduler = {
  now: () => Date.now(),
  set: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

export interface MenuControllerOptions {
  entries: readonly MenuEntry[];
  /** Highlight the first row at open, as a keyboard open does. */
  highlightFirst?: boolean;
  /** The menu is done: an item was chosen, or it was dismissed. */
  onClose(): void;
  scheduler?: MenuScheduler;
}

/** One open menu's behavior, independent of what draws it. */
export interface MenuController {
  stack(): MenuStack;
  entriesAt(level: number): readonly MenuEntry[];
  /** Returns whether the key was the menu's. */
  key(key: string): boolean;
  /** The pointer is over row `index` of `level`, or over none of its rows. */
  hover(level: number, index: number | null, point?: Point): void;
  press(level: number, index: number): void;
  /** Where `level`'s panel is, for the diagonal allowance. */
  setPanel(level: number, rect: Rect): void;
  subscribe(fn: () => void): () => void;
  dispose(): void;
}

export function createMenuController(opts: MenuControllerOptions): MenuController {
  const { entries: root, onClose } = opts;
  const sched = opts.scheduler ?? timerScheduler;
  let stack: MenuStack = [opts.highlightFirst ? firstRow(root) : null];
  const listeners = new Set<() => void>();
  const panels = new Map<number, Rect>();
  let pending: (() => void) | null = null;
  let lastPoint: Point | null = null;
  let typed = '';
  let typedAt = -Infinity;
  let live = true;

  const set = (next: MenuStack) => {
    stack = next;
    for (const fn of listeners) fn();
  };
  const cancel = () => { pending?.(); pending = null; };
  const later = (fn: () => void, ms: number) => {
    cancel();
    pending = sched.set(() => { pending = null; if (live) fn(); }, ms);
  };

  const choose = (level: number, index: number) => {
    const e = entriesAt(root, stack, level)[index];
    if (e?.kind !== 'item' || e.disabled) return;
    cancel();
    onClose();
    e.run();
  };

  const openAt = (level: number, index: number) => {
    const e = entriesAt(root, stack, level)[index];
    const base = [...stack.slice(0, level), index];
    set(e?.kind === 'submenu' && !e.disabled ? [...base, null] : base);
  };

  /** Heading from the last point toward the open child's near edge. */
  const headingIntoChild = (level: number, p: Point): boolean => {
    const child = panels.get(level + 1);
    const parent = panels.get(level);
    if (!child || !parent || !lastPoint || stack.length <= level + 1) return false;
    const edge = child.x >= parent.x ? child.x : child.x + child.w;
    return inTriangle(p, lastPoint, { x: edge, y: child.y }, { x: edge, y: child.y + child.h });
  };

  const hoverNow = (level: number, index: number | null) => {
    if (index === null) {
      if (stack.length === level + 1) set([...stack.slice(0, level), null]);
      return;
    }
    const e = entriesAt(root, stack, level)[index];
    set([...stack.slice(0, level), index]);
    if (e?.kind === 'submenu' && !e.disabled) later(() => openAt(level, index), SUBMENU_OPEN_MS);
    else cancel();
  };

  return {
    stack: () => stack,
    entriesAt: (level) => entriesAt(root, stack, level),
    key(key) {
      const r = keyStep(root, stack, key);
      if (r.handled) {
        cancel();
        if (r.stack !== stack) set(r.stack);
        if (r.effect.kind === 'choose') choose(r.effect.level, r.effect.index);
        else if (r.effect.kind === 'close') onClose();
        return true;
      }
      if (key.length !== 1 || key === ' ') return false;
      const now = sched.now();
      typed = (now - typedAt < TYPEAHEAD_RESET_MS ? typed : '') + key;
      typedAt = now;
      const level = stack.length - 1;
      const hit = typeaheadMatch(entriesAt(root, stack, level), stack[level] ?? null, typed);
      if (hit !== null) set([...stack.slice(0, level), hit]);
      return true;
    },
    hover(level, index, point) {
      if (point && index !== stack[level] && headingIntoChild(level, point)) {
        lastPoint = point;
        later(() => hoverNow(level, index), DIAGONAL_GRACE_MS);
        return;
      }
      if (point) lastPoint = point;
      if (index === stack[level] && stack.length > level + 1) { cancel(); return; }
      hoverNow(level, index);
    },
    press(level, index) {
      const e = entriesAt(root, stack, level)[index];
      cancel();
      if (e?.kind === 'item') choose(level, index);
      else openAt(level, index);
    },
    setPanel(level, rect) { panels.set(level, rect); },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    dispose() {
      live = false;
      cancel();
      listeners.clear();
    },
  };
}
```

Add to `index.ts`:

```ts
export {
  createMenuController, timerScheduler, SUBMENU_OPEN_MS, DIAGONAL_GRACE_MS, TYPEAHEAD_RESET_MS,
} from './controller';
export type { MenuController, MenuControllerOptions, MenuScheduler } from './controller';
export { inTriangle } from './triangle';
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=weasel-ui packages/menu && npm run check:size`
Expected: PASS. If `createMenuController` trips the 120-line function limit, move the `key` method's typeahead half into a `typeaheadStep(root, stack, key, state, now)` in `typeahead.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/menu
git commit -m "menu model: controller with submenu delay and diagonal allowance"
```

### Task 4: Move `actionShortcuts` to routing; `evaluateEnabled` takes a point

**Files:**
- Move: `packages/core/src/interactions/actions/actionShortcuts.ts` → `packages/routing/src/interactions/actions/actionShortcuts.ts` (and its test beside it)
- Modify: `packages/routing/src/index.ts`, `packages/core/src/barrel/routing.ts`, `packages/routing/src/interactions/actions/actionEnabled.ts`
- Test: `packages/routing/src/interactions/actions/actionEnabled.test.ts` (create if absent, else add a case)
- Create: `.changeset/menu-routing-shortcuts.md`

**Interfaces:**
- Produces: `actionShortcuts` and `ActionShortcut` exported from `@weasel-js/routing` (core re-exports unchanged names); `evaluateEnabled(action: Action, deps?: ActionDeps, at?: { x: number; y: number }): ActionEnabledResult`.

- [ ] **Step 1: Move the file**

```bash
git mv packages/core/src/interactions/actions/actionShortcuts.ts packages/routing/src/interactions/actions/actionShortcuts.ts
git mv packages/core/src/interactions/actions/actionShortcuts.test.ts packages/routing/src/interactions/actions/actionShortcuts.test.ts
```

In the moved file, change `import type { GestureSpec } from '../gestures/spec';` to `import type { GestureSpec } from '@weasel-js/gestures';`, and the two `@weasel-js/routing` imports to `import type { Action } from './action';` and `import { actionBindings } from './binding';` (find `actionBindings`'s real module with `git grep -n "export function actionBindings" packages/routing/src`). Fix the test's imports the same way.

In `packages/routing/src/index.ts`, beside `actionItems`:

```ts
export { actionShortcuts } from './interactions/actions/actionShortcuts';
export type { ActionShortcut } from './interactions/actions/actionShortcuts';
```

In `packages/core/src/barrel/routing.ts`, change the line that re-exports `actionShortcuts` from `'../interactions/actions/actionShortcuts'` to re-export it by name from `'@weasel-js/routing'` (by name, never `export *` — CLAUDE.md trap).

- [ ] **Step 2: Write the failing test for `at`**

Add to `actionEnabled.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateEnabled } from './actionEnabled';
import { ActionDisabledReason, type Action } from './action';

describe('evaluateEnabled with a point', () => {
  it('passes the point to the predicate', () => {
    const action: Action = {
      id: 'here', label: 'Here',
      enabled: (_deps, at) => (at && at.x > 0 ? true : ActionDisabledReason.NotApplicable),
    };
    expect(evaluateEnabled(action, undefined, { x: 5, y: 0 }).enabled).toBe(true);
    expect(evaluateEnabled(action, undefined, { x: -5, y: 0 }).enabled).toBe(false);
    expect(evaluateEnabled(action).enabled).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/routing/src/interactions/actions/actionEnabled.test.ts`
Expected: FAIL on the first assertion (the point is dropped).

- [ ] **Step 4: Implement**

In `actionEnabled.ts`, change the signature and the call:

```ts
export function evaluateEnabled(
  action: Action,
  deps?: ActionDeps,
  at?: { x: number; y: number },
): ActionEnabledResult {
```

and `const result = action.enabled(deps, at);`.

`.changeset/menu-routing-shortcuts.md`:

```md
---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`actionShortcuts` now lives in `@weasel-js/routing` (core still exports it). `evaluateEnabled` takes an optional point and passes it to `Action.enabled`, so a menu can ask whether an action applies where it was opened.
```

- [ ] **Step 5: Run the affected tests and checks**

Run: `npx vitest run --project=weasel-ui packages/routing/src/interactions/actions && npx vitest run --project=core packages/core/src/barrel && npm run typecheck && npm run check:imports`
Expected: PASS. If `check:imports` reports `@weasel-js/gestures` undeclared in routing, add it to routing's `dependencies` at the fixed-group version.

- [ ] **Step 6: Commit**

```bash
git add -A packages/routing packages/core .changeset
git commit -m "move actionShortcuts to routing; pass the point to evaluateEnabled"
```

### Task 5: `MenuDef`, menu merging and picking, `resolveMenu`

**Files:**
- Create: `packages/routing/src/menus/types.ts`, `packages/routing/src/menus/pickMenu.ts`, `packages/routing/src/menus/resolveMenu.ts`
- Test: `packages/routing/src/menus/pickMenu.test.ts`, `packages/routing/src/menus/resolveMenu.test.ts`
- Modify: `packages/routing/package.json` (add `"@weasel-js/menu"` dependency at the fixed version), `packages/routing/src/index.ts`

**Interfaces:**
- Consumes: `MenuEntry` (Task 1), `evaluateEnabled(action, deps, at)` and `actionShortcuts` (Task 4), `actionItems`, `evaluateActive`.
- Produces:
  - `type MenuDefEntry = { action: string; params?: Record<string, unknown>; label?: string } | { submenu: string; label: string; sections: MenuDefEntry[][] } | { actionVariants: string }`
  - `interface MenuWhen { bodyTarget?: BodyTarget | readonly BodyTarget[]; bodyKind?: string | readonly string[] }`
  - `interface MenuDef { id: string; when?: MenuWhen; sections: MenuDefEntry[][] }`
  - `interface MenuHit { bodyTarget?: BodyTarget; bodyKind?: string }`
  - `interface OwnedMenuDef { def: MenuDef; owner: string | null }`
  - `mergeMenuDefs(defs: readonly OwnedMenuDef[], activeTool: string | null): MenuDef[]`
  - `pickMenu(defs: readonly MenuDef[], hit: MenuHit): MenuDef | undefined`
  - `interface MenuSources { actions(): readonly Action[]; depsFor(action: Action): ActionDeps | undefined; trigger(id: string, params?: Record<string, unknown>): boolean }`
  - `resolveMenu(def: MenuDef, src: MenuSources, at?: { x: number; y: number }, params?: Record<string, unknown>): MenuEntry[]`

- [ ] **Step 1: Write the failing tests**

`packages/routing/src/menus/pickMenu.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeMenuDefs, pickMenu } from './pickMenu';
import type { MenuDef } from './types';

const sel: MenuDef = { id: 'sel', when: { bodyTarget: ['selected-body'] }, sections: [[{ action: 'cut' }]] };
const text: MenuDef = { id: 'text', when: { bodyTarget: 'selected-body', bodyKind: 'text' }, sections: [[{ action: 'editText' }]] };
const empty: MenuDef = { id: 'canvas', when: { bodyTarget: 'empty' }, sections: [[{ action: 'paste' }]] };
const chrome: MenuDef = { id: 'row', sections: [[{ action: 'delete' }]] };

describe('pickMenu', () => {
  it('takes the first def whose when matches', () => {
    expect(pickMenu([text, sel, empty], { bodyTarget: 'selected-body', bodyKind: 'text' })?.id).toBe('text');
    expect(pickMenu([text, sel, empty], { bodyTarget: 'selected-body', bodyKind: 'rect' })?.id).toBe('sel');
    expect(pickMenu([text, sel, empty], { bodyTarget: 'empty' })?.id).toBe('canvas');
  });
  it('never picks a def with no when', () => {
    expect(pickMenu([chrome], { bodyTarget: 'empty' })).toBeUndefined();
  });
});

describe('mergeMenuDefs', () => {
  it('joins same-id defs section by section, ambient before the active tool', () => {
    const tool: MenuDef = { id: 'sel', sections: [[{ action: 'toolA' }], [{ action: 'toolB' }]] };
    const merged = mergeMenuDefs([{ def: tool, owner: 'pen' }, { def: sel, owner: null }], 'pen');
    expect(merged).toHaveLength(1);
    expect(merged[0]!.when).toEqual(sel.when);
    expect(merged[0]!.sections).toEqual([[{ action: 'cut' }, { action: 'toolA' }], [{ action: 'toolB' }]]);
  });
  it('drops a tool def while another tool is active', () => {
    const tool: MenuDef = { id: 'sel', sections: [[{ action: 'toolA' }]] };
    expect(mergeMenuDefs([{ def: sel, owner: null }, { def: tool, owner: 'pen' }], 'select')[0]!.sections)
      .toEqual([[{ action: 'cut' }]]);
  });
});
```

`packages/routing/src/menus/resolveMenu.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { resolveMenu, type MenuSources } from './resolveMenu';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';

const immediate = { timing: 'immediate' as const, run: () => {} };
const actions: Action[] = [
  { id: 'cut', label: 'Cut', invoker: immediate, defaultBinding: { kind: 'key', key: 'x', mods: { meta: true } } },
  { id: 'paste', label: 'Paste', invoker: immediate,
    enabled: (_d, at) => (at ? true : ActionDisabledReason.NotApplicable) },
  { id: 'snap', label: 'Snap', invoker: immediate, active: () => true },
  { id: 'align', label: 'Align', invoker: immediate, variants: [
    { key: 'l', label: 'Left', params: { edge: 'left' } },
    { key: 'r', label: 'Right', params: { edge: 'right' } },
  ] },
  { id: 'drag', label: 'Drag', invoker: { timing: 'ongoing', start: () => ({}) as never } },
];

function sources(): MenuSources & { trigger: ReturnType<typeof vi.fn> } {
  return { actions: () => actions, depsFor: () => undefined, trigger: vi.fn(() => true) };
}

describe('resolveMenu', () => {
  it('builds rows from the registry and separators between sections', () => {
    const entries = resolveMenu({ id: 'm', sections: [[{ action: 'cut' }], [{ action: 'snap' }]] }, sources());
    expect(entries.map((e) => e.kind)).toEqual(['item', 'separator', 'item']);
    expect(entries[0]).toMatchObject({ label: 'Cut', shortcut: expect.objectContaining({ key: 'x' }) });
    expect(entries[2]).toMatchObject({ checked: true });
  });
  it('drops unregistered and non-immediate actions, and sections left empty', () => {
    const entries = resolveMenu({ id: 'm', sections: [[{ action: 'nope' }, { action: 'drag' }], [{ action: 'cut' }]] }, sources());
    expect(entries.map((e) => e.kind === 'item' && e.label)).toEqual(['Cut']);
  });
  it('asks enabled with the point', () => {
    const def = { id: 'm', sections: [[{ action: 'paste' }]] };
    expect(resolveMenu(def, sources(), { x: 1, y: 2 })[0]).toMatchObject({ disabled: false });
    expect(resolveMenu(def, sources())[0]).toMatchObject({ disabled: true });
  });
  it('runs through trigger with the item params, the menu params and the point', () => {
    const src = sources();
    const [row] = resolveMenu({ id: 'm', sections: [[{ action: 'cut', params: { a: 1 } }]] }, src, { x: 3, y: 4 }, { nodeId: 'n1' });
    (row as { run(): void }).run();
    expect(src.trigger).toHaveBeenCalledWith('cut', { nodeId: 'n1', a: 1, worldX: 3, worldY: 4 });
  });
  it('expands actionVariants into one row each', () => {
    const entries = resolveMenu({ id: 'm', sections: [[{ actionVariants: 'align' }]] }, sources());
    expect(entries.map((e) => e.kind === 'item' && e.label)).toEqual(['Left', 'Right']);
  });
  it('nests submenus and drops an empty one', () => {
    const def = { id: 'm', sections: [[
      { submenu: 'arr', label: 'Arrange', sections: [[{ action: 'cut' }]] },
      { submenu: 'none', label: 'Nothing', sections: [[{ action: 'nope' }]] },
    ]] };
    const entries = resolveMenu(def, sources());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'submenu', label: 'Arrange' });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project=weasel-ui packages/routing/src/menus`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`packages/routing/src/menus/types.ts`:

```ts
import type { BodyTarget } from '@weasel-js/gestures';

/** One line of a declared menu: an action, a submenu, or every variant of an action. */
export type MenuDefEntry =
  | { action: string; params?: Record<string, unknown>; label?: string }
  | { submenu: string; label: string; sections: MenuDefEntry[][] }
  | { actionVariants: string };

/** Which canvas hit a menu answers. Every field given must match. */
export interface MenuWhen {
  bodyTarget?: BodyTarget | readonly BodyTarget[];
  bodyKind?: string | readonly string[];
}

/** A menu as data. Items reference actions by id; a separator is drawn
 *  between sections. A def without `when` is opened only by id, from chrome. */
export interface MenuDef {
  id: string;
  when?: MenuWhen;
  sections: MenuDefEntry[][];
}

/** What a right-click landed on. */
export interface MenuHit {
  bodyTarget?: BodyTarget;
  bodyKind?: string;
}

/** A def with who contributed it: a tool id, or `null` for ambient. */
export interface OwnedMenuDef {
  def: MenuDef;
  owner: string | null;
}
```

`packages/routing/src/menus/pickMenu.ts`:

```ts
import type { MenuDef, MenuHit, MenuWhen, OwnedMenuDef } from './types';

const oneOf = <T>(want: T | readonly T[] | undefined, got: T | undefined) =>
  want === undefined || (Array.isArray(want) ? (want as readonly T[]).includes(got as T) : want === got);

function matches(when: MenuWhen, hit: MenuHit): boolean {
  return oneOf(when.bodyTarget, hit.bodyTarget) && oneOf(when.bodyKind, hit.bodyKind);
}

/** The menus live now: ambient defs, then the active tool's, with defs that
 *  share an id joined section by section. The first def of an id supplies
 *  its `when`. */
export function mergeMenuDefs(defs: readonly OwnedMenuDef[], activeTool: string | null): MenuDef[] {
  const live = [
    ...defs.filter((d) => d.owner === null),
    ...defs.filter((d) => d.owner !== null && d.owner === activeTool),
  ];
  const byId = new Map<string, MenuDef>();
  for (const { def } of live) {
    const prev = byId.get(def.id);
    if (!prev) { byId.set(def.id, { ...def, sections: def.sections.map((s) => [...s]) }); continue; }
    def.sections.forEach((s, i) => { prev.sections[i] = [...(prev.sections[i] ?? []), ...s]; });
    if (!prev.when && def.when) prev.when = def.when;
  }
  return [...byId.values()];
}

/** The first def whose `when` matches `hit`. */
export function pickMenu(defs: readonly MenuDef[], hit: MenuHit): MenuDef | undefined {
  return defs.find((d) => d.when !== undefined && matches(d.when, hit));
}
```

`packages/routing/src/menus/resolveMenu.ts`:

```ts
import type { MenuEntry } from '@weasel-js/menu';
import type { Action } from '../interactions/actions/action';
import type { ActionDeps } from '../interactions/actions/invoker';
import { actionItems } from '../interactions/actions/actionItems';
import { actionShortcuts } from '../interactions/actions/actionShortcuts';
import { evaluateActive, evaluateEnabled } from '../interactions/actions/actionEnabled';
import type { MenuDef, MenuDefEntry } from './types';

/** What resolving reads: the registered actions, each one's deps, and how to run one. */
export interface MenuSources {
  actions(): readonly Action[];
  depsFor(action: Action): ActionDeps | undefined;
  trigger(id: string, params?: Record<string, unknown>): boolean;
}

type Ctx = {
  src: MenuSources;
  byId: Map<string, Action>;
  at?: { x: number; y: number };
  params?: Record<string, unknown>;
};

function itemOf(
  ctx: Ctx, action: Action, key: string, label: string, own?: Readonly<Record<string, unknown>>,
): MenuEntry {
  const deps = ctx.src.depsFor(action);
  const point = ctx.at ? { worldX: ctx.at.x, worldY: ctx.at.y } : {};
  return {
    kind: 'item',
    key,
    label,
    icon: action.icon,
    shortcut: actionShortcuts(action, own as Record<string, unknown> | undefined)[0],
    disabled: !evaluateEnabled(action, deps, ctx.at).enabled,
    checked: evaluateActive(action, deps),
    run: () => { ctx.src.trigger(action.id, { ...ctx.params, ...own, ...point }); },
  };
}

function rowsOf(ctx: Ctx, e: MenuDefEntry, path: string): MenuEntry[] {
  if ('submenu' in e) {
    const entries = sectionsOf(ctx, e.sections, `${path}/${e.submenu}`);
    return entries.length ? [{ kind: 'submenu', key: `${path}/${e.submenu}`, label: e.label, entries }] : [];
  }
  const id = 'action' in e ? e.action : e.actionVariants;
  const action = ctx.byId.get(id);
  if (!action || action.invoker?.timing !== 'immediate') return [];
  if ('actionVariants' in e) {
    return actionItems(action).map((it) => itemOf(ctx, action, `${path}/${it.key}`, it.label, it.params));
  }
  return [itemOf(ctx, action, `${path}/${action.id}`, e.label ?? action.label, e.params)];
}

function sectionsOf(ctx: Ctx, sections: MenuDefEntry[][], path: string): MenuEntry[] {
  const out: MenuEntry[] = [];
  sections.forEach((section, i) => {
    const rows = section.flatMap((e) => rowsOf(ctx, e, path));
    if (!rows.length) return;
    if (out.length) out.push({ kind: 'separator', key: `${path}/sep${i}` });
    out.push(...rows);
  });
  return out;
}

/** Turn a declared menu into model entries. `at` is the world point it was
 *  opened at and reaches `enabled` and every item's params; `params` go to
 *  every item, under the item's own. */
export function resolveMenu(
  def: MenuDef,
  src: MenuSources,
  at?: { x: number; y: number },
  params?: Record<string, unknown>,
): MenuEntry[] {
  const byId = new Map(src.actions().map((a) => [a.id, a]));
  return sectionsOf({ src, byId, at, params }, def.sections, def.id);
}
```

Export from `packages/routing/src/index.ts`:

```ts
// ─── menus ────────────────────────────────────────────────────────────────
export type { MenuDef, MenuDefEntry, MenuWhen, MenuHit, OwnedMenuDef } from './menus/types';
export { mergeMenuDefs, pickMenu } from './menus/pickMenu';
export { resolveMenu } from './menus/resolveMenu';
export type { MenuSources } from './menus/resolveMenu';
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=weasel-ui packages/routing/src/menus && npm run check:imports`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/routing
git commit -m "routing: declared menus, merging, picking and resolving against the registry"
```

### Task 6: `MenuHost`, `useMenuHost`, `useMenus`, and `menus` on tools and contributions

**Files:**
- Create: `packages/routing/src/menus/menuHost.ts`, `packages/routing/src/menus/MenuHostContext.tsx`
- Test: `packages/routing/src/menus/menuHost.test.ts`, `packages/routing/src/menus/useMenus.test.tsx`
- Modify: `packages/routing/src/interactions/actions/ActionsProvider.tsx`, `packages/routing/src/index.ts` (DepSchema + exports), `packages/routing/src/react.ts`, `packages/routing/src/tools/routeTypes.ts`, `packages/routing/src/contributions/types.ts`, `packages/routing/src/tools/defineTool.ts`
- Create: `.changeset/menu-host.md`

**Interfaces:**
- Consumes: Task 5.
- Produces:
  - `interface MenuOpenRequest { menu?: string; hit?: MenuHit; client: { x: number; y: number }; world?: { x: number; y: number }; viewId?: string | null; params?: Record<string, unknown>; source?: 'pointer' | 'keyboard' }`
  - `interface OpenMenu { seq: number; entries: readonly MenuEntry[]; client: { x: number; y: number }; world?: { x: number; y: number }; viewId?: string | null; source: 'pointer' | 'keyboard' }`
  - `interface MenuHost { define(def: MenuDef, owner?: string | null): () => void; open(req: MenuOpenRequest): boolean; close(): void; current(): OpenMenu | null; subscribe(fn: () => void): () => void }`
  - `createMenuHost(src: MenuSources & { activeTool(): string | null }): MenuHost`
  - `useMenuHost(): MenuHost | null`, `useMenus(defs: readonly MenuDef[]): void` (from `@weasel-js/routing/react`)
  - `DepSchema.menuHost?: MenuHost`
  - `ToolDef.menus?: MenuDef[]`, `ContributionRouting.menus?: MenuDef[]`

- [ ] **Step 1: Write the failing tests**

`packages/routing/src/menus/menuHost.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createMenuHost } from './menuHost';
import type { Action } from '../interactions/actions/action';

const immediate = { timing: 'immediate' as const, run: () => {} };
const actions: Action[] = [{ id: 'cut', label: 'Cut', invoker: immediate }];

function host(activeTool: string | null = null) {
  return createMenuHost({
    actions: () => actions, depsFor: () => undefined, trigger: () => true, activeTool: () => activeTool,
  });
}

describe('createMenuHost', () => {
  it('opens the menu a hit picks, at the client point', () => {
    const h = host();
    h.define({ id: 'sel', when: { bodyTarget: 'selected-body' }, sections: [[{ action: 'cut' }]] });
    expect(h.open({ hit: { bodyTarget: 'selected-body' }, client: { x: 5, y: 6 } })).toBe(true);
    expect(h.current()).toMatchObject({ client: { x: 5, y: 6 }, source: 'pointer' });
    expect(h.current()!.entries).toHaveLength(1);
  });
  it('opens a menu by id', () => {
    const h = host();
    h.define({ id: 'row', sections: [[{ action: 'cut' }]] });
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(true);
  });
  it('opens nothing for no match or an empty resolution', () => {
    const h = host();
    h.define({ id: 'gone', when: { bodyTarget: 'empty' }, sections: [[{ action: 'nope' }]] });
    expect(h.open({ hit: { bodyTarget: 'selected-body' }, client: { x: 0, y: 0 } })).toBe(false);
    expect(h.open({ hit: { bodyTarget: 'empty' }, client: { x: 0, y: 0 } })).toBe(false);
    expect(h.current()).toBeNull();
  });
  it('replaces an open menu with a new seq', () => {
    const h = host();
    h.define({ id: 'row', sections: [[{ action: 'cut' }]] });
    h.open({ menu: 'row', client: { x: 0, y: 0 } });
    const first = h.current()!.seq;
    h.open({ menu: 'row', client: { x: 9, y: 9 } });
    expect(h.current()).toMatchObject({ client: { x: 9, y: 9 } });
    expect(h.current()!.seq).not.toBe(first);
  });
  it('notifies on open and close, and a define can be released', () => {
    const h = host();
    const fn = vi.fn();
    h.subscribe(fn);
    const release = h.define({ id: 'row', sections: [[{ action: 'cut' }]] });
    h.open({ menu: 'row', client: { x: 0, y: 0 } });
    h.close();
    expect(fn).toHaveBeenCalledTimes(2);
    release();
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(false);
  });
  it('only uses a tool-owned def while that tool is active', () => {
    const h = host('select');
    h.define({ id: 'row', sections: [[{ action: 'cut' }]] }, 'pen');
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(false);
  });
});
```

`packages/routing/src/menus/useMenus.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ActionsProvider, useAction } from '../interactions/actions/ActionsProvider';
import { useMenuHost, useMenus } from './MenuHostContext';
import type { MenuHost } from './menuHost';

const cut = { id: 'cut', label: 'Cut', invoker: { timing: 'immediate' as const, run: () => {} } };

describe('useMenus', () => {
  it('registers defs on the host ActionsProvider created, for its lifetime', () => {
    let host: MenuHost | null = null;
    function Probe() {
      useAction(cut);
      useMenus([{ id: 'row', sections: [[{ action: 'cut' }]] }]);
      host = useMenuHost();
      return null;
    }
    const { unmount } = render(<ActionsProvider><Probe /></ActionsProvider>);
    expect(host!.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(true);
    unmount();
    expect(host!.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project=weasel-ui packages/routing/src/menus`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`packages/routing/src/menus/menuHost.ts`:

```ts
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
```

`packages/routing/src/menus/MenuHostContext.tsx`:

```tsx
import { createContext, useContext, useEffect } from 'react';
import type { MenuHost } from './menuHost';
import type { MenuDef } from './types';

export const MenuHostContext = createContext<MenuHost | null>(null);

/** The menu host of the nearest `<ActionsProvider>`, or null outside one. */
export function useMenuHost(): MenuHost | null {
  return useContext(MenuHostContext);
}

/** Declare menus for the calling component's lifetime. Memoize `defs`. */
export function useMenus(defs: readonly MenuDef[], owner: string | null = null): void {
  const host = useMenuHost();
  useEffect(() => {
    if (!host) return;
    const releases = defs.map((d) => host.define(d, owner));
    return () => { for (const r of releases) r(); };
  }, [host, defs, owner]);
}
```

In `ActionsProvider.tsx`, inside `ActionsProvider`, after `node`:

```tsx
  const menuHost = useMemo(() => createMenuHost({
    actions: () => node.registry.list(),
    depsFor: (a) => (depRegRef.current ? buildDepsFromRequires(a, depRegRef.current) : undefined),
    trigger: (id, params) => node.registry.trigger(id, params),
    activeTool: () => depRegRef.current?.get('activeTool')?.active ?? null,
  }), [node, depRegRef]);
  return (
    <ActionsContext.Provider value={node.registry}>
      <MenuHostContext.Provider value={menuHost}>{children}</MenuHostContext.Provider>
    </ActionsContext.Provider>
  );
```

Import `createMenuHost` from `'../../menus/menuHost'`, `MenuHostContext` from `'../../menus/MenuHostContext'`, and `buildDepsFromRequires` from `'./buildDeps'` (check the file for an existing import first).

In `packages/routing/src/index.ts`, add to `DepSchema`:

```ts
  /** The menu host of the `ActionsProvider` in scope. */
  menuHost?: import('./menus/menuHost').MenuHost;
```

and export `createMenuHost`, `MenuHost`, `MenuOpenRequest`, `OpenMenu` in the menus block.

In `packages/routing/src/react.ts`:

```ts
export { useMenuHost, useMenus } from './menus/MenuHostContext';
```

`ToolDef` (`routeTypes.ts`), beside `actions?`:

```ts
  /** Menus this tool adds while it is active. */
  menus?: import('../menus/types').MenuDef[];
```

`ContributionRouting` (`contributions/types.ts`), beside `actions?`:

```ts
  /** Menus this entry declares: always, for an ambient entry; while active, for a tool. */
  menus?: MenuDef[];
```

(import `MenuDef` type at the top). In `defineTool.ts`, pass `menus: def.menus,` beside `actions: def.actions,`.

`.changeset/menu-host.md`:

```md
---
'@weasel-js/routing': patch
---

Declared menus. A `MenuDef` lists action ids in sections; tools and contributions carry them as `menus`, and `useMenus` declares them from any component. `<ActionsProvider>` now creates a `MenuHost`, reachable with `useMenuHost()` and as the `menuHost` dep, that picks the menu for a right-click, resolves its rows from the registry, and holds the open menu for a renderer to draw.
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run --project=weasel-ui packages/routing && npm run typecheck && npm run check:size`
Expected: PASS. `ActionsProvider.tsx` stays under 400 lines.

- [ ] **Step 5: Commit**

```bash
git add packages/routing .changeset
git commit -m "routing: MenuHost on ActionsProvider, useMenus, menus on tools and contributions"
```

### Task 7: The dispatcher carries the client point; core registers menus and the new deps

**Files:**
- Modify: `packages/routing/src/interactions/dispatcher/inputFacts.ts`
- Test: `packages/routing/src/interactions/dispatcher/inputFacts.test.ts` (create if absent)
- Modify: `packages/core/src/canvas/SceneCanvas/useContributionRoles.ts`, `packages/core/src/canvas/SceneCanvas/StandardActionsRegistrar.tsx`, `packages/core/src/interactions/actions/depSchema.ts`
- Test: `packages/core/src/canvas/SceneCanvas/contributionMenus.test.tsx`

**Interfaces:**
- Consumes: `MenuHost`, `useMenuHost` (Task 6).
- Produces: `contextmenu` immediate params `{ worldX, worldY, clientX, clientY, bodyTarget, bodyKind, affordance, mods }`; core `DepSchema.worldToClient?: (x: number, y: number) => { x: number; y: number } | null`; the `menuHost` dep published by `<SceneCanvas>`; tool and contribution `menus` defined on the host.

- [ ] **Step 1: Write the failing tests**

`inputFacts.test.ts`:

```ts
import { expect, it } from 'vitest';
import { immediateParams } from './inputFacts';

it('gives a contextmenu its client point and body kind', () => {
  const p = immediateParams({
    kind: 'contextmenu', x: 1, y: 2, clientX: 30, clientY: 40,
    bodyTarget: 'selected-body', bodyKind: 'text',
    shiftKey: false, altKey: false, metaKey: false, ctrlKey: false,
  } as never, undefined);
  expect(p).toMatchObject({ worldX: 1, worldY: 2, clientX: 30, clientY: 40, bodyTarget: 'selected-body', bodyKind: 'text' });
});
```

(Read `ContextMenuEvent` in `packages/gestures/src/ui/inputEvent.ts` and replace the modifier fields with whatever it really carries before running.)

`contributionMenus.test.tsx` — mount a `<SceneCanvas>` with an ambient contribution carrying `menus`, the way `packages/core/src/canvas/SceneCanvas/*.test.tsx` already mounts one with `ambient` (copy the closest existing harness; `git grep -ln "ambient={" packages/core/src/canvas` finds them). Assert:

```tsx
  // inside the test, with a Probe child reading useMenuHost():
  expect(host!.open({ menu: 'contrib.menu', client: { x: 0, y: 0 } })).toBe(true);
```

where the contribution is `{ id: 'contrib', eligibility: { always: true }, actions: [cut], menus: [{ id: 'contrib.menu', sections: [[{ action: 'cut' }]] }] }`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project=weasel-ui packages/routing/src/interactions/dispatcher/inputFacts.test.ts && npx vitest run --project=core packages/core/src/canvas/SceneCanvas/contributionMenus.test.tsx`
Expected: both FAIL (no `clientX`; menu not defined).

- [ ] **Step 3: Implement**

In `immediateParams`, split `contextmenu` out of the shared `pointerdown`/`longpress` case:

```ts
    case 'contextmenu':
      return {
        worldX: event.x, worldY: event.y,
        clientX: event.clientX, clientY: event.clientY,
        affordance: event.affordance,
        bodyTarget: event.bodyTarget,
        bodyKind: event.bodyKind,
        mods: modifiersOf(event),
        ...resolved,
      };
```

In `useContributionRoles.ts`, beside the action registration effect:

```ts
  const menuHost = useMenuHost();
  useEffect(() => {
    if (!menuHost) return;
    const releases: Array<() => void> = [];
    for (const [id, entry] of Object.entries(toolRegistry)) {
      for (const def of (entry as SurfaceContribution).menus ?? []) releases.push(menuHost.define(def, id));
    }
    for (const entry of ambient) {
      for (const def of (entry as SurfaceContribution).menus ?? []) releases.push(menuHost.define(def, null));
    }
    return () => { for (const r of releases) r(); };
  }, [menuHost, toolRegistry, ambient]);
```

(`useMenuHost` from `'@weasel-js/routing/react'`.)

In core's `depSchema.ts` `DepSchema`, beside `debug?`:

```ts
    /** Viewport point of a world point on this canvas, or null before it mounts.
     *  Sourced by `<SceneCanvas>`. */
    worldToClient?: (x: number, y: number) => { x: number; y: number } | null;
```

In `StandardActionsRegistrar.tsx`, after `useDepSource('pointer', …)`:

```ts
  const menuHost = useMenuHost();
  useDepSource('menuHost', () => menuHost ?? undefined);
  useDepSource('worldToClient', () => (x: number, y: number) => {
    const el = canvasRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const [sx, sy] = worldToScreen(x, y, viewToTransform(currentViewRef.current));
    return { x: r.left + sx, y: r.top + sy };
  });
```

Imports: `useMenuHost` from `'@weasel-js/routing/react'`; `worldToScreen` from `'core/core/viewport/viewTransform'`; `viewToTransform` from `'core/core/viewport/view'` (match the alias style the file already uses).

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run --project=weasel-ui packages/routing/src/interactions/dispatcher && npx vitest run --project=core packages/core/src/canvas/SceneCanvas && npm run typecheck && npm run check:size`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/routing packages/core
git commit -m "carry the client point on contextmenu; register contributed menus and the menuHost and worldToClient deps"
```

### Task 8: The `menu.context` standard action

**Files:**
- Create: `packages/core/src/interactions/actions/defaults/contextMenu.ts`
- Test: `packages/core/src/interactions/actions/defaults/contextMenu.test.ts`, `packages/core/src/interactions/actions/defaults/contextMenu.integration.test.tsx`
- Modify: `packages/core/src/interactions/actions/useStandardActions.ts` (add to `KIT_STANDARD_DESCRIPTORS`), `packages/core/src/canvas/SceneCanvas/features.ts` (add `'menu.context'` to the preset that holds `'selectAll'`)
- Create: `.changeset/menu-context-action.md`

**Interfaces:**
- Consumes: `menuHost`, `worldToClient`, `selection`, `nodeAtPoint`, `scene`, `poseDescriptor`, `view` deps; immediate params from Task 7.
- Produces: `contextMenuAction: Action` with id `'menu.context'`; `openContextMenu(deps: ActionDeps, params?: Record<string, unknown>): boolean`.

- [ ] **Step 1: Write the failing unit tests**

`contextMenu.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { openContextMenu } from './contextMenu';

function deps(over: Record<string, unknown> = {}) {
  const selected: string[] = ['a'];
  return {
    menuHost: { open: vi.fn(() => true) },
    selection: { get: () => selected, set: vi.fn((ids: string[]) => { selected.splice(0, selected.length, ...ids); }) },
    nodeAtPoint: vi.fn(() => 'b'),
    worldToClient: (x: number, y: number) => ({ x: x + 1000, y: y + 1000 }),
    scene: { get: (id: string) => ({ id, kind: id === 'a' ? 'text' : 'rect' }) },
    ...over,
  } as never;
}

describe('openContextMenu', () => {
  it('selects an unselected body first, then opens for the hit', () => {
    const d = deps() as { menuHost: { open: ReturnType<typeof vi.fn> }; selection: { set: ReturnType<typeof vi.fn> } };
    openContextMenu(d as never, { worldX: 5, worldY: 6, clientX: 50, clientY: 60, bodyTarget: 'unselected-body', bodyKind: 'rect' });
    expect(d.selection.set).toHaveBeenCalledWith(['b']);
    expect(d.menuHost.open).toHaveBeenCalledWith({
      hit: { bodyTarget: 'selected-body', bodyKind: 'rect' },
      client: { x: 50, y: 60 }, world: { x: 5, y: 6 }, source: 'pointer',
    });
  });
  it('leaves the selection alone on empty canvas', () => {
    const d = deps() as { selection: { set: ReturnType<typeof vi.fn> } };
    openContextMenu(d as never, { worldX: 5, worldY: 6, clientX: 50, clientY: 60, bodyTarget: 'empty' });
    expect(d.selection.set).not.toHaveBeenCalled();
  });
  it('opens from the keyboard at the selection, highlighted', () => {
    const d = deps() as { menuHost: { open: ReturnType<typeof vi.fn> } };
    const centerOf = vi.fn(() => ({ x: 10, y: 20 }));
    openContextMenu(d as never, undefined, centerOf);
    expect(d.menuHost.open).toHaveBeenCalledWith(expect.objectContaining({
      hit: { bodyTarget: 'selected-body', bodyKind: 'text' },
      client: { x: 1010, y: 1020 }, world: { x: 10, y: 20 }, source: 'keyboard',
    }));
  });
  it('does nothing without a menu host', () => {
    expect(openContextMenu(deps({ menuHost: undefined }) as never, { worldX: 0, worldY: 0, clientX: 0, clientY: 0 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/defaults/contextMenu.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`contextMenu.ts`:

```ts
import type { Action, ActionDeps } from '@weasel-js/routing';
import type { BodyTarget } from '@weasel-js/gestures';
import { scenePoseFrame } from '../poseFrame';
import { poseDescriptorOf } from '../poseDescriptorDep';
import { visualBoundsViaDescriptor } from 'core/core/geometry/poseDescriptor';
import { unionAABB } from 'core/geometry/unionBounds';
import { screenToWorld } from 'core/core/viewport/viewTransform';
import { viewToTransform } from 'core/core/viewport/view';

type XY = { x: number; y: number };

/** World center of the selection's bounds, else of the visible canvas. */
export function keyboardAnchor(deps: ActionDeps): XY | null {
  const ids = deps.selection?.get() ?? [];
  if (ids.length && deps.scene) {
    const frame = scenePoseFrame(deps.scene);
    const geom = poseDescriptorOf(deps.poseDescriptor);
    const box = unionAABB(ids.map((id) => visualBoundsViaDescriptor(frame.world(id), geom)));
    if (box) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  const view = deps.view?.get();
  const size = deps.view?.hostSize?.();
  if (!view || !size) return null;
  const [x, y] = screenToWorld(size.width / 2, size.height / 2, viewToTransform(view));
  return { x, y };
}

/** Open the menu for a right-click, or for Shift+F10 when `params` carry no client point. */
export function openContextMenu(
  deps: ActionDeps,
  params?: Record<string, unknown>,
  anchorOf: (deps: ActionDeps) => XY | null = keyboardAnchor,
): boolean {
  const host = deps.menuHost;
  if (!host) return false;
  const p = params ?? {};
  if (typeof p.clientX === 'number' && typeof p.worldX === 'number') {
    const world = { x: p.worldX, y: p.worldY as number };
    let bodyTarget = p.bodyTarget as BodyTarget | undefined;
    if (bodyTarget === 'unselected-body') {
      const id = deps.nodeAtPoint?.(world);
      if (id) { deps.selection?.set([id]); bodyTarget = 'selected-body'; }
    }
    return host.open({
      hit: { bodyTarget, bodyKind: p.bodyKind as string | undefined },
      client: { x: p.clientX, y: p.clientY as number }, world, source: 'pointer',
    });
  }
  const world = anchorOf(deps);
  const client = world && deps.worldToClient?.(world.x, world.y);
  if (!world || !client) return false;
  const ids = deps.selection?.get() ?? [];
  const bodyKind = ids.length === 1 ? (deps.scene?.get(ids[0]!) as { kind?: string } | undefined)?.kind : undefined;
  return host.open({
    hit: { bodyTarget: ids.length ? 'selected-body' : 'empty', bodyKind },
    client, world, source: 'keyboard',
  });
}

const INITIAL = [{ channel: '*', phase: 'initial' }] as const;

/**
 * @experimental
 * Opens the context menu: for the pointer on a right-click or an unclaimed
 * long-press, selecting the shape under it first; for the keyboard on
 * Shift+F10 or the ContextMenu key, at the selection.
 */
export const contextMenuAction: Action & { requires: string[] } = {
  id: 'menu.context',
  label: 'Show Context Menu',
  defaultBinding: [
    { kind: 'contextMenu' },
    { kind: 'key', key: 'F10', mods: { shift: true }, phase: [...INITIAL] },
    { kind: 'key', key: 'ContextMenu', phase: [...INITIAL] },
  ],
  requires: ['menuHost', 'selection', 'nodeAtPoint', 'scene', 'poseDescriptor', 'view', 'worldToClient'],
  invoker: { timing: 'immediate', run: (deps, params) => { openContextMenu(deps, params); } },
};
```

If the typechecker rejects a `defaultBinding` entry's shape, copy the exact form from `defaults/delete.ts` (key + phase) and `packages/hud/src/tool.ts` (`contextMenu`).

Add `contextMenuAction` to `KIT_STANDARD_DESCRIPTORS` after `escapeAction`, and `'menu.context'` to the `features.ts` preset that holds `'selectAll'`.

`.changeset/menu-context-action.md`:

```md
---
'@weasel-js/core': patch
---

A right-click, an unclaimed long-press, Shift+F10 or the ContextMenu key now runs the `menu.context` standard action. It selects the shape under the pointer if it was not selected, then asks the menu host for the menu declared for that hit. With no menu declared, nothing changes: the browser menu stays suppressed as before.
```

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/defaults/contextMenu.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the integration test (Review Focus 1)**

`contextMenu.integration.test.tsx` — mount `<SceneCanvas>` with two rect nodes `a` and `b`, `a` selected, and a child that calls `useMenus([{ id: 'sel', when: { bodyTarget: 'selected-body' }, sections: [[{ action: 'delete' }]] }])` and reads `useMenuHost()`. Copy the mounting and the pointer-at-world-point helper from `packages/core/src/interactions/dispatcher/longPress.integration.test.tsx`. Fire a `contextmenu` event on the canvas over `b`, then assert:

```tsx
expect(selection.get()).toEqual(['b']);
expect(host!.current()?.entries.map((e) => e.kind === 'item' && e.label)).toEqual(['Delete']);
```

Add a second case: a HUD contribution (`createHudContribution`) with a widget under the point keeps the right-click — `host.current()` stays `null` (the HUD's more specific binding wins).

- [ ] **Step 6: Run the integration test and the standard-actions tests**

Run: `npx vitest run --project=core packages/core/src/interactions/actions packages/core/src/canvas/SceneCanvas packages/core/src/interactions/dispatcher/longPress.integration.test.tsx`
Expected: PASS. A test enumerating the standard action ids fails only to list `menu.context`; update its expected list.

- [ ] **Step 7: Commit**

```bash
git add packages/core .changeset
git commit -m "core: menu.context standard action on right-click, long-press and Shift+F10"
```

### Task 9: Paste lands at the menu's point

**Files:**
- Modify: `packages/core/src/interactions/actions/clipboard/clipboardOps.ts`, `packages/core/src/interactions/actions/clipboard/action.ts`, `packages/core/src/interactions/actions/depSchema.ts` (the clipboard dep's `paste`)
- Test: `packages/core/src/interactions/actions/clipboard/pasteAt.test.tsx`

**Interfaces:**
- Produces: `paste(at?: { worldX: number; worldY: number }): void` on `UseClipboardOpsReturn` and the `clipboard` dep; `clipboard.paste` passes `worldX`/`worldY` params through.

- [ ] **Step 1: Write the failing test**

Copy the harness of the nearest existing `useClipboardOps` test (`git grep -ln "useClipboardOps" packages/core/src --include='*.test.*'`). Assert that `paste({ worldX: 300, worldY: 400 })` threads `{ worldX: 300, worldY: 400 }` to `commitPaste` as `ctx.dropPoint`, ignoring `getDropPoint`, and that `trigger('clipboard.paste', { worldX: 300, worldY: 400 })` does the same.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/clipboard/pasteAt.test.tsx`
Expected: FAIL (drop point comes from `getDropPoint`).

- [ ] **Step 3: Implement**

In `clipboardOps.ts`, give `paste` an optional `at` and use it ahead of `getDropPoint`:

```ts
  paste(at?: { worldX: number; worldY: number }): void;
```

and in the implementation, where the drop point is pulled: `const dropPoint = at ?? getDropPoint?.() ?? <existing pointer fallback>;`. Update the dep's `paste()` signature in `depSchema.ts` to match. In `clipboardPasteAction.invoker.run`:

```ts
    run: (deps, params) => {
      const x = params?.worldX, y = params?.worldY;
      deps.clipboard?.paste(typeof x === 'number' && typeof y === 'number' ? { worldX: x, worldY: y } : undefined);
    },
```

- [ ] **Step 4: Run the clipboard tests**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/clipboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "clipboard.paste pastes at a world point when given one"
```

---

## Arc 2 — DOM renderer and WeaselDraw

### Task 10: `<ContextMenuHost>` (DOM renderer)

**Files:**
- Create: `packages/ui/src/components/ContextMenu/ContextMenuHost.tsx`, `MenuPanel.tsx`, `MenuRow.tsx`, `useDismiss.ts`, `ContextMenu.module.css`, `index.ts`
- Test: `packages/ui/src/components/ContextMenu/ContextMenuHost.test.tsx`
- Modify: `packages/ui/src/index.ts`, `packages/ui/package.json` (`@weasel-js/menu` dependency)
- Create: `.changeset/context-menu-dom.md`

**Interfaces:**
- Consumes: `useMenuHost`, `OpenMenu` (Task 6; reach them through `@weasel-js/core` if core re-exports routing's react surface, else `@weasel-js/routing/react`), `createMenuController`, `placeMenu`, `placeSubmenu` (Tasks 1–3), `formatShortcut` (ui), `useOverlayPortal` (ui).
- Produces: `<ContextMenuHost />` — renders whatever the host has open; nothing otherwise.

- [ ] **Step 1: Write the failing tests**

`ContextMenuHost.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider, useAction, useMenuHost, useMenus } from '@weasel-js/routing/react';
import type { MenuHost } from '@weasel-js/routing';
import { ContextMenuHost } from './ContextMenuHost';

const ran: string[] = [];
const act1 = (id: string, extra = {}) => ({
  id, label: id[0]!.toUpperCase() + id.slice(1),
  invoker: { timing: 'immediate' as const, run: () => { ran.push(id); } }, ...extra,
});
const MENUS = [{ id: 'm', sections: [[{ action: 'cut' }, { action: 'copy' }], [{ submenu: 'arr', label: 'Arrange', sections: [[{ action: 'forward' }]] }]] }];

let host: MenuHost | null = null;
function Setup() {
  useAction(act1('cut')); useAction(act1('copy')); useAction(act1('forward'));
  useMenus(MENUS);
  host = useMenuHost();
  return <ContextMenuHost />;
}

function openAt(x = 10, y = 10, source: 'pointer' | 'keyboard' = 'pointer') {
  act(() => { host!.open({ menu: 'm', client: { x, y }, source }); });
}

describe('ContextMenuHost', () => {
  it('renders nothing until a menu opens', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders rows with menu roles and a separator', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt();
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map((r) => r.textContent)).toEqual(['Cut', 'Copy', 'Arrange']);
    expect(screen.getByRole('separator')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Arrange' }).getAttribute('aria-haspopup')).toBe('menu');
  });

  it('runs an item on click and closes', () => {
    ran.length = 0;
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));
    expect(ran).toEqual(['copy']);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('drives the highlight from the keyboard and opens a submenu', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt(10, 10, 'keyboard');
    const menu = screen.getByRole('menu');
    expect(document.activeElement).toBe(menu);
    expect(menu.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: 'Cut' }).id);
    fireEvent.keyDown(menu, { key: 'End' });
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    expect(screen.getAllByRole('menu')).toHaveLength(2);
  });

  it('closes on Escape and returns focus where it was (Review Focus 5)', () => {
    render(<ActionsProvider><button>canvas</button><Setup /></ActionsProvider>);
    const before = screen.getByRole('button', { name: 'canvas' });
    before.focus();
    openAt();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  it('closes on a press outside, a wheel outside, and window blur', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    for (const dismiss of [
      () => fireEvent.pointerDown(document.body),
      () => fireEvent.wheel(document.body),
      () => fireEvent.blur(window),
    ]) {
      openAt();
      act(dismiss);
      expect(screen.queryByRole('menu')).toBeNull();
    }
  });

  it('a second open replaces the first (Review Focus 3)', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    openAt(10, 10);
    openAt(50, 50);
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });

  it('an item disabled since opening does nothing when chosen (Review Focus 4)', () => {
    ran.length = 0;
    let allowed = true;
    function Gate() {
      useAction(act1('gated', { enabled: () => (allowed ? true : 'not-applicable') }));
      useMenus(GATED);
      return null;
    }
    const GATED = [{ id: 'g', sections: [[{ action: 'gated' }]] }];
    render(<ActionsProvider><Gate /><Setup /></ActionsProvider>);
    act(() => { host!.open({ menu: 'g', client: { x: 0, y: 0 } }); });
    allowed = false;
    expect(() => fireEvent.click(screen.getByRole('menuitem', { name: 'Gated' }))).not.toThrow();
    expect(ran).toEqual([]);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/ContextMenu`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`useDismiss.ts`:

```ts
import { useEffect } from 'react';

/** Close on a press or wheel outside every panel, on window blur and on resize. */
export function useDismiss(isInside: (target: EventTarget | null) => boolean, close: () => void): void {
  useEffect(() => {
    const outside = (e: Event) => { if (!isInside(e.target)) close(); };
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('wheel', outside, { capture: true, passive: true });
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('wheel', outside, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [isInside, close]);
}
```

`MenuRow.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { MenuEntry } from '@weasel-js/menu';
import { formatShortcut } from '../ToolPalette/formatShortcut';
import { Caret } from '../Caret';
import s from './ContextMenu.module.css';

const iconOf = (icon: unknown): ReactNode => (typeof icon === 'function' ? (icon as () => ReactNode)() : (icon as ReactNode));

/** One line of a panel. Rows are `div`s: the panel owns focus and points at
 *  the highlighted row with `aria-activedescendant`. */
export function MenuRow(props: {
  entry: MenuEntry; id: string; highlighted: boolean; expanded: boolean;
  onHover(e: React.PointerEvent): void; onPress(): void;
}) {
  const { entry: e, id, highlighted, expanded } = props;
  if (e.kind === 'separator') return <div role="separator" className={s.separator} />;
  const role = e.kind === 'item' && e.checked !== undefined ? 'menuitemcheckbox' : 'menuitem';
  return (
    <div
      id={id}
      role={role}
      className={s.row}
      data-highlighted={highlighted || undefined}
      aria-disabled={e.disabled || undefined}
      aria-checked={e.kind === 'item' && e.checked !== undefined ? e.checked : undefined}
      aria-haspopup={e.kind === 'submenu' ? 'menu' : undefined}
      aria-expanded={e.kind === 'submenu' ? expanded : undefined}
      onPointerMove={props.onHover}
      onClick={props.onPress}
    >
      <span className={s.icon} aria-hidden="true">{e.kind === 'item' && e.checked ? '✓' : iconOf(e.icon)}</span>
      <span className={s.label}>{e.label}</span>
      {e.kind === 'item' && e.shortcut && <span className={s.shortcut}>{formatShortcut(e.shortcut)}</span>}
      {e.kind === 'submenu' && <Caret className={s.caret} />}
    </div>
  );
}
```

(Check `Caret`'s props; if it has no `className`, wrap it in `<span className={s.caret}>`.)

`MenuPanel.tsx`:

```tsx
import { useLayoutEffect, useRef } from 'react';
import type { MenuController, MenuEntry, Rect } from '@weasel-js/menu';
import { placeMenu, placeSubmenu } from '@weasel-js/menu';
import { MenuRow } from './MenuRow';
import s from './ContextMenu.module.css';

/** One level of the open menu, positioned in the viewport. */
export function MenuPanel(props: {
  controller: MenuController; level: number; entries: readonly MenuEntry[];
  highlight: number | null; childOpen: boolean; idBase: string;
  anchor: { x: number; y: number } | null;
  parentRow: () => Rect | null;
  focus: boolean;
  register(el: HTMLElement | null): void;
}) {
  const { controller: c, level, entries, highlight, idBase } = props;
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const size = { w: el.offsetWidth, h: el.offsetHeight };
    const bounds = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    const row = props.parentRow();
    const at = row ? placeSubmenu(size, row, bounds) : placeMenu(size, props.anchor ?? { x: 0, y: 0 }, bounds);
    el.style.left = `${at.x}px`;
    el.style.top = `${at.y}px`;
    c.setPanel(level, { x: at.x, y: at.y, w: size.w, h: size.h });
    if (props.focus) el.focus();
  }, [c, level, props.anchor, props.focus]);

  return (
    <div
      ref={(el) => { ref.current = el; props.register(el); }}
      role="menu"
      tabIndex={-1}
      className={s.panel}
      aria-activedescendant={highlight == null ? undefined : `${idBase}-${level}-${highlight}`}
      onKeyDown={(e) => { if (c.key(e.key)) { e.preventDefault(); e.stopPropagation(); } }}
      onPointerLeave={() => c.hover(level, null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry, i) => (
        <MenuRow
          key={entry.key}
          entry={entry}
          id={`${idBase}-${level}-${i}`}
          highlighted={highlight === i}
          expanded={highlight === i && props.childOpen}
          onHover={(e) => c.hover(level, i, { x: e.clientX, y: e.clientY })}
          onPress={() => c.press(level, i)}
        />
      ))}
    </div>
  );
}
```

`ContextMenuHost.tsx`:

```tsx
import { useCallback, useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { createMenuController, type Rect } from '@weasel-js/menu';
import { useMenuHost, type OpenMenu } from '@weasel-js/routing/react';
import { useOverlayPortal } from '../../overlays/portalHost';
import { MenuPanel } from './MenuPanel';
import { useDismiss } from './useDismiss';

const noop = () => () => {};
const nothing = () => null;

/** Draws the menu the nearest `<ActionsProvider>`'s host has open. Mount one per app. */
export function ContextMenuHost() {
  const host = useMenuHost();
  const open = useSyncExternalStore(host?.subscribe ?? noop, host?.current ?? nothing, host?.current ?? nothing);
  const { anchor, portalProps, ready } = useOverlayPortal();
  const target = portalProps.UNSTABLE_portalContainer ?? (typeof document !== 'undefined' ? document.body : null);
  return (
    <>
      {anchor}
      {open && ready && target && host && createPortal(<OpenPanels key={open.seq} open={open} close={host.close} />, target)}
    </>
  );
}

function OpenPanels({ open, close }: { open: OpenMenu; close: () => void }) {
  const idBase = useId();
  const returnTo = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
  const panels = useRef(new Map<number, HTMLElement>());
  const controller = useMemo(() => createMenuController({
    entries: open.entries, highlightFirst: open.source === 'keyboard', onClose: close,
  }), [open, close]);
  useEffect(() => () => {
    controller.dispose();
    (returnTo.current as HTMLElement | null)?.focus?.();
  }, [controller]);
  const stack = useSyncExternalStore(controller.subscribe, controller.stack, controller.stack);
  const isInside = useCallback(
    (t: EventTarget | null) => [...panels.current.values()].some((el) => t instanceof Node && el.contains(t)),
    [],
  );
  useDismiss(isInside, close);

  const rowRect = (level: number): Rect | null => {
    const at = stack[level];
    const el = at == null ? null : document.getElementById(`${idBase}-${level}-${at}`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  return (
    <>
      {stack.map((highlight, level) => (
        <MenuPanel
          key={level}
          controller={controller}
          level={level}
          entries={controller.entriesAt(level)}
          highlight={highlight}
          childOpen={stack.length > level + 1}
          idBase={idBase}
          anchor={level === 0 ? open.client : null}
          parentRow={() => (level === 0 ? null : rowRect(level - 1))}
          focus={level === stack.length - 1}
          register={(el) => { if (el) panels.current.set(level, el); else panels.current.delete(level); }}
        />
      ))}
    </>
  );
}
```

If `OpenMenu`/`useMenuHost` aren't reachable from `@weasel-js/routing/react`, import `useMenuHost` from there and `OpenMenu` from `@weasel-js/routing`; match how `CommandPalette` imports `useActionsRegistry` (from `@weasel-js/core`) and do the same if core re-exports them — then add `useMenuHost`, `useMenus` and the menu types to core's routing barrel by name.

`ContextMenu.module.css`:

```css
.panel {
  composes: surface from '../listbox.module.css';
  position: fixed;
  z-index: var(--wzl-z-popover, 1000);
  min-width: 180px;
  padding: var(--wzl-space-2);
  user-select: none;
}

.row {
  display: grid;
  grid-template-columns: 1.25em 1fr auto;
  align-items: center;
  gap: var(--wzl-space-2);
  padding: var(--wzl-space-1) var(--wzl-space-2);
  border-radius: var(--wzl-radius-sm);
  color: var(--wzl-fg);
  cursor: default;
}

.row[data-highlighted] {
  background: var(--wzl-surface-hover);
}

.row[aria-disabled='true'] {
  color: var(--wzl-fg-muted);
}

.icon { display: inline-flex; justify-content: center; }
.label { white-space: nowrap; }
.shortcut { color: var(--wzl-fg-muted); font-variant-numeric: tabular-nums; }
.caret { justify-self: end; }

.separator {
  height: 1px;
  margin: var(--wzl-space-1) 0;
  background: var(--wzl-border);
}
```

Before committing, confirm each `--wzl-*` token used here exists: `grep -c -- '--wzl-fg-muted\|--wzl-radius-sm\|--wzl-space-1\|--wzl-z-popover' packages/theme/src/**/*.css` (or wherever `tokens.css` is generated); replace any that does not with the nearest one `MenuButton.module.css` uses.

`index.ts`: `export { ContextMenuHost } from './ContextMenuHost';` and add it to `packages/ui/src/index.ts`.

`.changeset/context-menu-dom.md`:

```md
---
'@weasel-js/ui': patch
---

`<ContextMenuHost>` draws the open context menu in the DOM: rows with menu roles, shortcut chips, submenus that open beside their row, keyboard navigation and typeahead, and placement that keeps every panel on screen. It closes on a choice, Escape, a press or wheel outside, and window blur, and gives focus back to where it was.
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/ContextMenu && npm run check:imports && npm run typecheck && npm run check:size`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui packages/core .changeset
git commit -m "ui: ContextMenuHost draws the open menu in the DOM"
```

### Task 11: Placement in a real browser, and `useContextMenu` for chrome

**Files:**
- Create: `packages/ui/src/components/ContextMenu/ContextMenuHost.browser.test.tsx`, `packages/ui/src/components/ContextMenu/useContextMenu.ts`
- Test: `packages/ui/src/components/ContextMenu/useContextMenu.test.tsx`
- Modify: `packages/ui/src/components/ContextMenu/index.ts`, `packages/ui/src/index.ts`

**Interfaces:**
- Produces: `useContextMenu(menu: string, opts?: { params?: Record<string, unknown> }): (e: React.MouseEvent) => void`

- [ ] **Step 1: Write the failing tests**

`ContextMenuHost.browser.test.tsx` (Review Focus 2) — reuse `Setup` from Task 10's test (copy it; browser tests cannot import a jsdom test file). Set the viewport with `page.viewport(800, 600)` (from `@vitest/browser/context`), open at `{ x: 790, y: 590 }`, then assert every `[role=menu]`'s `getBoundingClientRect()` lies within `0..800 × 0..600`. Then `fireEvent`/`userEvent` `ArrowUp` to Arrange and `ArrowRight`, and assert the submenu's rect is inside the viewport too and left of its parent panel.

`useContextMenu.test.tsx`:

```tsx
import { expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider, useAction, useMenus } from '@weasel-js/routing/react';
import { ContextMenuHost } from './ContextMenuHost';
import { useContextMenu } from './useContextMenu';

const del = { id: 'delete', label: 'Delete', invoker: { timing: 'immediate' as const, run: () => {} } };
const MENUS = [{ id: 'row', sections: [[{ action: 'delete' }]] }];

function Row() {
  useAction(del);
  useMenus(MENUS);
  const onContextMenu = useContextMenu('row', { params: { nodeId: 'n1' } });
  return <div onContextMenu={onContextMenu}>row</div>;
}

it('opens the named menu at the pointer and blocks the browser menu', () => {
  render(<ActionsProvider><Row /><ContextMenuHost /></ActionsProvider>);
  const ev = fireEvent.contextMenu(screen.getByText('row'), { clientX: 20, clientY: 30 });
  expect(ev).toBe(false);
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/ContextMenu/useContextMenu.test.tsx && npm run test:browser -- packages/ui/src/components/ContextMenu`
Expected: FAIL (hook missing). The browser test should already PASS if Task 10's placement is right; if it fails, the bug is in `MenuPanel`'s layout effect.

- [ ] **Step 3: Implement**

`useContextMenu.ts`:

```ts
import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import { useMenuHost } from '@weasel-js/routing/react';

/** An `onContextMenu` handler that opens menu `menu` at the pointer, with
 *  `params` passed to every item. Selecting what was clicked stays the
 *  caller's job. */
export function useContextMenu(
  menu: string,
  opts: { params?: Record<string, unknown> } = {},
): (e: MouseEvent) => void {
  const host = useMenuHost();
  const { params } = opts;
  return useCallback((e: MouseEvent) => {
    if (!host) return;
    if (host.open({ menu, client: { x: e.clientX, y: e.clientY }, params, source: 'pointer' })) e.preventDefault();
  }, [host, menu, params]);
}
```

Export it from the folder's `index.ts` and `packages/ui/src/index.ts`.

- [ ] **Step 4: Run the tests**

Run: same as Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui
git commit -m "ui: useContextMenu for chrome; browser test for on-screen placement"
```

### Task 12: `LayerList` takes a row right-click

**Files:**
- Create: `packages/ui/src/components/LayerList/layerListProps.ts`
- Modify: `packages/ui/src/components/LayerList/LayerList.tsx`, `packages/ui/src/components/LayerList/LayerRow.tsx`, `scripts/check-size.allow.json` (lowered by `--update`)
- Test: `packages/ui/src/components/LayerList/LayerList.contextMenu.test.tsx`

**Interfaces:**
- Produces: `LayerListProps.onRowContextMenu?: (id: string, e: React.MouseEvent) => void`

- [ ] **Step 1: Split before growing**

`LayerList.tsx` is 546 lines and on the size allowlist. Move the `LayerListProps` type and its doc comments (the prop interface, roughly lines 40–110) into `layerListProps.ts`, export it from there, and import it back into `LayerList.tsx` and the folder's `index.ts`. Run `npm run check:size -- --update` and confirm the allowlist entry went down.

- [ ] **Step 2: Write the failing test**

```tsx
import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LayerList } from './LayerList';

it('reports a right-click on a row with its id', () => {
  const onRowContextMenu = vi.fn();
  render(<LayerList items={[{ id: 'n1', label: 'Rect' }]} onRowContextMenu={onRowContextMenu} />);
  fireEvent.contextMenu(screen.getByText('Rect'));
  expect(onRowContextMenu).toHaveBeenCalledWith('n1', expect.anything());
});
```

(Fill `items` with the minimum `LayerListItem` fields the existing `LayerList.render.test.tsx` uses.)

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/LayerList/LayerList.contextMenu.test.tsx`
Expected: FAIL (prop ignored).

- [ ] **Step 4: Implement**

Add to `LayerListProps`:

```ts
  /** A right-click on a row. Select the row here if it should be; the
   *  handler decides whether the browser menu is blocked. */
  onRowContextMenu?: (id: string, e: MouseEvent) => void;
```

Thread it to `LayerRow` through the row context object `LayerList` already builds (the interface holding `onKeyDown`/`onFocus`, line ~146), and in `LayerRow.tsx` put `onContextMenu={ctx.onRowContextMenu ? (e) => ctx.onRowContextMenu!(item.id, e) : undefined}` on the row element that already takes the row's pointer handlers.

- [ ] **Step 5: Run the LayerList tests and size check**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/LayerList && npm run check:size`
Expected: PASS, with `LayerList.tsx` below its old allowlist number.

- [ ] **Step 6: Commit**

```bash
git add packages/ui scripts/check-size.allow.json
git commit -m "LayerList reports row right-clicks; props split into their own module"
```

### Task 13: WeaselDraw's menus

**Files:**
- Create: `apps/draw/src/menus.ts`
- Modify: `apps/draw/src/appCommands/index.ts` (contribution gets `menus`), `apps/draw/src/main.tsx` or the component that renders the canvas (mount `<ContextMenuHost />`), `apps/draw/src/RightSidebar.tsx` (layer rows)
- Test: `apps/draw/src/menus.test.tsx`

**Interfaces:**
- Consumes: `MenuDef`, `ContextMenuHost`, `useContextMenu`, `LayerList.onRowContextMenu`.
- Produces: `DRAW_MENUS: MenuDef[]` with ids `draw.selection`, `draw.canvas`, `draw.layerRow`.

- [ ] **Step 1: Write the failing smoke test**

`apps/draw/src/menus.test.tsx` — mount draw's root the way the closest existing app-level test does (`git grep -ln "render(<Root\|render(<App" apps/draw/src`). Seed one rect, right-click it via `fireEvent.contextMenu` on the canvas at the rect's screen point (reuse that test's point helper), click the `Duplicate` menu item, and assert the scene now holds two nodes. Add a case that right-clicks empty canvas and sees `Paste` and `Select All`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=draw apps/draw/src/menus.test.tsx` (use the project `npm run check:test-projects` names for `apps/draw`)
Expected: FAIL, no menu.

- [ ] **Step 3: Implement**

`apps/draw/src/menus.ts`:

```ts
import type { MenuDef } from '@weasel-js/core';

const EDIT = [
  { action: 'clipboard.cut' }, { action: 'clipboard.copy' }, { action: 'clipboard.paste' },
  { action: 'duplicate' }, { action: 'delete' },
];
const SELECTION_SECTIONS = [
  EDIT,
  [{ action: 'group' }, { action: 'ungroup' }],
  [{ action: 'reorder.forward' }, { action: 'reorder.backward' }],
  [{ action: 'enterPathEdit' }, { action: 'enterTextEdit' }],
];

/** WeaselDraw's context menus: the selection's, the empty canvas's, and a layer row's. */
export const DRAW_MENUS: MenuDef[] = [
  { id: 'draw.selection', when: { bodyTarget: 'selected-body' }, sections: SELECTION_SECTIONS },
  { id: 'draw.canvas', when: { bodyTarget: 'empty' }, sections: [
    [{ action: 'clipboard.paste' }, { action: 'selectAll' }],
    [{ action: 'undo' }, { action: 'redo' }],
  ] },
  { id: 'draw.layerRow', sections: SELECTION_SECTIONS },
];
```

In `appCommandsContribution`, add `menus: DRAW_MENUS`. Mount `<ContextMenuHost />` once inside the `ActionsProvider` tree in draw's root component. In `RightSidebar.tsx`:

```tsx
  const openRowMenu = useContextMenu('draw.layerRow');
  // on the LayerList:
  onRowContextMenu={(id, e) => { if (!selection.contains(id)) selection.set([id]); openRowMenu(e); }}
```

(using whatever selection handle `RightSidebar` already has; skip the synthetic Background row id defined at line ~47.)

- [ ] **Step 4: Run the test**

Run: same as Step 2.
Expected: PASS.

- [ ] **Step 5: Check in the real app**

Start draw's dev server in the background (`npm run dev -w apps/draw` or the root script that serves it; see `apps/draw/package.json`), open it headless with the playwright MCP, right-click a shape, screenshot the menu, and post the screenshot with `transom post <file>` to the `weasel-context-menu` zone. Then press Escape and confirm Delete still deletes (Review Focus 5). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add apps/draw .changeset
git commit -m "WeaselDraw: selection, canvas and layer-row context menus"
```

(Draw is an app; add a changeset only if `apps/draw` is in the changeset config.)

### Task 14: Site demo (DOM)

**Files:**
- Create: `apps/site/demos/ContextMenuDemo.tsx`
- Modify: `apps/site/registry.ts`

- [ ] **Step 1: Write the demo**

A `<SceneCanvas>` with three shapes, `useMenus` declaring a selection menu (`duplicate`, `delete` ‖ `reorder.forward`, `reorder.backward`) and an empty-canvas menu (`selectAll`, `undo`, `redo`), `<ContextMenuHost />`, and a small HTML list of the shapes using `useContextMenu('demo.row', { params: … })`. Everything goes through the kit: no hand-rolled handlers on the canvas. Keep it under ~80 lines, like `GestureGrammarDemo`'s neighbors.

- [ ] **Step 2: Register it**

```ts
  {
    id: 'context-menu',
    title: 'Context menus',
    package: 'menu',
    description: "Menus declared as data: each row names a registered action, so the menu, the palette and the keyboard all run the same command. Right-click a shape and the kit selects it, then opens the menu declared for a selected shape; right-click empty canvas for the canvas menu. The list beside the canvas opens a menu from ordinary HTML with useContextMenu. Rows show each action's shortcut and gray out when the action cannot run.",
    hint: 'Right-click a shape, the canvas, or a row in the list. <kbd>Shift</kbd>+<kbd>F10</kbd> opens the menu from the keyboard.',
    load: () => import('./demos/ContextMenuDemo').then((m) => m.ContextMenuDemo),
    path: 'apps/site/demos/ContextMenuDemo.tsx',
  },
```

- [ ] **Step 3: Run the site tests and check it renders**

Run: `npx vitest run --project=site` (the project that owns `apps/site`), then load the demo headless, screenshot it with a menu open, and `transom post` it.
Expected: PASS; the menu shows.

- [ ] **Step 4: Commit**

```bash
git add apps/site
git commit -m "site: context menu demo"
```

### Task 15: Arc 2 gate

- [ ] **Step 1:** `npm run test:gate` (about two minutes). Expected: PASS.
- [ ] **Step 2:** `npm run test:fleet` on the branch tip. Its log must contain `fleet-tree: N changed path(s) match <sha>` with that gate test passed. Expected: PASS.
- [ ] **Step 3:** `npm run test:smoke:consumer` (after `npm ci` and a build in the worktree). Expected: PASS — this is what catches a missing by-name re-export of the menu types from core.

---

## Arc 3 — WebGL renderer

### Task 16: `attachMenuHost(hud)`

**Files:**
- Create: `packages/hud/src/menu/menuWidget.ts`, `packages/hud/src/menu/drawPanel.ts`, `packages/hud/src/menu/attachMenuHost.ts`
- Test: `packages/hud/src/menu/menuWidget.test.ts`, `packages/hud/src/menu/attachMenuHost.test.ts`
- Modify: `packages/hud/src/index.ts`, `packages/hud/package.json` (`@weasel-js/menu`, `@weasel-js/routing` if not already reachable through core)
- Create: `.changeset/context-menu-hud.md`

**Interfaces:**
- Consumes: `MenuHost`, `OpenMenu`; `createMenuController`, `placeMenu`, `placeSubmenu`; hud's `Widget`, `HudDrawCtx`, `textCommandFromRuns`.
- Produces:
  - `interface MenuMetrics { rowHeight: number; padX: number; padY: number; separatorHeight: number; minWidth: number; fontSize: number }` with `DEFAULT_MENU_METRICS = { rowHeight: 24, padX: 8, padY: 4, separatorHeight: 9, minWidth: 180, fontSize: 13 }`
  - `createMenuWidget(opts: { open: OpenMenu; close(): void; toCanvas(client: { x: number; y: number }): { x: number; y: number }; canvasSize(): { width: number; height: number }; measure(text: string, fontSize: number): number; metrics?: MenuMetrics; onChange(): void }): Widget`
  - `attachMenuHost(hud: Hud, host: MenuHost, opts: { toCanvas; canvasSize; measure? }): () => void`
  - `canvasMeasure(fontFamily: string): (text: string, fontSize: number) => number` — `OffscreenCanvas` 2D `measureText`, the default `measure`.

- [ ] **Step 1: Write the failing tests**

`menuWidget.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createMenuWidget } from './menuWidget';
import type { OpenMenu } from '@weasel-js/routing';

const run = vi.fn();
const open: OpenMenu = {
  seq: 1, source: 'pointer', client: { x: 100, y: 100 },
  entries: [
    { kind: 'item', key: 'cut', label: 'Cut', run },
    { kind: 'separator', key: 's' },
    { kind: 'item', key: 'del', label: 'Delete', run, disabled: true },
  ],
};
const ctx = {
  dims: { width: 800, height: 600 }, defaultFont: 'Inter',
  tokens: { '--wzl-surface-popover': '#222', '--wzl-surface-hover': '#333', '--wzl-fg': '#eee', '--wzl-fg-muted': '#888', '--wzl-border': '#444' },
  color: () => undefined,
} as never;

function widget() {
  const close = vi.fn();
  const w = createMenuWidget({
    open, close, toCanvas: (p) => p, canvasSize: () => ({ width: 800, height: 600 }),
    measure: (t) => t.length * 7, onChange: () => {},
  });
  return { w, close };
}

describe('createMenuWidget', () => {
  it('places its panel at the open point and claims every gesture', () => {
    const { w } = widget();
    expect(w.bounds).toMatchObject({ x: 100, y: 100, w: 180 });
    expect(w.claims).toEqual(['pointer', 'doubleClick', 'contextMenu', 'longPress', 'wheel']);
  });
  it('draws a panel, one row of text per item, and a separator rule', () => {
    const { w } = widget();
    const cmds = w.draw(ctx);
    expect(cmds.filter((c) => c.kind === 'text')).toHaveLength(2);
    expect(cmds.filter((c) => c.kind === 'path')).toHaveLength(2);
  });
  it('draws a highlight behind the hovered row', () => {
    const { w } = widget();
    const before = w.draw(ctx).length;
    w.onPointer({ type: 'hovermove', x: 110, y: 110, native: null });
    expect(w.draw(ctx).length).toBe(before + 1);
  });
  it('runs a pressed item through the controller', () => {
    const { w, close } = widget();
    w.onPointer({ type: 'down', x: 110, y: 110, native: null });
    w.onPointer({ type: 'up', x: 110, y: 110, native: null });
    expect(close).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });
  it('routes keys to the controller', () => {
    const { w, close } = widget();
    expect(w.onKey!({ type: 'keydown', key: 'Escape', code: 'Escape', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, native: null })).toBe(true);
    expect(close).toHaveBeenCalled();
  });
});
```

`attachMenuHost.test.ts`: create a hud with `createHud()`, a host with `createMenuHost` (sources as in Task 6's test), call `attachMenuHost`, `host.define` + `host.open`, and assert `hud.widgets()` has one menu widget that holds focus (`hud.focus` was called — check `hud.subscribeFocus`); `host.close()` removes it; a second `open` replaces it (one widget). A press outside the widget (route a `down` to another widget, or call the dismiss path the attach installs) closes the host.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project=weasel-ui packages/hud/src/menu`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`drawPanel.ts` — pure layout and drawing:

```ts
import type { DrawCommand } from '@weasel-js/core/renderer';
import { textCommandFromRuns } from '@weasel-js/core';
import type { MenuEntry } from '@weasel-js/menu';
import type { HudDrawCtx, WidgetBounds } from '../widget';

export interface MenuMetrics {
  rowHeight: number; padX: number; padY: number; separatorHeight: number; minWidth: number; fontSize: number;
}
export const DEFAULT_MENU_METRICS: MenuMetrics = {
  rowHeight: 24, padX: 8, padY: 4, separatorHeight: 9, minWidth: 180, fontSize: 13,
};

/** Each entry's y offset and height inside a panel. */
export function rowLayout(entries: readonly MenuEntry[], m: MenuMetrics): { y: number; h: number }[] {
  let y = m.padY;
  return entries.map((e) => {
    const h = e.kind === 'separator' ? m.separatorHeight : m.rowHeight;
    const row = { y, h };
    y += h;
    return row;
  });
}

export function panelSize(
  entries: readonly MenuEntry[], m: MenuMetrics, measure: (t: string, size: number) => number,
): { w: number; h: number } {
  const rows = rowLayout(entries, m);
  const last = rows.at(-1);
  const text = Math.max(0, ...entries.map((e) => (e.kind === 'separator' ? 0 : measure(e.label, m.fontSize))));
  return {
    w: Math.max(m.minWidth, Math.ceil(text) + m.padX * 2 + m.rowHeight * 2),
    h: (last ? last.y + last.h : 0) + m.padY,
  };
}

const solid = (color: string | undefined) => ({ paint: { kind: 'solid' as const, color: color ?? '#000' } });
const rect = (x: number, y: number, width: number, height: number, color: string | undefined): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width, height }, fill: solid(color),
});

export function drawPanel(
  ctx: HudDrawCtx, b: WidgetBounds, entries: readonly MenuEntry[], highlight: number | null, m: MenuMetrics,
): DrawCommand[] {
  const t = ctx.tokens;
  const out: DrawCommand[] = [rect(b.x, b.y, b.w, b.h, t['--wzl-surface-popover'])];
  const rows = rowLayout(entries, m);
  entries.forEach((e, i) => {
    const r = rows[i]!;
    if (e.kind === 'separator') {
      out.push(rect(b.x + m.padX, b.y + r.y + r.h / 2, b.w - m.padX * 2, 1, t['--wzl-border']));
      return;
    }
    if (i === highlight) out.push(rect(b.x + 2, b.y + r.y, b.w - 4, r.h, t['--wzl-surface-hover']));
    const color = e.disabled ? t['--wzl-fg-muted'] : t['--wzl-fg'];
    const label = e.kind === 'submenu' ? `${e.label}  ›` : e.label;
    out.push(textCommandFromRuns(
      b.x + m.padX + m.rowHeight, b.y + r.y,
      [{ text: label, fill: solid(color) }],
      { fontFamily: ctx.defaultFont, fontSize: m.fontSize },
      undefined, r.h, 'center',
    ));
  });
  return out;
}

/** Index of the entry under panel-local `y`, or null. */
export function rowAt(entries: readonly MenuEntry[], m: MenuMetrics, y: number): number | null {
  const rows = rowLayout(entries, m);
  const i = rows.findIndex((r) => y >= r.y && y < r.y + r.h);
  return i < 0 ? null : i;
}
```

The test counts two `path` commands with no highlight (panel + separator); match that. Item shortcuts and check marks are left out of the WebGL panel for now — say so in the changeset.

`menuWidget.ts` — a `Widget` holding a `MenuController` and one bounds rect per open level:

```ts
import { createMenuController, placeMenu, placeSubmenu, type Rect } from '@weasel-js/menu';
import type { OpenMenu } from '@weasel-js/routing';
import type { ClaimableGesture } from '@weasel-js/core';
import { createRevision, type Widget, type WidgetBounds } from '../widget';
import { DEFAULT_MENU_METRICS, drawPanel, panelSize, rowAt, rowLayout, type MenuMetrics } from './drawPanel';

type XY = { x: number; y: number };
const CLAIMS: readonly ClaimableGesture[] = ['pointer', 'doubleClick', 'contextMenu', 'longPress', 'wheel'];

export interface MenuWidgetOptions {
  open: OpenMenu;
  close(): void;
  toCanvas(client: XY): XY;
  canvasSize(): { width: number; height: number };
  measure(text: string, fontSize: number): number;
  metrics?: MenuMetrics;
  onChange(): void;
}

export function createMenuWidget(opts: MenuWidgetOptions): Widget {
  const m = opts.metrics ?? DEFAULT_MENU_METRICS;
  const rev = createRevision(opts.onChange);
  const c = createMenuController({
    entries: opts.open.entries, highlightFirst: opts.open.source === 'keyboard', onClose: opts.close,
  });
  c.subscribe(rev.changed);
  let panels: Rect[] = [];
  let disposed = false;

  const layout = () => {
    const { width, height } = opts.canvasSize();
    const bounds = { x: 0, y: 0, w: width, h: height };
    const stack = c.stack();
    panels = [];
    stack.forEach((_, level) => {
      const size = panelSize(c.entriesAt(level), m, opts.measure);
      let at: XY;
      if (level === 0) at = placeMenu(size, opts.toCanvas(opts.open.client), bounds);
      else {
        const parent = panels[level - 1]!;
        const row = rowLayout(c.entriesAt(level - 1), m)[stack[level - 1]!]!;
        at = placeSubmenu(size, { x: parent.x, y: parent.y + row.y, w: parent.w, h: row.h }, bounds);
      }
      const rect = { x: at.x, y: at.y, w: size.w, h: size.h };
      panels.push(rect);
      c.setPanel(level, rect);
    });
  };
  layout();
  c.subscribe(layout);

  const levelAt = (x: number, y: number) =>
    panels.findLastIndex((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);

  const union = (): WidgetBounds => {
    const xs = panels.flatMap((p) => [p.x, p.x + p.w]);
    const ys = panels.flatMap((p) => [p.y, p.y + p.h]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };

  return {
    id: `weasel-menu-${opts.open.seq}`,
    get bounds() { return union(); },
    hidden: false,
    get disposed() { return disposed; },
    claims: CLAIMS,
    focusable: true,
    accessibleName: 'Context menu',
    deps: rev.deps,
    draw: (ctx) => panels.flatMap((p, level) => drawPanel(ctx, p, c.entriesAt(level), c.stack()[level] ?? null, m)),
    hitTest: (x, y) => levelAt(x, y) >= 0,
    cursorAt: () => 'default',
    onPointer(evt) {
      if (evt.type === 'hoverleave') { c.hover(c.stack().length - 1, null); return; }
      if (evt.type !== 'hovermove' && evt.type !== 'up') return;
      const level = levelAt(evt.x, evt.y);
      if (level < 0) return;
      const index = rowAt(c.entriesAt(level), m, evt.y - panels[level]!.y);
      if (evt.type === 'hovermove') c.hover(level, index, { x: evt.x, y: evt.y });
      else if (index !== null) c.press(level, index);
    },
    onKey: (evt) => (evt.type === 'keydown' ? c.key(evt.key) : false),
    dispose() { disposed = true; c.dispose(); },
  };
}
```

`attachMenuHost.ts`:

```ts
import type { MenuHost } from '@weasel-js/routing';
import type { Hud } from '../hud';
import type { Widget } from '../widget';
import { createMenuWidget, type MenuWidgetOptions } from './menuWidget';

type Opts = Pick<MenuWidgetOptions, 'toCanvas' | 'canvasSize'> & Partial<Pick<MenuWidgetOptions, 'measure' | 'metrics'>>;

/** Measures with a 2D canvas in the given family. Matches the atlas font
 *  only as closely as the browser's copy of that family does. */
export function canvasMeasure(fontFamily: string): (text: string, fontSize: number) => number {
  const ctx = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1).getContext('2d') : null;
  return (text, size) => {
    if (!ctx) return text.length * size * 0.55;
    ctx.font = `${size}px ${fontFamily}`;
    return ctx.measureText(text).width;
  };
}

/** Draw `host`'s open menu as a widget on `hud`, focused while open. Returns a detach. */
export function attachMenuHost(hud: Hud, host: MenuHost, opts: Opts): () => void {
  let widget: Widget | null = null;
  const measure = opts.measure ?? canvasMeasure('Inter, sans-serif');
  const sync = () => {
    if (widget) { hud.remove(widget); widget = null; }
    const open = host.current();
    if (!open) return;
    widget = createMenuWidget({ ...opts, measure, open, close: () => host.close(), onChange: () => hud.markDirty() });
    hud.add(widget);
    hud.focus(widget);
  };
  const unsubscribe = host.subscribe(sync);
  const unfocus = hud.subscribeFocus((f) => { if (widget && f !== widget) host.close(); });
  sync();
  return () => { unsubscribe(); unfocus(); if (widget) hud.remove(widget); };
}
```

(A press elsewhere moves hud focus or clears it, and `subscribeFocus` turns that into a close. Confirm `hud.focus(null)` is what a press on the scene does by reading `hud.ts`; if not, close from a `down` routed to any other widget instead.)

Exports in `packages/hud/src/index.ts`:

```ts
export { attachMenuHost, canvasMeasure } from './menu/attachMenuHost';
export { createMenuWidget } from './menu/menuWidget';
export { DEFAULT_MENU_METRICS, type MenuMetrics } from './menu/drawPanel';
```

`.changeset/context-menu-hud.md`:

```md
---
'@weasel-js/hud': patch
---

`attachMenuHost(hud, host, …)` draws the open context menu as a HUD widget, from the same model the DOM menu uses: keyboard, typeahead, submenus and on-canvas placement. It does not yet draw shortcut chips or check marks, and screen readers get only its name.
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=weasel-ui packages/hud && npm run check:imports && npm run typecheck && npm run check:size`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/hud .changeset
git commit -m "hud: attachMenuHost draws the open menu in WebGL"
```

### Task 17: HUD demo and visual baseline

**Files:**
- Create: `apps/site/demos/HudContextMenuDemo.tsx`, a visual spec beside the existing HUD ones (`git grep -ln "hud" tests/visual`)
- Modify: `apps/site/registry.ts`

- [ ] **Step 1: Write the demo** — the Task 14 demo's canvas and menus, with `createHudContribution` + `attachMenuHost` instead of `<ContextMenuHost>`. Register it with `package: 'hud'` and a description saying the menu is drawn into the canvas by the same model as the DOM one.
- [ ] **Step 2: Add a visual baseline** per theme mode with the menu open and a row highlighted, following the existing HUD visual spec's setup. Generate baselines the way that spec's header says.
- [ ] **Step 3: Run the visual spec and site tests.** Expected: PASS. Screenshot the open menu and `transom post` it.
- [ ] **Step 4: Commit** — `git commit -m "site: HUD context menu demo and visual baseline"`.

### Task 18: Finish

- [ ] **Step 1:** Retire the `(P2) Context menus.` entry in `docs/TODO.md`. Keep the two P4 entries.
- [ ] **Step 2:** Move anything in the spec worth keeping past the merge (the layer table, the "no React Aria Menu" reason) into `packages/menu/README.md` under a "How it fits" heading, then delete the spec and this plan.
- [ ] **Step 3:** `npm run test:gate`, then `npm run test:fleet` on the tip; both PASS with the `fleet-tree` line present.
- [ ] **Step 4:** Commit: `git commit -m "retire the context-menu plan and spec; README carries the design"`.
