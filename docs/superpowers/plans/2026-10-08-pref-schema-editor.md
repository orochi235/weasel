# Pref Schema Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev tool that edits preference schemas (structure and per-leaf attributes) with a live `PrefsForm` preview and exports a pasteable TS literal plus a change list — built as a `@weasel-js/ui` component, hosted on WeaselDraw's `#/dev/prefs`, with drag-to-reorder added to `Tree` along the way.

**Architecture:** Pure modules do the work — a drop resolver shared by `useReorderDragList` and `Tree`, schema edits keyed by dotted paths, an exporter, and per-kind attribute schemas that are themselves `ToolPrefGroup`s edited with `PrefsForm`. React components only wire them together. Draw's private pref types are folded onto core's first, so every source is a plain `ToolPrefGroup`.

**Tech Stack:** React 19, TypeScript, CSS modules, React Aria (via `@weasel-js/ui` wrappers), vitest (`weasel-ui` jsdom project, `browser` project for `*.browser.test.tsx`), changesets.

**Spec:** `docs/superpowers/specs/2026-10-08-pref-schema-editor-design.md`

## Global Constraints

- Work happens in the worktree `/Users/mike/src/weasel-pref-schema-editor` on branch `pref-schema-editor`. Run `npm ci` there before the first build or test.
- `ui` tests run under the root config: `npx vitest run --project=weasel-ui <path>`. Running vitest from inside a package finds zero files and looks like a pass.
- Browser tests: `npx vitest run --project=browser <path>`.
- Typecheck is `npm run typecheck` (both programs), lint is `npm run lint`.
- Every changeset is `patch`. Never write a `bump-approved` marker.
- No inline `style=` except a value only known at runtime; no `!important`.
- No source file grows past a few hundred lines — new behavior goes in its own module.
- A comment states only what the code cannot: 1–2 lines.
- US English in code, comments and copy.
- The full suite is not run locally; while iterating run only the files covering the diff.

## Review Focus

- **Dotted keys.** Pref paths are dotted; a key containing `.` would corrupt every path. `addNode`/`renameKey` must refuse a key that is not an identifier (`/^[A-Za-z_$][\w$]*$/`) — Task 6 pins it.
- **Drag a node into its own subtree.** Must be refused even when the consumer's `canDrop` allows everything — Task 3 pins it.
- **Moving a node next to a sibling with the same key.** Moving `a.x` into `b`, which already has `x`, must not overwrite `b.x`; the moved node is renamed `x2` — Task 6 pins it.
- **Function-valued attributes survive an edit of a different attribute.** Editing `name` on a leaf with `encoding` must keep `encoding` as the same function object, and export must print it as `KEEP_FROM_SOURCE` — Task 7 pins it.
- **A drop in the gap between rows.** Rows separated by a margin must resolve the same as the old flat-list rule (above the next row) — Task 2 pins it.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/draw/src/prefs.ts` (modify) | Draw's pref types become aliases of core's; `object` → custom `data` kind |
| `apps/draw/src/PreferencesModal.tsx` (modify) | Renderer key `data`; export the two custom renderers for reuse |
| `packages/ui/src/dropTarget.ts` (create) | Pure: pointer + visible rows → `TreeDropTarget` and a mark |
| `packages/ui/src/useReorderDragList.ts` (modify) | Resolves its index through `dropTarget.ts`; exports `swallowNextClick` internally |
| `packages/ui/src/components/Tree/treeMoves.ts` (create) | Pure: dragged-id set, self-guard, no-op check, keyboard move targets |
| `packages/ui/src/components/Tree/useTreeDrag.ts` (create) | Pointer drag session for `Tree` |
| `packages/ui/src/components/Tree/Tree.tsx` (modify) | `onMove`/`canDrop` props, wiring, keyboard moves, marks |
| `packages/ui/src/components/Tree/Tree.module.css` (modify) | Drop marks, dragging rows |
| `packages/ui/src/components/PrefSchemaEditor/schemaEdit.ts` (create) | Pure path-keyed edits on a `ToolPrefGroup` |
| `packages/ui/src/components/PrefSchemaEditor/schemaExport.ts` (create) | Pure: literal printer, schema diff, change formatting |
| `packages/ui/src/components/PrefSchemaEditor/kindSchemas.ts` (create) | Attribute schemas per kind, blank leaves, kind change |
| `packages/ui/src/components/PrefSchemaEditor/attrRenderers.tsx` (create) | `optional-number`, `string-list`, `enum-options` controls |
| `packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.tsx` (create) | The three-pane component |
| `packages/ui/src/components/PrefSchemaEditor/StructurePane.tsx` (create) | Tree + toolbar |
| `packages/ui/src/components/PrefSchemaEditor/AttributesPane.tsx` (create) | Key, kind, attribute form, read-only code rows |
| `packages/ui/src/components/PrefSchemaEditor/ExportPanel.tsx` (create) | Literal / Changes tabs with Copy |
| `packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.module.css` (create) | Layout |
| `apps/draw/src/dev/PrefSchemaPage.tsx` (create) | Source picker + editor, `#/dev/prefs` |
| `apps/draw/src/main.tsx`, `apps/draw/src/dev/DevShell.tsx`, `apps/draw/src/CommandBar.tsx` (modify) | Route and switcher entries |

---

### Task 1: Finish the `WeaselDrawPref` port

**Files:**
- Modify: `apps/draw/src/prefs.ts:15-110` (type block), `:155` (`kind: 'object'` → `'data'`), `:247-282` (path types)
- Modify: `apps/draw/src/PreferencesModal.tsx`
- Test: `apps/draw/src/prefs.test.ts`, `apps/draw/src/PreferencesModal.test.tsx`

**Interfaces:**
- Produces: `WeaselDrawPrefGroup = ToolPrefGroup`; `WeaselDrawPrefRegistryEnum extends ToolPrefBase<'registry-enum', string>`; `WeaselDrawPrefData<T> = ToolPrefBase<'data', T>`; exported `RegistryEnumControl`, `DataControl` from `PreferencesModal.tsx` (Task 11 reuses them).

- [ ] **Step 1: Write the failing test** — append to `apps/draw/src/prefs.test.ts`:

```ts
import type { ToolPrefGroup } from '@weasel-js/core';

describe('PREFS is a core ToolPrefGroup', () => {
  it('assigns to ToolPrefGroup without a cast', () => {
    const asCore: ToolPrefGroup = PREFS;
    expect(asCore.children.ui).toBeDefined();
  });

  it('stores the panel map under the custom data kind', () => {
    expect(PREFS.children.ui.children.panels.kind).toBe('data');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=draw apps/draw/src/prefs.test.ts` (if `draw` is not the project name, `npm run check:test-projects` prints the owner).
Expected: FAIL — `kind` is `'object'`.

- [ ] **Step 3: Replace the type block** — in `apps/draw/src/prefs.ts`, delete everything from `export type WeaselDrawPrefKind` through the `WeaselDrawPrefGroup` interface and write:

```ts
import type {
  ToolPrefBase,
  ToolPrefBoolean,
  ToolPrefEnum,
  ToolPrefEnumControl,
  ToolPrefGroup,
  ToolPrefKind,
  ToolPrefLeaf,
  ToolPrefNumber,
  ToolPrefString,
} from '@weasel-js/core';

export type WeaselDrawPrefKind = ToolPrefKind | 'registry-enum' | 'data';

export type WeaselDrawPrefNumber = ToolPrefNumber;
export type WeaselDrawPrefBoolean = ToolPrefBoolean;
export type WeaselDrawPrefString = ToolPrefString;
export type WeaselDrawPrefEnum<T extends string = string> = ToolPrefEnum<T>;

/** Enum whose options come from a runtime registry — `tools.lastTool` picks
 *  from whichever tools the app registered. `source` keys into the modal's
 *  `registryEnumSources`; the value is a string at rest. */
export interface WeaselDrawPrefRegistryEnum extends ToolPrefBase<'registry-enum', string> {
  source: string;
  control?: ToolPrefEnumControl;
  filter?: RegistryEnumFilter;
}

/** A value other code owns and the form only displays or hands to a bespoke
 *  editor (`ui.panels`). Unlike core's `object`, it has no `children`. */
export type WeaselDrawPrefData<T = unknown> = ToolPrefBase<'data', T>;

export type WeaselDrawPref = ToolPrefLeaf;
export type WeaselDrawPrefGroup = ToolPrefGroup;
```

Keep the existing `import type { RegistryEnumFilter } from './registry/types';` and `import type { ToolPrefGroup } from '@weasel-js/core';` lines merged into the import above. Remove `WeaselDrawPrefObject` and every `WeaselDrawPrefNumberControl`/`…BooleanControl`/`…StringControl`/`…EnumControl` alias; grep the app for them first (`grep -rn "WeaselDrawPref" apps/draw/src`) and repoint any user to core's names.

- [ ] **Step 4: Update the registry and value mapping** — in `PREFS`, change `panels` to `kind: 'data'`. In `PrefValue`:

```ts
type PrefValue<P> =
  P extends WeaselDrawPrefBoolean ? boolean :
  P extends WeaselDrawPrefNumber  ? number  :
  P extends WeaselDrawPrefString  ? string  :
  P extends WeaselDrawPrefEnum<infer T>   ? T :
  P extends WeaselDrawPrefRegistryEnum    ? string :
  P extends WeaselDrawPrefData<infer T>   ? T :
  never;
```

`composeToolPrefs` keeps its body; drop the doc sentence claiming `ToolPrefGroup` is structurally a `WeaselDrawPrefGroup` — they are now the same type. `descriptorAt` keeps working: `'kind' in cur` still discriminates.

- [ ] **Step 5: Update `PreferencesModal.tsx`** — change the renderer map key `object: ObjectControl` to `data: DataControl`, rename `ObjectControl` to `DataControl`, export it and `RegistryEnumControl`, and drop the `schema={PREFS as WeaselDrawPrefGroup}` cast to `schema={PREFS}`. Replace `WeaselDrawPrefObject` in `PanelsEditor` with `WeaselDrawPrefData`. Update the file's doc comment: "the app's two custom kinds (`registry-enum`, `data`)".

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run --project=draw apps/draw/src/prefs.test.ts apps/draw/src/PreferencesModal.test.tsx && npm run typecheck`
Expected: PASS, no type errors. `WeaselDrawPrefPath` must still list `ui.panels` — `prefs.test.ts`'s existing path tests cover it.

- [ ] **Step 7: Commit**

```bash
git add apps/draw/src/prefs.ts apps/draw/src/prefs.test.ts apps/draw/src/PreferencesModal.tsx
git commit -m "fold WeaselDraw's pref types onto core's ToolPref family"
```

---

### Task 2: Shared drop resolver

**Files:**
- Create: `packages/ui/src/dropTarget.ts`
- Create: `packages/ui/src/dropTarget.test.ts`
- Modify: `packages/ui/src/useReorderDragList.ts` (`computeTargetIndex`, export `swallowNextClick`)

**Interfaces:**
- Produces:
  ```ts
  export interface TreeDropTarget { parentId: string | null; index: number }
  export interface DropRow { id: string; parentId: string | null; level: number; index: number;
    branch: boolean; expanded: boolean; childCount: number; top: number; height: number }
  export interface DropMark { id: string; where: 'before' | 'after' | 'into' }
  export interface ResolvedDrop { target: TreeDropTarget; mark: DropMark | null }
  export interface DropIndent { originX: number; indent: number }
  export function resolveDrop(rows: readonly DropRow[], p: { x: number; y: number }, indent?: DropIndent): ResolvedDrop
  export function swallowNextClick(container: HTMLElement): void   // from useReorderDragList.ts, not re-exported by the package
  ```

- [ ] **Step 1: Write the failing tests** — `packages/ui/src/dropTarget.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveDrop, type DropRow } from './dropTarget';

const H = 20;
/** Rows in display order; `top` follows from position. */
function rows(spec: Array<Omit<DropRow, 'top' | 'height'>>): DropRow[] {
  return spec.map((r, i) => ({ ...r, top: i * H, height: H }));
}
const leaf = (id: string, index: number, parentId: string | null = null, level = 1) =>
  ({ id, parentId, level, index, branch: false, expanded: false, childCount: 0 });

describe('resolveDrop — flat list', () => {
  const flat = rows([leaf('a', 0), leaf('b', 1), leaf('c', 2)]);

  it('drops before a row from its upper half and after it from its lower half', () => {
    expect(resolveDrop(flat, { x: 0, y: 25 }).target).toEqual({ parentId: null, index: 1 });
    expect(resolveDrop(flat, { x: 0, y: 35 }).target).toEqual({ parentId: null, index: 2 });
  });

  it('drops at the end below every row, and at 0 above them', () => {
    expect(resolveDrop(flat, { x: 0, y: 999 }).target).toEqual({ parentId: null, index: 3 });
    expect(resolveDrop(flat, { x: 0, y: -5 }).target).toEqual({ parentId: null, index: 0 });
  });

  it('treats a gap between rows as above the next row', () => {
    const gapped = flat.map((r, i) => ({ ...r, top: i * (H + 10) }));
    expect(resolveDrop(gapped, { x: 0, y: 25 }).target).toEqual({ parentId: null, index: 1 });
  });

  it('treats the exact midpoint as after, as the flat list always did', () => {
    expect(resolveDrop(flat, { x: 0, y: 30 }).target).toEqual({ parentId: null, index: 2 });
  });
});

describe('resolveDrop — tree', () => {
  // g (expanded) > [x, y]; then z
  const tree = rows([
    { id: 'g', parentId: null, level: 1, index: 0, branch: true, expanded: true, childCount: 2 },
    leaf('x', 0, 'g', 2),
    leaf('y', 1, 'g', 2),
    leaf('z', 1),
  ]);
  const indent = { originX: 0, indent: 16 };

  it('drops into a branch from the middle half of its row', () => {
    expect(resolveDrop(tree, { x: 0, y: 10 }, indent)).toEqual({
      target: { parentId: 'g', index: 2 },
      mark: { id: 'g', where: 'into' },
    });
  });

  it('drops before a branch from its top quarter', () => {
    expect(resolveDrop(tree, { x: 0, y: 2 }, indent).target).toEqual({ parentId: null, index: 0 });
  });

  it('puts the bottom quarter of an expanded branch before its first child', () => {
    expect(resolveDrop(tree, { x: 0, y: 18 }, indent)).toEqual({
      target: { parentId: 'g', index: 0 },
      mark: { id: 'x', where: 'before' },
    });
  });

  it('reads the level from x below the last row of a subtree', () => {
    // lower half of y: deep x stays inside g, shallow x goes after g
    expect(resolveDrop(tree, { x: 40, y: 55 }, indent).target).toEqual({ parentId: 'g', index: 2 });
    expect(resolveDrop(tree, { x: 2, y: 55 }, indent)).toEqual({
      target: { parentId: null, index: 1 },
      mark: { id: 'g', where: 'after' },
    });
  });

  it('drops into a collapsed branch at the end of its children', () => {
    const collapsed = rows([
      { id: 'g', parentId: null, level: 1, index: 0, branch: true, expanded: false, childCount: 3 },
    ]);
    expect(resolveDrop(collapsed, { x: 0, y: 10 }).target).toEqual({ parentId: 'g', index: 3 });
  });

  it('returns the top-level start with no mark for an empty tree', () => {
    expect(resolveDrop([], { x: 0, y: 0 })).toEqual({ target: { parentId: null, index: 0 }, mark: null });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/dropTarget.test.ts`
Expected: FAIL — cannot resolve `./dropTarget`.

- [ ] **Step 3: Implement** — `packages/ui/src/dropTarget.ts`:

```ts
/** Where a drop lands: among `parentId`'s children (`null` is the top level), at `index` counted before the drag
 *  removes anything. */
export interface TreeDropTarget {
  parentId: string | null;
  index: number;
}

/** One visible row, in display order, as {@link resolveDrop} reads it. */
export interface DropRow {
  id: string;
  parentId: string | null;
  /** 1 at the top level. */
  level: number;
  /** Position among its parent's children. */
  index: number;
  /** Can hold children, so a drop into it is possible. */
  branch: boolean;
  /** Its children are the rows that follow it. */
  expanded: boolean;
  childCount: number;
  top: number;
  height: number;
}

/** Which row draws the drop indicator, and where on it. */
export interface DropMark {
  id: string;
  where: 'before' | 'after' | 'into';
}

export interface ResolvedDrop {
  target: TreeDropTarget;
  mark: DropMark | null;
}

/** Client x of level 1, and the width of one level, for reading depth off the pointer. */
export interface DropIndent {
  originX: number;
  indent: number;
}

/**
 * Where a pointer over `rows` would drop. A leaf splits at its midpoint; a branch keeps its middle half for a drop
 * into it. Below the last row of a subtree, `indent` lets the pointer's x choose how many levels to climb out;
 * without it the drop stays at the row's own level, which is all a flat list needs.
 */
export function resolveDrop(
  rows: readonly DropRow[],
  p: { x: number; y: number },
  indent?: DropIndent,
): ResolvedDrop {
  if (rows.length === 0) return { target: { parentId: null, index: 0 }, mark: null };
  const i = rows.findIndex((r) => p.y < r.top + r.height);
  if (i === -1) return gapAfter(rows, rows.length - 1, p.x, indent);
  const r = rows[i]!;
  if (p.y < r.top) return before(r);
  const frac = (p.y - r.top) / r.height;
  if (r.branch) {
    if (frac < 0.25) return before(r);
    if (frac >= 0.75) return gapAfter(rows, i, p.x, indent);
    return { target: { parentId: r.id, index: r.childCount }, mark: { id: r.id, where: 'into' } };
  }
  return frac < 0.5 ? before(r) : gapAfter(rows, i, p.x, indent);
}

function before(r: DropRow): ResolvedDrop {
  return { target: { parentId: r.parentId, index: r.index }, mark: { id: r.id, where: 'before' } };
}

function gapAfter(rows: readonly DropRow[], i: number, x: number, indent: DropIndent | undefined): ResolvedDrop {
  const r = rows[i]!;
  const next = rows[i + 1];
  if (r.expanded && r.childCount > 0 && next) return before(next);
  const floor = next ? next.level : 1;
  let level = r.level;
  if (indent && floor < r.level) {
    const want = Math.floor((x - indent.originX) / indent.indent) + 1;
    level = Math.max(floor, Math.min(r.level, want));
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  let at = r;
  while (at.level > level && at.parentId !== null) {
    const up = byId.get(at.parentId);
    if (!up) break;
    at = up;
  }
  return { target: { parentId: at.parentId, index: at.index + 1 }, mark: { id: at.id, where: 'after' } };
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/dropTarget.test.ts`
Expected: PASS.

- [ ] **Step 5: Route `useReorderDragList` through it** — in `packages/ui/src/useReorderDragList.ts`, add `import { resolveDrop, type DropRow } from './dropTarget';` and replace the body of `computeTargetIndex` after the `rows` line:

```ts
    const flat: DropRow[] = rows.map((row, i) => {
      const r = row.getBoundingClientRect();
      return { id: String(i), parentId: null, level: 1, index: i, branch: false, expanded: false, childCount: 0, top: r.top, height: r.height };
    });
    const raw = resolveDrop(flat, { x: 0, y: clientY }).target.index;
    return Math.max(lo, Math.min(raw, hi));
```

Change `function swallowNextClick` to `export function swallowNextClick`. Do not add it to `packages/ui/src/index.ts`.

- [ ] **Step 6: Run the existing reorder tests unmodified**

Run: `npx vitest run --project=weasel-ui packages/ui/src/useReorderDragList.test.tsx packages/ui/src/components/ItemList packages/ui/src/components/LayerList packages/ui/src/components/DataGrid`
Expected: PASS with no test file edited.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/dropTarget.ts packages/ui/src/dropTarget.test.ts packages/ui/src/useReorderDragList.ts
git commit -m "resolve list drops through a tree-shaped drop model"
```

---

### Task 3: Tree drag (pointer)

**Files:**
- Create: `packages/ui/src/components/Tree/treeMoves.ts`, `packages/ui/src/components/Tree/treeMoves.test.ts`
- Create: `packages/ui/src/components/Tree/useTreeDrag.ts`
- Create: `packages/ui/src/components/Tree/Tree.drag.test.tsx`
- Modify: `packages/ui/src/components/Tree/Tree.tsx`, `Tree.module.css`, `index.ts`
- Modify: `packages/ui/src/index.ts` (export `TreeDropTarget` type)

**Interfaces:**
- Consumes: `resolveDrop`, `DropRow`, `DropMark`, `TreeDropTarget` (Task 2); `swallowNextClick`, `ReorderGhost`, `PressModifiers` from `useReorderDragList.ts`.
- Produces on `TreeProps`:
  ```ts
  onMove?(ids: string[], target: TreeDropTarget): void;
  canDrop?(ids: readonly string[], target: TreeDropTarget): boolean;
  ```
  and from `treeMoves.ts`: `parentsOf`, `draggedIdsFor`, `landsInside`, `isNoopMove`, `keyboardTarget` (signatures below; Task 4 uses `keyboardTarget`).

- [ ] **Step 1: Write failing tests for the pure moves** — `treeMoves.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { TreeNode } from './Tree';
import { draggedIdsFor, isNoopMove, keyboardTarget, landsInside, parentsOf } from './treeMoves';

const T: TreeNode[] = [
  { id: 'g', label: 'g', children: [
    { id: 'x', label: 'x' },
    { id: 'h', label: 'h', children: [{ id: 'y', label: 'y' }] },
  ] },
  { id: 'z', label: 'z' },
  { id: 'w', label: 'w' },
];

describe('treeMoves', () => {
  it('maps each id to its parent', () => {
    expect(parentsOf(T).get('y')).toBe('h');
    expect(parentsOf(T).get('g')).toBeNull();
  });

  it('drags the selection in tree order, without nodes whose ancestor is also selected', () => {
    expect(draggedIdsFor(T, new Set(['z', 'y', 'g']), 'z')).toEqual(['g', 'z']);
    expect(draggedIdsFor(T, new Set(['z']), 'x')).toEqual(['x']);
  });

  it('refuses a target inside a dragged node', () => {
    expect(landsInside(T, ['g'], { parentId: 'h', index: 0 })).toBe(true);
    expect(landsInside(T, ['g'], { parentId: 'g', index: 0 })).toBe(true);
    expect(landsInside(T, ['x'], { parentId: 'h', index: 0 })).toBe(false);
  });

  it('calls a drop that leaves a contiguous run in place a no-op', () => {
    expect(isNoopMove(T, ['z', 'w'], { parentId: null, index: 1 })).toBe(true);
    expect(isNoopMove(T, ['z', 'w'], { parentId: null, index: 3 })).toBe(true);
    expect(isNoopMove(T, ['z'], { parentId: null, index: 0 })).toBe(false);
  });

  it('computes keyboard targets', () => {
    expect(keyboardTarget(T, ['z'], 'up')).toEqual({ parentId: null, index: 0 });
    expect(keyboardTarget(T, ['z'], 'down')).toEqual({ parentId: null, index: 3 });
    expect(keyboardTarget(T, ['w'], 'down')).toBeNull();
    expect(keyboardTarget(T, ['y'], 'out')).toEqual({ parentId: 'g', index: 2 });
    expect(keyboardTarget(T, ['g'], 'out')).toBeNull();
    expect(keyboardTarget(T, ['z'], 'in')).toEqual({ parentId: 'g', index: 2 });
    expect(keyboardTarget(T, ['w'], 'in')).toBeNull(); // z is a leaf
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Tree/treeMoves.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `treeMoves.ts`**

```ts
import type { TreeDropTarget } from '../../dropTarget';
import type { TreeNode } from './Tree';

/** Each node's parent id; `null` at the top level. */
export function parentsOf(nodes: readonly TreeNode[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const walk = (list: readonly TreeNode[], parent: string | null) => {
    for (const n of list) {
      out.set(n.id, parent);
      if (n.children) walk(n.children, n.id);
    }
  };
  walk(nodes, null);
  return out;
}

function siblingsOf(nodes: readonly TreeNode[], parentId: string | null): readonly TreeNode[] {
  if (parentId === null) return nodes;
  const find = (list: readonly TreeNode[]): readonly TreeNode[] | undefined => {
    for (const n of list) {
      if (n.id === parentId) return n.children ?? [];
      const hit = n.children && find(n.children);
      if (hit) return hit;
    }
    return undefined;
  };
  return find(nodes) ?? [];
}

function treeOrder(nodes: readonly TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly TreeNode[]) => { for (const n of list) { out.push(n.id); if (n.children) walk(n.children); } };
  walk(nodes);
  return out;
}

function hasAncestorIn(parents: Map<string, string | null>, id: string, set: ReadonlySet<string>): boolean {
  for (let p = parents.get(id) ?? null; p !== null; p = parents.get(p) ?? null) if (set.has(p)) return true;
  return false;
}

/** What a drag from `id` carries: the selection in tree order if `id` is in it, else `id` alone. A node travels
 *  with a selected ancestor rather than on its own. */
export function draggedIdsFor(nodes: readonly TreeNode[], selected: ReadonlySet<string>, id: string): string[] {
  if (!selected.has(id)) return [id];
  const parents = parentsOf(nodes);
  return treeOrder(nodes).filter((x) => selected.has(x) && !hasAncestorIn(parents, x, selected));
}

/** Whether `target` is one of `ids` or sits beneath one. */
export function landsInside(nodes: readonly TreeNode[], ids: readonly string[], target: TreeDropTarget): boolean {
  if (target.parentId === null) return false;
  const set = new Set(ids);
  return set.has(target.parentId) || hasAncestorIn(parentsOf(nodes), target.parentId, set);
}

/** Whether dropping `ids` at `target` leaves them where they are. */
export function isNoopMove(nodes: readonly TreeNode[], ids: readonly string[], target: TreeDropTarget): boolean {
  const parents = parentsOf(nodes);
  if (!ids.every((id) => (parents.get(id) ?? null) === target.parentId)) return false;
  const sibs = siblingsOf(nodes, target.parentId).map((n) => n.id);
  const at = ids.map((id) => sibs.indexOf(id)).sort((a, b) => a - b);
  const contiguous = at.every((v, i) => i === 0 || v === at[i - 1]! + 1);
  return contiguous && target.index >= at[0]! && target.index <= at[at.length - 1]! + 1;
}

export type KeyboardMove = 'up' | 'down' | 'out' | 'in';

/** Where a keyboard move sends `ids`, which share a parent; `null` when it cannot go that way. */
export function keyboardTarget(
  nodes: readonly TreeNode[],
  ids: readonly string[],
  move: KeyboardMove,
): TreeDropTarget | null {
  const parents = parentsOf(nodes);
  const parentId = parents.get(ids[0]!) ?? null;
  const sibs = siblingsOf(nodes, parentId);
  const at = ids.map((id) => sibs.findIndex((n) => n.id === id)).sort((a, b) => a - b);
  const first = at[0]!;
  const last = at[at.length - 1]!;
  switch (move) {
    case 'up': return first > 0 ? { parentId, index: first - 1 } : null;
    case 'down': return last < sibs.length - 1 ? { parentId, index: last + 2 } : null;
    case 'out': {
      if (parentId === null) return null;
      const grand = parents.get(parentId) ?? null;
      return { parentId: grand, index: siblingsOf(nodes, grand).findIndex((n) => n.id === parentId) + 1 };
    }
    case 'in': {
      const prev = sibs[first - 1];
      return prev?.children ? { parentId: prev.id, index: prev.children.length } : null;
    }
  }
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Tree/treeMoves.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing drag tests** — `Tree.drag.test.tsx`. jsdom has no layout, so rows get stamped geometry: 24px tall, indented 16px per level, in visible order.

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tree, type TreeNode } from './Tree';

afterEach(cleanup);

const NODES: TreeNode[] = [
  { id: 'g', label: 'Group', children: [{ id: 'x', label: 'Ex' }, { id: 'y', label: 'Why' }] },
  { id: 'z', label: 'Zed' },
];
const ROW = 24;

/** Stamp each visible row's box, in document order, as real layout would. */
function stamp(tree: HTMLElement) {
  const items = Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'));
  items.forEach((li, i) => {
    const level = Number(li.getAttribute('aria-level'));
    const row = li.firstElementChild as HTMLElement;
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: i * ROW, height: ROW, left: (level - 1) * 16, width: 200, bottom: (i + 1) * ROW, right: 200, x: 0, y: i * ROW } as DOMRect),
    });
  });
}

function setup(props: Partial<Parameters<typeof Tree>[0]> = {}) {
  const onMove = vi.fn();
  render(<Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g']} selectionMode="single" onMove={onMove} {...props} />);
  const tree = screen.getByRole('tree');
  tree.setPointerCapture = vi.fn();
  tree.releasePointerCapture = vi.fn();
  stamp(tree);
  const row = (name: string) => screen.getByRole('treeitem', { name }).firstElementChild as HTMLElement;
  return { onMove, tree, row };
}

const press = (el: HTMLElement, y: number, x = 100) =>
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: x, clientY: y });
const move = (y: number, x = 100) => fireEvent.pointerMove(document, { pointerId: 1, clientX: x, clientY: y });
const release = (y: number, x = 100) => fireEvent.pointerUp(document, { pointerId: 1, clientX: x, clientY: y });

describe('Tree — drag to reorder', () => {
  it('is off without onMove: no drag starts', () => {
    const { row } = setup({ onMove: undefined });
    press(row('Zed'), 80);
    move(10);
    release(10);
    expect(screen.getByRole('treeitem', { name: 'Zed' })).not.toHaveAttribute('data-dragging');
  });

  it('moves a node before another across parents', () => {
    const { onMove, row } = setup();
    press(row('Zed'), 80);   // z is the 4th visible row: 72–96
    move(30);                // upper half of Ex (24–48)
    release(30);
    expect(onMove).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 });
  });

  it('marks the target row while dragging and clears it on drop', () => {
    const { row } = setup();
    press(row('Zed'), 80);
    move(30);
    expect(screen.getByRole('treeitem', { name: 'Ex' })).toHaveAttribute('data-drop', 'before');
    expect(screen.getByRole('treeitem', { name: 'Zed' })).toHaveAttribute('data-dragging', 'true');
    release(30);
    expect(screen.getByRole('treeitem', { name: 'Ex' })).not.toHaveAttribute('data-drop');
  });

  it('refuses a drop into the dragged node itself even when canDrop allows everything', () => {
    const { onMove, row } = setup({ canDrop: () => true });
    press(row('Group'), 10);
    move(40);                // onto Ex, a child of g
    release(40);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('asks canDrop and draws no mark for a refused target', () => {
    const canDrop = vi.fn(() => false);
    const { onMove, row } = setup({ canDrop });
    press(row('Zed'), 80);
    move(30);
    expect(canDrop).toHaveBeenCalledWith(['z'], { parentId: 'g', index: 0 });
    expect(screen.getByRole('treeitem', { name: 'Ex' })).not.toHaveAttribute('data-drop');
    release(30);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('still selects on a press that never drags', () => {
    const onSelectionChange = vi.fn();
    const { row } = setup({ onSelectionChange });
    press(row('Zed'), 80);
    release(80);
    fireEvent.click(row('Zed'));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect([...onSelectionChange.mock.calls[0]![0]]).toEqual(['z']);
  });

  it('opens a collapsed branch held over for 600ms', () => {
    vi.useFakeTimers();
    const onExpandedChange = vi.fn();
    const { row } = setup({ defaultExpandedIds: [], onExpandedChange });
    // collapsed: rows are Group (0–24), Zed (24–48)
    press(row('Zed'), 40);
    move(12);
    vi.advanceTimersByTime(600);
    expect([...onExpandedChange.mock.calls.at(-1)![0]]).toEqual(['g']);
    vi.useRealTimers();
  });
});
```

Note on the "still selects" test: `fireEvent.click` stands in for the click the browser synthesizes; the drag session swallows it at the container, so selection must have come from the press. It is a proxy for the real event order, which Task 5's browser test exercises.

- [ ] **Step 6: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Tree/Tree.drag.test.tsx`
Expected: FAIL — `onMove` is not a prop, no `data-drop`.

- [ ] **Step 7: Implement `useTreeDrag.ts`**

```ts
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { isInControlWithin, startThresholdDrag, useLatest, type ThresholdDragHandle } from '@weasel-js/core';
import { resolveDrop, type DropMark, type DropRow, type ResolvedDrop, type TreeDropTarget } from '../../dropTarget';
import { swallowNextClick, type PressModifiers, type ReorderGhost } from '../../useReorderDragList';
import { draggedIdsFor, isNoopMove, landsInside } from './treeMoves';
import type { TreeNode } from './Tree';

const HOVER_EXPAND_MS = 600;

/** A visible row as `Tree` walks it. */
export interface TreeDragRow {
  node: TreeNode;
  parentId: string | null;
  level: number;
  index: number;
}

export interface UseTreeDragOptions {
  enabled: boolean;
  nodes: readonly TreeNode[];
  visible: readonly TreeDragRow[];
  expanded: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  container(): HTMLElement | null;
  rowEl(id: string): HTMLElement | undefined;
  canDrop?(ids: readonly string[], target: TreeDropTarget): boolean;
  onMove?(ids: string[], target: TreeDropTarget): void;
  /** A press released without dragging — the row's activation. */
  onPress(id: string, mods: PressModifiers): void;
  expand(id: string): void;
}

export interface TreeDragState {
  dragging: readonly string[] | null;
  mark: DropMark | null;
  ghost: ReorderGhost | null;
}

const IDLE: TreeDragState = { dragging: null, mark: null, ghost: null };

/** Pointer drag-to-reorder for `Tree`. Inert unless `enabled`. */
export function useTreeDrag(opts: UseTreeDragOptions) {
  const o = useLatest(opts);
  const drag = useRef<ThresholdDragHandle | null>(null);
  const hover = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [state, setState] = useState<TreeDragState>(IDLE);

  const clearHover = () => {
    if (hover.current) clearTimeout(hover.current.timer);
    hover.current = null;
  };
  useEffect(() => () => { drag.current?.cancel(); clearHover(); }, []);

  const resolve = useCallback((ids: readonly string[], x: number, y: number): ResolvedDrop | null => {
    const { visible, expanded, rowEl, nodes, canDrop } = o.current;
    const rows: DropRow[] = [];
    for (const v of visible) {
      const el = rowEl(v.node.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      rows.push({
        id: v.node.id, parentId: v.parentId, level: v.level, index: v.index,
        branch: !!v.node.children, expanded: expanded.has(v.node.id),
        childCount: v.node.children?.length ?? 0, top: r.top, height: r.height,
      });
    }
    const first = visible[0] && rowEl(visible[0].node.id);
    const deep = visible.find((v) => v.level > 1);
    const deepEl = deep && rowEl(deep.node.id);
    const parentEl = deep?.parentId != null ? rowEl(deep.parentId) : undefined;
    const indent = first && deepEl && parentEl
      ? { originX: first.getBoundingClientRect().left, indent: deepEl.getBoundingClientRect().left - parentEl.getBoundingClientRect().left }
      : undefined;
    const hit = resolveDrop(rows, { x, y }, indent);
    if (landsInside(nodes, ids, hit.target)) return null;
    if (canDrop && !canDrop(ids, hit.target)) return null;
    return hit;
  }, [o]);

  const reset = useCallback(() => {
    drag.current = null;
    clearHover();
    setState(IDLE);
  }, []);

  const onPointerDown = useCallback((id: string, e: ReactPointerEvent<HTMLElement>) => {
    const { enabled, container } = o.current;
    const box = container();
    if (!enabled || !box || drag.current || e.button !== 0) return;
    if ((e.target as Element).closest('[data-tree-twisty]')) return;
    if (isInControlWithin(e.target, e.currentTarget)) return;
    const mods: PressModifiers = { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey };
    const rect = e.currentTarget.getBoundingClientRect();
    const grab = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let ids: string[] = [];

    const update = (ev: { clientX: number; clientY: number }) => {
      const hit = resolve(ids, ev.clientX, ev.clientY);
      const into = hit?.mark?.where === 'into' ? hit.mark.id : null;
      if (into && !o.current.expanded.has(into)) {
        if (hover.current?.id !== into) {
          clearHover();
          hover.current = { id: into, timer: setTimeout(() => o.current.expand(into), HOVER_EXPAND_MS) };
        }
      } else {
        clearHover();
      }
      setState({
        dragging: ids,
        mark: hit?.mark ?? null,
        ghost: { ids, left: ev.clientX - grab.x, top: ev.clientY - grab.y, width: rect.width },
      });
    };

    drag.current = startThresholdDrag(e, {
      origin: box,
      onActivate: (ev) => {
        ids = draggedIdsFor(o.current.nodes, o.current.selected, id);
        update(ev);
      },
      onMove: update,
      onCommit: (ev) => {
        const hit = resolve(ids, ev.clientX, ev.clientY);
        if (hit && !isNoopMove(o.current.nodes, ids, hit.target)) o.current.onMove?.(ids, hit.target);
        reset();
      },
      onClick: () => {
        o.current.onPress(id, mods);
        swallowNextClick(box);
        reset();
      },
      onCancel: reset,
    });
  }, [o, resolve, reset]);

  return { state, onPointerDown };
}
```

- [ ] **Step 8: Wire it into `Tree.tsx`**
  - Add to `TreeProps` (after `onAction`), with the doc comments from the spec:
    ```ts
    /** Drag-to-reorder and keyboard moves. Off unless given. Called with the
     *  dragged ids in tree order and where they land; `Tree` never reorders
     *  `nodes` itself. */
    onMove?(ids: string[], target: TreeDropTarget): void;
    /** Refuse a drop. A drop into a dragged node or beneath one is refused
     *  regardless. Default: allow. */
    canDrop?(ids: readonly string[], target: TreeDropTarget): boolean;
    ```
    and `import type { TreeDropTarget } from '../../dropTarget';`, `import { useTreeDrag } from './useTreeDrag';`, `import { DragGhost } from '../DragGhost';`.
  - Add `index: number` to the `Visible` interface; in the `visible` walk use `list.forEach((node, index) => { out.push({ node, parentId, level, index }); … })`.
  - Destructure `onMove, canDrop` in the component signature.
  - Before the `if (nodes.length === 0)` early return (hooks must run unconditionally), add:
    ```ts
    const treeEl = useRef<HTMLUListElement | null>(null);
    const drag = useTreeDrag({
      enabled: !!onMove,
      nodes, visible, expanded, selected,
      container: () => treeEl.current,
      rowEl: (id) => items.current.get(id)?.firstElementChild as HTMLElement | undefined,
      canDrop, onMove,
      onPress: (id, mods) => { const v = visible[indexOf.get(id) ?? -1]; if (v) activate(v.node, mods); },
      expand: (id) => { if (!expanded.has(id)) setExpanded(new Set(expanded).add(id)); },
    });
    ```
    `activate` is declared after the early return today; move the `focus`/`toggle`/`select`/`activate` declarations above the `useTreeDrag` call (they are plain closures, so order is the only change).
  - On each `<li>`: `data-drop={drag.state.mark?.id === node.id ? drag.state.mark.where : undefined}` and `data-dragging={drag.state.dragging?.includes(node.id) ? 'true' : undefined}`.
  - On the row `<div>`: `onPointerDown={onMove ? (e) => drag.onPointerDown(node.id, e) : undefined}`. On the twisty `<span>`: `data-tree-twisty=""`.
  - Merge refs on the `<ul>`: `ref={(el) => { treeEl.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}`.
  - After the `<ul>`, when `drag.state.ghost && treeEl.current`, render
    ```tsx
    <DragGhost at={drag.state.ghost} from={treeEl.current}>
      {drag.state.ghost.ids.map((id) => {
        const v = visible[indexOf.get(id) ?? -1];
        return <div key={id} className={s.ghostRow}>{v?.node.label ?? id}</div>;
      })}
    </DragGhost>
    ```
    and wrap the `<ul>` and ghost in a fragment.
  - Update the component doc's **Keyboard** paragraph in Task 4, not here.

- [ ] **Step 9: Add the CSS** — append to `Tree.module.css`:

```css
/* Drop marks: a line on the edge the drop lands at, or a ring on the branch it lands in. An 'after' mark sits on
   the li, which encloses the subtree, so it lands under the last descendant at the row's own indent. */
.item { position: relative; }

.item[data-drop='before']::before,
.item[data-drop='after']::after {
  content: '';
  position: absolute;
  inset-inline: var(--wzl-control-h-xs) 0;
  height: 2px;
  background: var(--wzl-accent);
  border-radius: 1px;
  pointer-events: none;
}
.item[data-drop='before']::before { top: -1px; }
.item[data-drop='after']::after { bottom: -1px; }

.item[data-drop='into'] > .row {
  outline: 2px solid var(--wzl-accent);
  outline-offset: -2px;
}

.item[data-dragging] > .row { opacity: 0.5; }

.ghostRow {
  height: var(--wzl-control-h);
  display: flex;
  align-items: center;
  padding-inline: var(--wzl-space-2);
  font-size: var(--wzl-font-size-sm);
}
```

Check `--wzl-accent` exists in `packages/theme` tokens (`grep -rn "\-\-wzl-accent:" packages/theme/src | head -2`); if the accent token is named differently, use the one `ItemList.module.css` uses for its `data-drop` line.

- [ ] **Step 10: Export the target type** — `Tree/index.ts`: `export type { TreeDropTarget } from '../../dropTarget';`. Confirm `packages/ui/src/index.ts`'s `export * from './components/Tree'` carries it.

- [ ] **Step 11: Run all Tree tests**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Tree`
Expected: PASS — the new drag file and the existing `Tree.test.tsx` unchanged.

- [ ] **Step 12: Commit**

```bash
git add packages/ui/src/components/Tree packages/ui/src/index.ts
git commit -m "add drag-to-reorder to Tree behind onMove and canDrop"
```

---

### Task 4: Tree keyboard moves

**Files:**
- Modify: `packages/ui/src/components/Tree/Tree.tsx` (`onKeyDown`, doc comment)
- Test: `packages/ui/src/components/Tree/Tree.drag.test.tsx`

**Interfaces:**
- Consumes: `keyboardTarget`, `draggedIdsFor`, `parentsOf`, `isNoopMove`, `landsInside` (Task 3).

- [ ] **Step 1: Write failing tests** — append to `Tree.drag.test.tsx`:

```tsx
describe('Tree — keyboard moves', () => {
  const focusOn = (name: string) => screen.getByRole('treeitem', { name }).focus();
  const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k, altKey: true });

  it('moves among siblings with Alt+Up/Down', () => {
    const { onMove } = setup();
    focusOn('Why');
    key('ArrowUp');
    expect(onMove).toHaveBeenLastCalledWith(['y'], { parentId: 'g', index: 0 });
  });

  it('outdents with Alt+Left and indents with Alt+Right', () => {
    const { onMove } = setup();
    focusOn('Ex');
    key('ArrowLeft');
    expect(onMove).toHaveBeenLastCalledWith(['x'], { parentId: null, index: 1 });
    focusOn('Zed');
    key('ArrowRight');
    expect(onMove).toHaveBeenLastCalledWith(['z'], { parentId: 'g', index: 2 });
  });

  it('routes keyboard moves through canDrop', () => {
    const { onMove } = setup({ canDrop: () => false });
    focusOn('Why');
    key('ArrowUp');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('treats Alt+arrows as plain navigation without onMove', () => {
    setup({ onMove: undefined });
    focusOn('Ex');
    key('ArrowLeft');
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Group' }));
  });

  it('keeps focus on the moved node after it remounts under its new parent', () => {
    function Live() {
      const [nodes, setNodes] = useState<TreeNode[]>(NODES);
      return (
        <Tree aria-label="T" nodes={nodes} defaultExpandedIds={['g']} onMove={(ids, t) => {
          // test-only: move z into g at t.index
          if (ids[0] === 'z' && t.parentId === 'g') setNodes([{ ...NODES[0]!, children: [...NODES[0]!.children!, NODES[1]!] }]);
        }} />
      );
    }
    render(<Live />);
    focusOn('Zed');
    key('ArrowRight');
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Zed' }));
  });
});
```

Add `import { useState } from 'react';` to the file's imports.

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Tree/Tree.drag.test.tsx`
Expected: FAIL — Alt+arrows only navigate.

- [ ] **Step 3: Implement** — in `Tree.tsx`'s `onKeyDown`, before `switch (e.key)`:

```ts
    if (onMove && e.altKey && !e.metaKey && !e.ctrlKey) {
      const dir = MOVE_KEYS[e.key];
      if (dir) {
        e.preventDefault();
        const parents = parentsOf(nodes);
        const carried = draggedIdsFor(nodes, selected, node.id);
        const ids = carried.every((x) => parents.get(x) === parents.get(node.id)) ? carried : [node.id];
        const target = keyboardTarget(nodes, ids, dir);
        if (target && !landsInside(nodes, ids, target) && !isNoopMove(nodes, ids, target) && (!canDrop || canDrop(ids, target))) {
          if (dir === 'in' && target.parentId !== null && !expanded.has(target.parentId)) {
            setExpanded(new Set(expanded).add(target.parentId));
          }
          pendingFocus.current = node.id;
          onMove(ids, target);
        }
        return;
      }
    }
```

Add at module level `const MOVE_KEYS: Record<string, KeyboardMove | undefined> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'out', ArrowRight: 'in' };` (import `type KeyboardMove` from `./treeMoves`). Add `const pendingFocus = useRef<string | null>(null);` beside the other refs (above the early return), and an effect that runs after every render:

```ts
  useEffect(() => {
    const id = pendingFocus.current;
    if (id == null) return;
    pendingFocus.current = null;
    items.current.get(id)?.focus();
  });
```

Import `useEffect` and the four `treeMoves` helpers. In the component's doc comment, add to **Keyboard**: "With `onMove`, Alt+Up/Down move the focused node (or the selection holding it) among its siblings, and Alt+Left/Right outdent it and indent it under the sibling above; each goes through `canDrop`."

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Tree`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Tree
git commit -m "move Tree nodes with Alt+arrows when onMove is given"
```

---

### Task 5: Tree drag in a real browser, story, changeset

**Files:**
- Create: `packages/ui/src/components/Tree/Tree.browser.test.tsx`
- Modify: `packages/ui/src/components/Tree/Tree.stories.tsx`
- Create: `.changeset/tree-drag-reorder.md`

- [ ] **Step 1: Write the browser test**

```tsx
import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useState } from 'react';
import { Tree, type TreeNode, type TreeDropTarget } from './index';

afterEach(cleanup);

const START: TreeNode[] = [
  { id: 'g', label: 'Group', children: [{ id: 'x', label: 'Ex' }, { id: 'y', label: 'Why' }] },
  { id: 'z', label: 'Zed' },
];

/** Applies a move to a two-level fixture: enough to see the rows land. */
function apply(nodes: TreeNode[], ids: string[], t: TreeDropTarget): TreeNode[] {
  const pick = (list: TreeNode[]): [TreeNode[], TreeNode[]] => {
    const taken: TreeNode[] = [];
    const rest = list.flatMap((n) => {
      if (ids.includes(n.id)) { taken.push(n); return []; }
      if (!n.children) return [n];
      const [kids, got] = pick(n.children);
      taken.push(...got);
      return [{ ...n, children: kids }];
    });
    return [rest, taken];
  };
  const [rest, taken] = pick(nodes);
  const insert = (list: TreeNode[], parent: string | null): TreeNode[] => {
    if (parent === t.parentId) {
      const before = (t.parentId === null ? nodes : nodes.find((n) => n.id === t.parentId)?.children ?? [])
        .slice(0, t.index).filter((n) => !ids.includes(n.id)).length;
      return [...list.slice(0, before), ...taken, ...list.slice(before)];
    }
    return list.map((n) => (n.children ? { ...n, children: insert(n.children, n.id) } : n));
  };
  return insert(rest, null);
}

function Live() {
  const [nodes, setNodes] = useState(START);
  return <Tree aria-label="T" nodes={nodes} defaultExpandedIds={['g']} onMove={(ids, t) => setNodes((n) => apply(n, ids, t))} />;
}

async function dragTo(from: HTMLElement, toX: number, toY: number) {
  const a = from.getBoundingClientRect();
  const opts = (x: number, y: number) => ({ bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y, isPrimary: true });
  from.dispatchEvent(new PointerEvent('pointerdown', opts(a.left + 20, a.top + a.height / 2)));
  for (let i = 1; i <= 8; i++) {
    document.dispatchEvent(new PointerEvent('pointermove', opts(a.left + 20 + ((toX - a.left - 20) * i) / 8, a.top + a.height / 2 + ((toY - a.top - a.height / 2) * i) / 8)));
    await new Promise((r) => requestAnimationFrame(r));
  }
  document.dispatchEvent(new PointerEvent('pointerup', opts(toX, toY)));
  await new Promise((r) => requestAnimationFrame(r));
}

const labels = () => screen.getAllByRole('treeitem').map((li) => li.querySelector('[id]')!.textContent);

test('dragging a top-level row onto the upper half of a child moves it into the group', async () => {
  render(<Live />);
  const zed = screen.getByRole('treeitem', { name: 'Zed' }).firstElementChild as HTMLElement;
  const ex = (screen.getByRole('treeitem', { name: 'Ex' }).firstElementChild as HTMLElement).getBoundingClientRect();
  await dragTo(zed, ex.left + 30, ex.top + 3);
  expect(labels()).toEqual(['Group', 'Zed', 'Ex', 'Why']);
  expect(screen.getByRole('treeitem', { name: 'Zed' })).toHaveAttribute('aria-level', '2');
});

test('below the last child, a pointer at the top level drops after the group', async () => {
  render(<Live />);
  const ex = screen.getByRole('treeitem', { name: 'Ex' }).firstElementChild as HTMLElement;
  const group = (screen.getByRole('treeitem', { name: 'Group' }).firstElementChild as HTMLElement).getBoundingClientRect();
  const why = (screen.getByRole('treeitem', { name: 'Why' }).firstElementChild as HTMLElement).getBoundingClientRect();
  await dragTo(ex, group.left + 2, why.bottom - 2);
  expect(screen.getByRole('treeitem', { name: 'Ex' })).toHaveAttribute('aria-level', '1');
});
```

If `startThresholdDrag` ignores synthetic `PointerEvent`s in Chromium (it listens on the origin after `setPointerCapture`), switch the helper to `userEvent.pointer` from `@vitest/browser/context`, which `FitLabel.browser.test.tsx` may already use — check it first.

- [ ] **Step 2: Run it**

Run: `npx vitest run --project=browser packages/ui/src/components/Tree/Tree.browser.test.tsx`
Expected: PASS. If the second test fails, the indent measurement is wrong: log `indent` from `useTreeDrag.resolve` and compare with the 16px-per-level CSS before changing anything else.

- [ ] **Step 3: Add a story** — in `Tree.stories.tsx`, add a `Reorderable` story rendering a stateful wrapper like `Live` above over the file's existing sample nodes, with `selectionMode="multiple"`. Reuse the `apply` helper by moving it to `Tree.stories.tsx` only if the stories file has no equivalent; otherwise inline a minimal one.

- [ ] **Step 4: Write the changeset** — `.changeset/tree-drag-reorder.md`:

```md
---
'@weasel-js/ui': patch
---

`Tree` reorders by drag and by Alt+arrow keys when given `onMove(ids, target)`, where `target` is `{ parentId, index }`. A drop into a dragged node or beneath it is always refused; `canDrop(ids, target)` refuses anything else the consumer forbids, such as leaving the parent. Without `onMove` the tree behaves as before. `useReorderDragList` now resolves its drop index through the same model; its behavior is unchanged.
```

- [ ] **Step 5: Lint, typecheck, commit**

Run: `npm run lint -- packages/ui/src/components/Tree packages/ui/src/dropTarget.ts && npm run typecheck`
Expected: clean.

```bash
git add packages/ui/src/components/Tree .changeset/tree-drag-reorder.md
git commit -m "pin Tree drag in a real browser and add a reorderable story"
```

Post a screenshot of the `Reorderable` story mid-drag to the wall (`transom post <file>`, zone `weasel`).

---

### Task 6: `schemaEdit`

**Files:**
- Create: `packages/ui/src/components/PrefSchemaEditor/schemaEdit.ts`
- Create: `packages/ui/src/components/PrefSchemaEditor/schemaEdit.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SchemaNode = ToolPrefLeaf | ToolPrefGroup;
  export type ChildMap = Record<string, SchemaNode>;
  export interface SchemaTarget { parentPath: string | null; index: number }
  export function isValidKey(key: string): boolean;
  export function childrenOf(node: SchemaNode): ChildMap | undefined;
  export function nodeAt(root: ToolPrefGroup, path: string | null): SchemaNode | undefined;
  export function parentPath(path: string): string | null;
  export function keyOf(path: string): string;
  export function joinPath(parent: string | null, key: string): string;
  export function uniqueKey(kids: ChildMap, base: string): string;
  export function addNode(root: ToolPrefGroup, parent: string | null, key: string, node: SchemaNode, index?: number): ToolPrefGroup;
  export function removeNode(root: ToolPrefGroup, path: string): ToolPrefGroup;
  export function renameKey(root: ToolPrefGroup, path: string, next: string): ToolPrefGroup;
  export function replaceNode(root: ToolPrefGroup, path: string | null, fn: (n: SchemaNode) => SchemaNode): ToolPrefGroup;
  export function setAttribute(root: ToolPrefGroup, path: string | null, key: string, value: unknown): ToolPrefGroup;
  export function moveNodes(root: ToolPrefGroup, paths: readonly string[], target: SchemaTarget): { root: ToolPrefGroup; paths: string[] };
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import type { ToolPrefGroup } from '@weasel-js/core';
import { addNode, isValidKey, moveNodes, nodeAt, removeNode, renameKey, setAttribute, uniqueKey } from './schemaEdit';

const enc = { read: () => true, write: (on: boolean) => on };
const ROOT: ToolPrefGroup = {
  name: 'Root',
  children: {
    a: { name: 'A', children: {
      x: { kind: 'number', name: 'X', description: '', default: 1, min: 0 },
      y: { kind: 'boolean', name: 'Y', description: '', default: false, encoding: enc },
    } },
    b: { name: 'B', children: { x: { kind: 'string', name: 'BX', description: '', default: '' } } },
    z: { kind: 'object', name: 'Z', description: '', default: {}, children: {} },
  },
};
const keys = (root: ToolPrefGroup, path: string | null) => Object.keys((nodeAt(root, path) as ToolPrefGroup).children);

describe('schemaEdit', () => {
  it('finds nodes by dotted path, and the root by null', () => {
    expect(nodeAt(ROOT, 'a.x')).toMatchObject({ name: 'X' });
    expect(nodeAt(ROOT, null)).toBe(ROOT);
    expect(nodeAt(ROOT, 'a.nope')).toBeUndefined();
  });

  it('adds at an index, into a group or an object leaf', () => {
    const next = addNode(ROOT, 'a', 'w', { kind: 'boolean', name: 'W', description: '', default: true }, 1);
    expect(keys(next, 'a')).toEqual(['x', 'w', 'y']);
    expect(keys(addNode(ROOT, 'z', 'k', { name: 'K', children: {} }), 'z')).toEqual(['k']);
    expect(ROOT.children.a).not.toHaveProperty('children.w');
  });

  it('refuses a taken key, a dotted key, and a leaf parent', () => {
    expect(() => addNode(ROOT, 'a', 'x', { name: 'G', children: {} })).toThrow(/taken/);
    expect(isValidKey('a.b')).toBe(false);
    expect(() => addNode(ROOT, 'a', 'a.b', { name: 'G', children: {} })).toThrow(/key/);
    expect(() => addNode(ROOT, 'a.x', 'k', { name: 'G', children: {} })).toThrow(/children/);
  });

  it('removes, and renames in place', () => {
    expect(keys(removeNode(ROOT, 'a.x'), 'a')).toEqual(['y']);
    expect(keys(renameKey(ROOT, 'a.x', 'xx'), 'a')).toEqual(['xx', 'y']);
    expect(() => renameKey(ROOT, 'a.x', 'y')).toThrow(/taken/);
  });

  it('sets and clears an attribute, keeping function-valued siblings by identity', () => {
    const next = setAttribute(ROOT, 'a.y', 'name', 'Why');
    expect(nodeAt(next, 'a.y')).toMatchObject({ name: 'Why' });
    expect((nodeAt(next, 'a.y') as { encoding: unknown }).encoding).toBe(enc);
    expect(nodeAt(setAttribute(ROOT, 'a.x', 'min', undefined), 'a.x')).not.toHaveProperty('min');
    expect(setAttribute(ROOT, null, 'name', 'R').name).toBe('R');
  });

  it('moves across parents at a pre-move index and reports new paths', () => {
    const { root, paths } = moveNodes(ROOT, ['a.y'], { parentPath: null, index: 1 });
    expect(keys(root, null)).toEqual(['a', 'y', 'b', 'z']);
    expect(paths).toEqual(['y']);
  });

  it('counts the index before the move within one parent', () => {
    const { root } = moveNodes(ROOT, ['a'], { parentPath: null, index: 3 });
    expect(keys(root, null)).toEqual(['b', 'z', 'a']);
  });

  it('renames a moved node rather than overwrite a sibling with its key', () => {
    const { root, paths } = moveNodes(ROOT, ['a.x'], { parentPath: 'b', index: 1 });
    expect(keys(root, 'b')).toEqual(['x', 'x2']);
    expect(paths).toEqual(['b.x2']);
    expect(nodeAt(root, 'b.x')).toMatchObject({ name: 'BX' });
  });

  it('refuses to move a node into itself', () => {
    expect(() => moveNodes(ROOT, ['a'], { parentPath: 'a', index: 0 })).toThrow(/itself/);
  });

  it('picks the next free key', () => {
    expect(uniqueKey({ x: {} as never, x2: {} as never }, 'x')).toBe('x3');
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor/schemaEdit.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
import type { ToolPrefGroup, ToolPrefLeaf, ToolPrefObject } from '@weasel-js/core';
import { isPrefLeaf } from '../Prefs/schema';

export type SchemaNode = ToolPrefLeaf | ToolPrefGroup;
export type ChildMap = Record<string, SchemaNode>;

/** Where moved nodes land: among `parentPath`'s children (`null` is the root), at `index` counted before the move. */
export interface SchemaTarget {
  parentPath: string | null;
  index: number;
}

const KEY = /^[A-Za-z_$][\w$]*$/;

/** A key is one path segment, so it can hold no `.`; an identifier also prints bare in the exported literal. */
export function isValidKey(key: string): boolean {
  return KEY.test(key);
}

/** The children of a group, or of an `object` leaf; `undefined` for anything that cannot hold any. */
export function childrenOf(node: SchemaNode): ChildMap | undefined {
  if (!isPrefLeaf(node)) return node.children;
  return node.kind === 'object' ? (node as ToolPrefObject).children : undefined;
}

export function parentPath(path: string): string | null {
  const i = path.lastIndexOf('.');
  return i === -1 ? null : path.slice(0, i);
}

export function keyOf(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1);
}

export function joinPath(parent: string | null, key: string): string {
  return parent === null ? key : `${parent}.${key}`;
}

export function nodeAt(root: ToolPrefGroup, path: string | null): SchemaNode | undefined {
  if (path === null) return root;
  let cur: SchemaNode | undefined = root;
  for (const k of path.split('.')) cur = cur && childrenOf(cur)?.[k];
  return cur;
}

export function uniqueKey(kids: ChildMap, base: string): string {
  if (!(base in kids)) return base;
  let n = 2;
  while (`${base}${n}` in kids) n++;
  return `${base}${n}`;
}

function withChildren(node: SchemaNode, kids: ChildMap): SchemaNode {
  return { ...node, children: kids } as SchemaNode;
}

/** `root` with the children of the node at `parent` replaced by `edit` of them. */
function editChildren(root: ToolPrefGroup, parent: string | null, edit: (kids: ChildMap) => ChildMap): ToolPrefGroup {
  const keys = parent === null ? [] : parent.split('.');
  const go = (node: SchemaNode, depth: number): SchemaNode => {
    const kids = childrenOf(node);
    const here = keys.slice(0, depth).join('.') || '(root)';
    if (!kids) throw new Error(`schemaEdit: ${here} cannot hold children`);
    if (depth === keys.length) return withChildren(node, edit(kids));
    const k = keys[depth]!;
    const child = kids[k];
    if (!child) throw new Error(`schemaEdit: no node at ${keys.slice(0, depth + 1).join('.')}`);
    return withChildren(node, { ...kids, [k]: go(child, depth + 1) });
  };
  return go(root, 0) as ToolPrefGroup;
}

function insertAt(kids: ChildMap, entries: Array<[string, SchemaNode]>, index: number): ChildMap {
  const list = Object.entries(kids);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, ...entries);
  return Object.fromEntries(list);
}

function checkKey(kids: ChildMap, key: string): void {
  if (!isValidKey(key)) throw new Error(`schemaEdit: "${key}" is not a valid key`);
  if (key in kids) throw new Error(`schemaEdit: key "${key}" is taken`);
}

export function addNode(root: ToolPrefGroup, parent: string | null, key: string, node: SchemaNode, index?: number): ToolPrefGroup {
  return editChildren(root, parent, (kids) => {
    checkKey(kids, key);
    return insertAt(kids, [[key, node]], index ?? Object.keys(kids).length);
  });
}

export function removeNode(root: ToolPrefGroup, path: string): ToolPrefGroup {
  const key = keyOf(path);
  return editChildren(root, parentPath(path), (kids) => {
    const { [key]: _gone, ...rest } = kids;
    return rest;
  });
}

export function renameKey(root: ToolPrefGroup, path: string, next: string): ToolPrefGroup {
  const key = keyOf(path);
  if (next === key) return root;
  return editChildren(root, parentPath(path), (kids) => {
    checkKey(kids, next);
    return Object.fromEntries(Object.entries(kids).map(([k, v]) => [k === key ? next : k, v]));
  });
}

export function replaceNode(root: ToolPrefGroup, path: string | null, fn: (n: SchemaNode) => SchemaNode): ToolPrefGroup {
  if (path === null) return fn(root) as ToolPrefGroup;
  const key = keyOf(path);
  return editChildren(root, parentPath(path), (kids) => {
    const node = kids[key];
    if (!node) throw new Error(`schemaEdit: no node at ${path}`);
    return { ...kids, [key]: fn(node) };
  });
}

/** Set one attribute; `undefined` removes it. Every other field keeps its value, functions included. */
export function setAttribute(root: ToolPrefGroup, path: string | null, key: string, value: unknown): ToolPrefGroup {
  return replaceNode(root, path, (node) => {
    const next: Record<string, unknown> = { ...node };
    if (value === undefined) delete next[key];
    else next[key] = value;
    return next as unknown as SchemaNode;
  });
}

/**
 * Move the nodes at `paths` to `target`, in the order given. A path beneath another moved path travels with it. A
 * moved key that collides with one already in the target parent is renamed with {@link uniqueKey}. Returns the
 * tree and each moved node's new path.
 */
export function moveNodes(root: ToolPrefGroup, paths: readonly string[], target: SchemaTarget): { root: ToolPrefGroup; paths: string[] } {
  const tops = paths.filter((p) => !paths.some((q) => q !== p && p.startsWith(`${q}.`)));
  const dest = target.parentPath;
  if (dest !== null && tops.some((p) => dest === p || dest.startsWith(`${p}.`))) {
    throw new Error('schemaEdit: cannot move a node into itself');
  }
  const moving = tops.map((p) => {
    const node = nodeAt(root, p);
    if (!node) throw new Error(`schemaEdit: no node at ${p}`);
    return { path: p, key: keyOf(p), node };
  });
  const destKids = childrenOf(nodeAt(root, dest) ?? root);
  if (!destKids) throw new Error(`schemaEdit: ${dest} cannot hold children`);
  const destKeys = Object.keys(destKids);
  const shift = moving.filter((m) => parentPath(m.path) === dest && destKeys.indexOf(m.key) < target.index).length;

  let next = root;
  for (const m of moving) next = removeNode(next, m.path);
  const out: string[] = [];
  next = editChildren(next, dest, (kids) => {
    const taken: ChildMap = { ...kids };
    const entries: Array<[string, SchemaNode]> = moving.map((m) => {
      const key = uniqueKey(taken, m.key);
      taken[key] = m.node;
      out.push(joinPath(dest, key));
      return [key, m.node];
    });
    return insertAt(kids, entries, target.index - shift);
  });
  return { root: next, paths: out };
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor/schemaEdit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/PrefSchemaEditor/schemaEdit.ts packages/ui/src/components/PrefSchemaEditor/schemaEdit.test.ts
git commit -m "add path-keyed edits for pref schemas"
```

---

### Task 7: `schemaExport`

**Files:**
- Create: `packages/ui/src/components/PrefSchemaEditor/schemaExport.ts`
- Create: `packages/ui/src/components/PrefSchemaEditor/schemaExport.test.ts`

**Interfaces:**
- Consumes: `childrenOf`, `SchemaNode`, `joinPath` (Task 6).
- Produces:
  ```ts
  export const KEEP = 'KEEP_FROM_SOURCE';
  export function containsCode(v: unknown): boolean;
  export function printValue(v: unknown, depth?: number): string;
  export function printSchema(root: ToolPrefGroup): string;
  export type SchemaChange =
    | { op: 'add'; path: string; kind: string }
    | { op: 'remove'; path: string; kind: string }
    | { op: 'move'; from: string; to: string }
    | { op: 'reorder'; path: string }
    | { op: 'attr'; path: string; key: string; from: unknown; to: unknown };
  export function diffSchemas(before: ToolPrefGroup, after: ToolPrefGroup): SchemaChange[];
  export function changedPaths(changes: readonly SchemaChange[]): Set<string>;
  export function formatChanges(changes: readonly SchemaChange[]): string;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import type { ToolPrefGroup } from '@weasel-js/core';
import { diffSchemas, formatChanges, KEEP, printSchema } from './schemaExport';
import { moveNodes, renameKey, setAttribute } from './schemaEdit';

const ROOT: ToolPrefGroup = {
  name: 'Root',
  description: "It's here",
  children: {
    a: { name: 'A', children: {
      x: { kind: 'number', name: 'X', description: '', default: 1, min: 0, unit: { toDisplay: (v: number) => v } as never },
      e: { kind: 'enum', name: 'E', description: '', default: 'p', options: [{ value: 'p', label: 'P' }, { value: 'q', label: 'Q' }] },
    } },
    'odd-key': { kind: 'boolean', name: 'B', description: '', default: true, encoding: { read: () => true, write: (on: boolean) => on } },
  },
};

describe('printSchema', () => {
  it('prints a literal that evaluates back to the tree, with code as KEEP_FROM_SOURCE', () => {
    const text = printSchema(ROOT);
    const STUB = Symbol('keep');
    const back = new Function(KEEP, `return (${text});`)(STUB);
    expect(back.description).toBe("It's here");
    expect(back.children.a.children.x.unit).toBe(STUB);
    expect(back.children['odd-key'].encoding).toBe(STUB);
    expect(back.children.a.children.e.options).toEqual([{ value: 'p', label: 'P' }, { value: 'q', label: 'Q' }]);
    expect(Object.keys(back.children)).toEqual(['a', 'odd-key']);
  });

  it('quotes keys that are not identifiers and prints option rows one per line', () => {
    const text = printSchema(ROOT);
    expect(text).toContain("'odd-key': {");
    expect(text).toContain("{ value: 'p', label: 'P' },");
  });
});

describe('diffSchemas', () => {
  it('reports an attribute change, a rename as a move, and a reorder', () => {
    let next = setAttribute(ROOT, 'a.x', 'min', 5);
    next = renameKey(next, 'a.e', 'mode');
    next = moveNodes(next, ['odd-key'], { parentPath: null, index: 0 }).root;
    const changes = diffSchemas(ROOT, next);
    expect(changes).toContainEqual({ op: 'attr', path: 'a.x', key: 'min', from: 0, to: 5 });
    expect(changes).toContainEqual({ op: 'move', from: 'a.e', to: 'a.mode' });
    expect(changes).toContainEqual({ op: 'reorder', path: '' });
  });

  it('carries a moved group\'s children with it instead of reporting each', () => {
    const next = moveNodes(
      { name: 'R', children: { g: { name: 'G', children: { k: { kind: 'string', name: 'K', description: '', default: '' } } }, h: { name: 'H', children: {} } } },
      ['g'], { parentPath: 'h', index: 0 },
    ).root;
    const changes = diffSchemas({ name: 'R', children: { g: { name: 'G', children: { k: { kind: 'string', name: 'K', description: '', default: '' } } }, h: { name: 'H', children: {} } } }, next);
    expect(changes).toEqual([{ op: 'move', from: 'g', to: 'h.g' }]);
  });

  it('does not report a function attribute that kept its identity', () => {
    const next = setAttribute(ROOT, 'odd-key', 'name', 'Bee');
    expect(diffSchemas(ROOT, next)).toEqual([{ op: 'attr', path: 'odd-key', key: 'name', from: 'B', to: 'Bee' }]);
  });

  it('formats one line per change', () => {
    expect(formatChanges([
      { op: 'add', path: 'a.n', kind: 'number' },
      { op: 'remove', path: 'a.o', kind: 'group' },
      { op: 'move', from: 'a.e', to: 'a.mode' },
      { op: 'attr', path: 'a.x', key: 'min', from: 0, to: 5 },
    ])).toBe(['+ a.n  (number)', '− a.o  (group)', '↕ a.e → a.mode', '~ a.x.min  0 → 5'].join('\n'));
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor/schemaExport.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
import type { ToolPrefGroup } from '@weasel-js/core';
import { isPrefLeaf } from '../Prefs/schema';
import { childrenOf, joinPath, type SchemaNode } from './schemaEdit';

/** What an attribute holding code prints as: an undeclared name, so the pasted literal fails typecheck until the
 *  original expression is put back. */
export const KEEP = 'KEEP_FROM_SOURCE';

const IDENT = /^[A-Za-z_$][\w$]*$/;
const pad = (depth: number) => '  '.repeat(depth);
const isScalar = (v: unknown) => v === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof v);
const isPlain = (v: unknown): v is Record<string, unknown> =>
  Object.prototype.toString.call(v) === '[object Object]' && !Array.isArray(v);

/** Whether `v` is or holds something a literal cannot carry: a function, or a non-plain object. */
export function containsCode(v: unknown): boolean {
  if (typeof v === 'function') return true;
  if (Array.isArray(v)) return v.some(containsCode);
  if (v !== null && typeof v === 'object') return !isPlain(v) || Object.values(v).some(containsCode);
  return false;
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function printKey(k: string): string {
  return IDENT.test(k) ? k : quote(k);
}

function printInline(v: Record<string, unknown>): string {
  const parts = Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${printKey(k)}: ${printValue(x, 0)}`);
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

/** `v` as TypeScript source, indented from `depth`. */
export function printValue(v: unknown, depth = 0): string {
  if (containsCode(v)) return KEEP;
  if (typeof v === 'string') return quote(v);
  if (isScalar(v)) return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every(isScalar)) return `[${v.map((x) => printValue(x)).join(', ')}]`;
    const rows = v.map((x) => `${pad(depth + 1)}${isPlain(x) && Object.values(x).every(isScalar) ? printInline(x) : printValue(x, depth + 1)},`);
    return `[\n${rows.join('\n')}\n${pad(depth)}]`;
  }
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  if (entries.length === 0) return '{}';
  const rows = entries.map(([k, x]) => `${pad(depth + 1)}${printKey(k)}: ${printValue(x, depth + 1)},`);
  return `{\n${rows.join('\n')}\n${pad(depth)}}`;
}

export function printSchema(root: ToolPrefGroup): string {
  return printValue(root, 0);
}

export type SchemaChange =
  | { op: 'add'; path: string; kind: string }
  | { op: 'remove'; path: string; kind: string }
  | { op: 'move'; from: string; to: string }
  | { op: 'reorder'; path: string }
  | { op: 'attr'; path: string; key: string; from: unknown; to: unknown };

const kindOf = (n: SchemaNode) => (isPrefLeaf(n) ? n.kind : 'group');

function flatten(root: ToolPrefGroup): Map<string, SchemaNode> {
  const out = new Map<string, SchemaNode>();
  const walk = (node: SchemaNode, path: string | null) => {
    for (const [k, child] of Object.entries(childrenOf(node) ?? {})) {
      const p = joinPath(path, k);
      out.set(p, child);
      walk(child, p);
    }
  };
  walk(root, null);
  return out;
}

const same = (a: unknown, b: unknown) => a === b || (!containsCode(a) && !containsCode(b) && printValue(a) === printValue(b));

function attrChanges(path: string, a: SchemaNode, b: SchemaNode): SchemaChange[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('children');
  const out: SchemaChange[] = [];
  for (const k of keys) {
    const from = (a as unknown as Record<string, unknown>)[k];
    const to = (b as unknown as Record<string, unknown>)[k];
    if (!same(from, to)) out.push({ op: 'attr', path, key: k, from, to });
  }
  return out;
}

/**
 * What changed from `before` to `after`. Nodes match by path; a node that left one path and a node with the same
 * kind and name that arrived at another are taken as one node moved, and a moved node's descendants travel with
 * it unreported. Reordering a node's children is one `reorder` for that node (`''` is the root).
 */
export function diffSchemas(before: ToolPrefGroup, after: ToolPrefGroup): SchemaChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const out: SchemaChange[] = [];
  const pairs: Array<[string, string]> = [];
  const gone = [...a.keys()].filter((p) => !b.has(p));
  const added = new Set([...b.keys()].filter((p) => !a.has(p)));
  const moved = new Map<string, string>();
  for (const from of gone.sort((x, y) => x.split('.').length - y.split('.').length)) {
    const via = [...moved].find(([f]) => from.startsWith(`${f}.`));
    if (via) {
      const to = via[1] + from.slice(via[0].length);
      if (added.has(to)) { added.delete(to); pairs.push([from, to]); continue; }
    }
    const node = a.get(from)!;
    const to = [...added].find((p) => kindOf(b.get(p)!) === kindOf(node) && b.get(p)!.name === node.name);
    if (to === undefined) { out.push({ op: 'remove', path: from, kind: kindOf(node) }); continue; }
    added.delete(to);
    moved.set(from, to);
    out.push({ op: 'move', from, to });
    pairs.push([from, to]);
  }
  for (const p of added) out.push({ op: 'add', path: p, kind: kindOf(b.get(p)!) });
  for (const p of a.keys()) if (b.has(p)) pairs.push([p, p]);
  for (const [from, to] of pairs) out.push(...attrChanges(to, a.get(from)!, b.get(to)!));
  // Only keys present on both sides count, so a child arriving or leaving is not a reorder.
  const keysAt = (root: ToolPrefGroup, map: Map<string, SchemaNode>, path: string) =>
    Object.keys(childrenOf(path === '' ? root : map.get(path)!) ?? {});
  for (const p of ['', ...[...a.keys()].filter((x) => b.has(x))]) {
    const was = keysAt(before, a, p);
    const now = keysAt(after, b, p);
    const shared = (list: string[], other: string[]) => list.filter((k) => other.includes(k)).join(',');
    if (shared(was, now) !== shared(now, was)) out.push({ op: 'reorder', path: p });
  }
  out.push(...attrChanges('', before, after));
  return out;
}

/** Every path a change touches, for marking rows. */
export function changedPaths(changes: readonly SchemaChange[]): Set<string> {
  const out = new Set<string>();
  for (const c of changes) {
    if (c.op === 'move') out.add(c.to);
    else if (c.op !== 'remove') out.add(c.path);
  }
  return out;
}

function brief(v: unknown): string {
  return v === undefined ? '(unset)' : printValue(v).replace(/\s*\n\s*/g, ' ');
}

export function formatChanges(changes: readonly SchemaChange[]): string {
  return changes.map((c) => {
    switch (c.op) {
      case 'add': return `+ ${c.path}  (${c.kind})`;
      case 'remove': return `− ${c.path}  (${c.kind})`;
      case 'move': return `↕ ${c.from} → ${c.to}`;
      case 'reorder': return `⇅ ${c.path || '(root)'}  children reordered`;
      case 'attr': return `~ ${c.path ? `${c.path}.` : ''}${c.key}  ${brief(c.from)} → ${brief(c.to)}`;
    }
  }).join('\n');
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor/schemaExport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/PrefSchemaEditor/schemaExport.ts packages/ui/src/components/PrefSchemaEditor/schemaExport.test.ts
git commit -m "print pref schemas as TS literals and diff them"
```

---

### Task 8: `kindSchemas` and attribute controls

**Files:**
- Create: `packages/ui/src/components/PrefSchemaEditor/kindSchemas.ts`, `kindSchemas.test.ts`
- Create: `packages/ui/src/components/PrefSchemaEditor/attrRenderers.tsx`, `attrRenderers.test.tsx`

**Interfaces:**
- Consumes: `SchemaNode`, `replaceNode` (Task 6); `containsCode` (Task 7).
- Produces:
  ```ts
  export type KindAttrs = Record<string, ToolPrefLeaf>;
  export type CustomKinds = Record<string, KindAttrs>;
  export const BUILTIN_KINDS: readonly ToolPrefKind[];
  export interface AttributeSchema { schema: ToolPrefGroup; readOnly: Array<[string, unknown]> }
  export function attributeSchema(node: SchemaNode, custom?: CustomKinds): AttributeSchema;
  export function normalizeAttr(key: string, value: unknown): unknown;
  export function blankLeaf(kind: string): ToolPrefLeaf;
  export function blankGroup(): ToolPrefGroup;
  export function changeKind(root: ToolPrefGroup, path: string, kind: string, custom?: CustomKinds): { root: ToolPrefGroup; dropped: string[] };
  // attrRenderers.tsx
  export const ATTR_RENDERERS: Record<'optional-number' | 'string-list' | 'enum-options', PrefRenderer>;
  ```

- [ ] **Step 1: Write the failing tests** — `kindSchemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ToolPrefGroup, ToolPrefLeaf } from '@weasel-js/core';
import { attributeSchema, blankLeaf, changeKind, normalizeAttr } from './kindSchemas';
import { nodeAt } from './schemaEdit';

const num: ToolPrefLeaf = { kind: 'number', name: 'N', description: '', default: 3, min: 0, max: 10, unit: { toDisplay: (v: number) => v } as never } as ToolPrefLeaf;

describe('kindSchemas', () => {
  it('describes a number leaf with base, default and number attributes', () => {
    const { schema, readOnly } = attributeSchema(num);
    expect(Object.keys(schema.children)).toEqual(expect.arrayContaining(['name', 'description', 'default', 'min', 'max', 'step', 'control', 'hidden']));
    expect(schema.children.default).toMatchObject({ kind: 'number', min: 0, max: 10 });
    expect(readOnly.map(([k]) => k)).toEqual(['unit']);
  });

  it('describes a group with name and description only', () => {
    expect(Object.keys(attributeSchema({ name: 'G', children: {} }).schema.children)).toEqual(['name', 'description']);
  });

  it('uses a custom kind\'s attributes, and treats unknown attributes as read-only', () => {
    const leaf = { kind: 'registry-enum', name: 'R', description: '', default: 'a', source: 'tools', extra: 1 } as ToolPrefLeaf;
    const { schema, readOnly } = attributeSchema(leaf, { 'registry-enum': { source: { kind: 'string', name: 'Source', description: '', default: '' } } });
    expect(schema.children.source).toBeDefined();
    expect(readOnly).toEqual([['default', 'a'], ['extra', 1]]);
  });

  it('drops empty optional attributes and keeps required ones', () => {
    expect(normalizeAttr('min', undefined)).toBeUndefined();
    expect(normalizeAttr('hidden', false)).toBeUndefined();
    expect(normalizeAttr('short', [])).toBeUndefined();
    expect(normalizeAttr('description', '')).toBe('');
    expect(normalizeAttr('min', 0)).toBe(0);
  });

  it('changes kind, keeping base fields and reporting dropped attributes', () => {
    const root: ToolPrefGroup = { name: 'R', children: { n: { ...num, unit: undefined, hidden: true } as ToolPrefLeaf } };
    const { root: next, dropped } = changeKind(root, 'n', 'boolean');
    expect(nodeAt(next, 'n')).toMatchObject({ kind: 'boolean', name: 'N', hidden: true, default: false });
    expect(dropped.sort()).toEqual(['default', 'max', 'min']);
  });

  it('makes blank leaves that pass their own attribute schema', () => {
    expect(blankLeaf('enum')).toMatchObject({ kind: 'enum', default: 'a', options: [{ value: 'a', label: 'A' }] });
    expect(blankLeaf('object')).toMatchObject({ kind: 'object', children: {} });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor/kindSchemas.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `kindSchemas.ts`**

```ts
import { solid } from '@weasel-js/core';
import type { ToolPrefEnum, ToolPrefGroup, ToolPrefKind, ToolPrefLeaf, ToolPrefNumber } from '@weasel-js/core';
import { isPrefLeaf } from '../Prefs/schema';
import { replaceNode, nodeAt, type SchemaNode } from './schemaEdit';
import { containsCode } from './schemaExport';

export type KindAttrs = Record<string, ToolPrefLeaf>;
export type CustomKinds = Record<string, KindAttrs>;

export const BUILTIN_KINDS: readonly ToolPrefKind[] = ['number', 'boolean', 'string', 'enum', 'color', 'paint', 'object'];

const text = (name: string, description: string, multiline = false): ToolPrefLeaf =>
  ({ kind: 'string', name, description, default: '', ...(multiline ? { control: 'textarea' } : {}) }) as ToolPrefLeaf;
const flag = (name: string, description: string): ToolPrefLeaf => ({ kind: 'boolean', name, description, default: false });
const optNumber = (name: string, description: string): ToolPrefLeaf => ({ kind: 'optional-number', name, description, default: undefined });
const choice = (name: string, description: string, values: readonly string[]): ToolPrefLeaf =>
  ({ kind: 'enum', name, description, default: undefined, clearable: true, options: values.map((v) => ({ value: v, label: v })) }) as ToolPrefLeaf;
const control = (values: readonly string[]) => choice('Control', 'Which control draws it. Unset: the kind\'s default.', values);

const LEAF_BASE: KindAttrs = {
  name: text('Name', 'The label beside the control.'),
  description: text('Description', 'Help text for the tooltip or the line under the label.', true),
  hidden: flag('Hidden', 'Left out of a settings UI unless it shows hidden prefs.'),
  block: flag('Block', 'Full width with no label row, for a control with its own chrome.'),
  icon: text('Icon', 'Glyph name in the host\'s icon set.'),
  pair: text('Pair', 'Leaves sharing this label share one row in compact property UIs.'),
  short: { kind: 'string-list', name: 'Short names', description: 'Shorter forms of the name, longest first.', default: [] },
};

const KIND_ATTRS: Record<ToolPrefKind, KindAttrs> = {
  number: {
    min: optNumber('Min', 'Lowest value.'),
    max: optNumber('Max', 'Highest value.'),
    step: optNumber('Step', 'Increment.'),
    control: control(['input', 'slider']),
    endless: choice('Endless', 'Which ends run to infinity.', ['min', 'max', 'both']),
  },
  boolean: { control: control(['checkbox', 'switch', 'toggle']) },
  string: { control: control(['input', 'textarea']) },
  enum: {
    options: { kind: 'enum-options', name: 'Options', description: 'Values and their labels, in order.', default: [] },
    clearable: flag('Clearable', 'Can be set back to no value.'),
    control: control(['select', 'radio', 'toggle']),
  },
  color: { alpha: flag('Alpha', 'Offer an alpha channel.') },
  paint: { alpha: flag('Alpha', 'Offer an alpha channel.') },
  object: {},
};

const GROUP_ATTRS: ToolPrefGroup = { name: 'Group', children: { name: LEAF_BASE.name!, description: LEAF_BASE.description! } };

/** Written even when empty: a leaf without them is not a leaf. */
const REQUIRED = new Set(['name', 'description', 'default', 'options']);

function defaultAttr(leaf: ToolPrefLeaf): ToolPrefLeaf | null {
  const base = { name: 'Default', description: 'The value before anything is stored.' };
  switch (leaf.kind) {
    case 'number': {
      const n = leaf as ToolPrefNumber;
      return { ...base, kind: 'number', default: 0, min: n.min, max: n.max, step: n.step } as ToolPrefLeaf;
    }
    case 'boolean': return { ...base, kind: 'boolean', default: false };
    case 'string': return { ...base, kind: 'string', default: '' } as ToolPrefLeaf;
    case 'enum': return { ...base, kind: 'enum', default: undefined, clearable: true, options: (leaf as ToolPrefEnum).options } as ToolPrefLeaf;
    case 'color': return { ...base, kind: 'color', default: '#000000' } as ToolPrefLeaf;
    default: return null;
  }
}

export interface AttributeSchema {
  /** Editable attributes, rendered with `PrefsForm` over the node itself as values. */
  schema: ToolPrefGroup;
  /** Attributes shown but not edited: code, and anything the kind's schema does not describe. */
  readOnly: Array<[string, unknown]>;
}

export function attributeSchema(node: SchemaNode, custom: CustomKinds = {}): AttributeSchema {
  if (!isPrefLeaf(node)) return { schema: GROUP_ATTRS, readOnly: [] };
  const own = (KIND_ATTRS as Record<string, KindAttrs>)[node.kind] ?? custom[node.kind] ?? {};
  const def = defaultAttr(node);
  const children: KindAttrs = { ...LEAF_BASE, ...(def ? { default: def } : {}), ...own };
  const fields = node as unknown as Record<string, unknown>;
  for (const k of Object.keys(children)) if (containsCode(fields[k])) delete children[k];
  const readOnly = Object.entries(fields).filter(([k]) => k !== 'kind' && k !== 'children' && !(k in children));
  return { schema: { name: 'Attributes', children }, readOnly };
}

/** The value to store for an edited attribute: an optional one left empty is removed rather than written. */
export function normalizeAttr(key: string, value: unknown): unknown {
  if (REQUIRED.has(key)) return value;
  if (value === undefined || value === '' || value === false) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return value;
}

export function blankLeaf(kind: string): ToolPrefLeaf {
  const base = { kind, name: 'New pref', description: '' };
  switch (kind) {
    case 'number': return { ...base, default: 0 } as ToolPrefLeaf;
    case 'boolean': return { ...base, default: false } as ToolPrefLeaf;
    case 'string': return { ...base, default: '' } as ToolPrefLeaf;
    case 'enum': return { ...base, default: 'a', options: [{ value: 'a', label: 'A' }] } as ToolPrefLeaf;
    case 'color': return { ...base, default: '#000000' } as ToolPrefLeaf;
    case 'paint': return { ...base, default: solid('#000000') } as ToolPrefLeaf;
    case 'object': return { ...base, default: {}, children: {} } as ToolPrefLeaf;
    default: return { ...base, default: undefined } as ToolPrefLeaf;
  }
}

export function blankGroup(): ToolPrefGroup {
  return { name: 'New group', description: '', children: {} };
}

const SHARED = ['name', 'description', 'hidden', 'block', 'icon', 'pair', 'short'];

/** Change a leaf's kind. Base fields carry over, as does a default of the same type; the rest is reported. */
export function changeKind(root: ToolPrefGroup, path: string, kind: string, custom: CustomKinds = {}): { root: ToolPrefGroup; dropped: string[] } {
  const old = nodeAt(root, path) as unknown as Record<string, unknown>;
  const blank = blankLeaf(kind) as unknown as Record<string, unknown>;
  const keep = new Set([...SHARED, ...Object.keys((KIND_ATTRS as Record<string, KindAttrs>)[kind] ?? custom[kind] ?? {})]);
  const next: Record<string, unknown> = { ...blank };
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(old)) {
    if (k === 'kind' || v === undefined) continue;
    if (k === 'default') {
      if (typeof v === typeof blank.default && v !== null) next.default = v;
      else dropped.push('default');
      continue;
    }
    if (k === 'children' && 'children' in blank) { next.children = v; continue; }
    if (keep.has(k)) next[k] = v;
    else dropped.push(k);
  }
  return { root: replaceNode(root, path, () => next as unknown as SchemaNode), dropped };
}
```

`solid` is exported from `@weasel-js/core` (labkit's schema-lab imports it the same way).

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor/kindSchemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing tests for the controls** — `attrRenderers.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefRenderContext } from '../Prefs';
import { ATTR_RENDERERS } from './attrRenderers';

afterEach(cleanup);

const ctx = (kind: string, value: unknown, setValue = vi.fn()): PrefRenderContext => ({
  path: 'x', pref: { kind, name: 'X', description: '', default: undefined }, value, setValue, auto: false, setAuto: () => {},
});

describe('attribute controls', () => {
  it('optional-number writes a number, and undefined when cleared', () => {
    const setValue = vi.fn();
    render(<>{ATTR_RENDERERS['optional-number'](ctx('optional-number', 4, setValue))}</>);
    const box = screen.getByRole('textbox', { name: 'X' });
    fireEvent.change(box, { target: { value: '12' } });
    fireEvent.blur(box);
    expect(setValue).toHaveBeenLastCalledWith(12);
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.blur(box);
    expect(setValue).toHaveBeenLastCalledWith(undefined);
  });

  it('enum-options edits a value and adds a row', () => {
    const setValue = vi.fn();
    render(<>{ATTR_RENDERERS['enum-options'](ctx('enum-options', [{ value: 'a', label: 'A' }], setValue))}</>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Option 1 value' }), { target: { value: 'b' } });
    expect(setValue).toHaveBeenLastCalledWith([{ value: 'b', label: 'A' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Add option' }));
    expect(setValue).toHaveBeenLastCalledWith([{ value: 'a', label: 'A' }, { value: '', label: '' }]);
  });
});
```

- [ ] **Step 6: Implement `attrRenderers.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { PrefRenderContext, PrefRenderer } from '../Prefs';
import { Button } from '../Button';
import { CloseButton } from '../CloseButton';
import { Input } from '../Input';
import { ListEditor } from '../ListEditor';
import s from './PrefSchemaEditor.module.css';

/** A number that may be unset: empty text clears it, and text that is not a number is left uncommitted. */
function OptionalNumber({ ctx }: { ctx: PrefRenderContext }) {
  const shown = ctx.value === undefined ? '' : String(ctx.value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => { setDraft(shown); }, [shown]);
  const commit = () => {
    const t = draft.trim();
    if (t === '') ctx.setValue(undefined);
    else if (Number.isFinite(Number(t))) ctx.setValue(Number(t));
    else setDraft(shown);
  };
  return <Input aria-label={ctx.pref.name} value={draft} onChange={setDraft} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />;
}

interface Option { value: string; label: string }

function EnumOptions({ ctx }: { ctx: PrefRenderContext }) {
  const rows = (ctx.value as Option[] | undefined) ?? [];
  const set = (i: number, patch: Partial<Option>) => ctx.setValue(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={s.options}>
      {rows.map((r, i) => (
        <div key={i} className={s.optionRow}>
          <Input aria-label={`Option ${i + 1} value`} value={r.value} onChange={(v) => set(i, { value: v })} />
          <Input aria-label={`Option ${i + 1} label`} value={r.label} onChange={(v) => set(i, { label: v })} />
          <CloseButton aria-label={`Remove option ${i + 1}`} onPress={() => ctx.setValue(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button size="sm" onClick={() => ctx.setValue([...rows, { value: '', label: '' }])}>Add option</Button>
    </div>
  );
}

export const ATTR_RENDERERS: Record<'optional-number' | 'string-list' | 'enum-options', PrefRenderer> = {
  'optional-number': (ctx) => <OptionalNumber ctx={ctx} />,
  'string-list': (ctx) => <ListEditor aria-label={ctx.pref.name} value={(ctx.value as string[] | undefined) ?? []} onChange={ctx.setValue} />,
  'enum-options': (ctx) => <EnumOptions ctx={ctx} />,
};
```

Before writing, check `CloseButton`'s press prop name (`grep -n "onPress\|onClick" packages/ui/src/components/CloseButton/CloseButton.tsx`) and `Button`'s `size` values; use what they declare. `Input` passes `onBlur`/`onKeyDown` through to React Aria's `TextField`, which accepts both.

Create `PrefSchemaEditor.module.css` now with the two classes this file uses (Task 9 adds the rest):

```css
.options { display: grid; gap: var(--wzl-space-2); }
.optionRow { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--wzl-space-2); align-items: center; }
```

- [ ] **Step 7: Run to see it pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/components/PrefSchemaEditor
git commit -m "describe each pref kind's attributes as a schema of their own"
```

---

### Task 9: `PrefSchemaEditor`

**Files:**
- Create: `packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.tsx`, `StructurePane.tsx`, `AttributesPane.tsx`, `ExportPanel.tsx`, `index.ts`
- Modify: `packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.module.css`
- Create: `packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.test.tsx`, `PrefSchemaEditor.stories.tsx`
- Modify: `packages/ui/src/index.ts`
- Create: `.changeset/pref-schema-editor.md`

**Interfaces:**
- Consumes: everything from Tasks 3, 6, 7, 8.
- Produces:
  ```ts
  export interface PrefSchemaEditorProps {
    schema: ToolPrefGroup;
    onChange(next: ToolPrefGroup): void;
    original?: ToolPrefGroup;
    kinds?: CustomKinds;
    renderers?: Record<string, PrefRenderer>;
    className?: string;
  }
  export function PrefSchemaEditor(props: PrefSchemaEditorProps): JSX.Element;
  ```
  `index.ts` exports `PrefSchemaEditor`, `PrefSchemaEditorProps`, `CustomKinds`, `KindAttrs`, `printSchema`, `diffSchemas`, `formatChanges`, `SchemaChange`.

- [ ] **Step 1: Write the failing component test**

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const START: ToolPrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: 'Draw the grid.', default: true },
    } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });

describe('PrefSchemaEditor', () => {
  it('shows the schema as a tree and the preview as a form', () => {
    render(<Live />);
    expect(within(structure()).getByRole('treeitem', { name: /view/ })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Preview' })).getByText('Show grid')).toBeInTheDocument();
  });

  it('edits a leaf attribute and the preview follows', () => {
    render(<Live />);
    fireEvent.click(within(structure()).getByText('grid'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Grid on' } });
    expect(within(screen.getByRole('region', { name: 'Preview' })).getByText('Grid on')).toBeInTheDocument();
  });

  it('adds a pref into the selected group and lists it under Changes', () => {
    render(<Live />);
    fireEvent.click(within(structure()).getByText('view'));
    fireEvent.click(screen.getByRole('button', { name: 'Add pref' }));
    expect(within(structure()).getByText('newPref')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Changes' }));
    expect(screen.getByText(/\+ view\.newPref {2}\(boolean\)/)).toBeInTheDocument();
  });

  it('exports a literal with the edit in it', () => {
    render(<Live />);
    fireEvent.click(screen.getByRole('tab', { name: 'Literal' }));
    expect(screen.getByTestId('schema-literal').textContent).toContain("name: 'Show grid',");
  });

  it('refuses a key that is taken and says why', () => {
    render(<Live />);
    fireEvent.click(within(structure()).getByText('grid'));
    const key = screen.getByRole('textbox', { name: 'Key' });
    fireEvent.change(key, { target: { value: 'a.b' } });
    fireEvent.blur(key);
    expect(screen.getByText(/not a valid key/)).toBeInTheDocument();
  });
});
```

`Add pref` adds a leaf of the kind picked in the toolbar's kind select; the default pick is `boolean`.

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `StructurePane.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { Button } from '../Button';
import { Code } from '../Code';
import { Select } from '../Select';
import { Tree, type TreeNode } from '../Tree';
import { isPrefLeaf } from '../Prefs/schema';
import { blankGroup, blankLeaf } from './kindSchemas';
import { addNode, childrenOf, joinPath, keyOf, moveNodes, nodeAt, parentPath, removeNode, uniqueKey, type SchemaNode } from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

function toTreeNodes(node: SchemaNode, path: string | null, changed: ReadonlySet<string>): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).map(([key, child]) => {
    const p = joinPath(path, key);
    const kids = childrenOf(child);
    return {
      id: p,
      label: key,
      textValue: key,
      trailing: <Code size="xs" status="muted" variant="plain">{isPrefLeaf(child) ? child.kind : 'group'}</Code>,
      className: changed.has(p) ? s.changed : undefined,
      ...(kids ? { children: toTreeNodes(child, p, changed) } : {}),
    };
  });
}

export interface StructurePaneProps {
  schema: ToolPrefGroup;
  onChange(next: ToolPrefGroup): void;
  selected: string | null;
  onSelect(path: string | null): void;
  changed: ReadonlySet<string>;
  kinds: readonly string[];
}

export function StructurePane({ schema, onChange, selected, onSelect, changed, kinds }: StructurePaneProps) {
  const nodes = useMemo(() => toTreeNodes(schema, null, changed), [schema, changed]);
  const [kind, setKind] = useState<string>('boolean');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(nodes.flatMap(function all(n): string[] { return n.children ? [n.id, ...n.children.flatMap(all)] : []; })));

  /** Where an add lands: inside the selection if it holds children, else after it. */
  const addTarget = (): { parent: string | null; index?: number } => {
    if (selected === null) return { parent: null };
    if (childrenOf(nodeAt(schema, selected)!)) return { parent: selected };
    const parent = parentPath(selected);
    const sibs = Object.keys(childrenOf(nodeAt(schema, parent)!) ?? {});
    return { parent, index: sibs.indexOf(keyOf(selected)) + 1 };
  };
  const add = (base: string, node: SchemaNode) => {
    const { parent, index } = addTarget();
    const key = uniqueKey(childrenOf(nodeAt(schema, parent)!) ?? {}, base);
    onChange(addNode(schema, parent, key, node, index));
    if (parent !== null) setExpanded((e) => new Set(e).add(parent));
    onSelect(joinPath(parent, key));
  };

  return (
    <section className={s.pane} aria-label="Structure">
      <div className={s.toolbar}>
        <Select aria-label="Kind to add" width="fit" selectedKey={kind} onSelectionChange={(k) => setKind(String(k))}
          options={kinds.map((k) => ({ value: k, label: k }))} />
        <Button size="sm" onClick={() => add('newPref', blankLeaf(kind))}>Add pref</Button>
        <Button size="sm" onClick={() => add('newGroup', blankGroup())}>Add group</Button>
        <Button size="sm" disabled={selected === null} onClick={() => {
          if (selected === null) return;
          onChange(removeNode(schema, selected));
          onSelect(parentPath(selected));
        }}>Remove</Button>
      </div>
      <Tree
        aria-label="Schema structure"
        nodes={nodes}
        expandedIds={expanded}
        onExpandedChange={setExpanded}
        selectionMode="single"
        selectedIds={selected === null ? [] : [selected]}
        onSelectionChange={(ids) => onSelect([...ids][0] ?? null)}
        canDrop={(_ids, t) => t.parentId === null || !!childrenOf(nodeAt(schema, t.parentId)!)}
        onMove={(ids, t) => {
          const moved = moveNodes(schema, ids, { parentPath: t.parentId, index: t.index });
          onChange(moved.root);
          onSelect(moved.paths[0] ?? null);
        }}
      />
    </section>
  );
}

```

Check `Select`'s accessible-name prop (`aria-label` vs `label`) in `Select.tsx` and use the one it declares.

- [ ] **Step 4: Implement `AttributesPane.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { Code } from '../Code';
import { DetailList, DetailRow } from '../DetailList';
import { Input } from '../Input';
import { PrefsForm, type PrefRenderer } from '../Prefs';
import { isPrefLeaf } from '../Prefs/schema';
import { Select } from '../Select';
import { ATTR_RENDERERS } from './attrRenderers';
import { attributeSchema, changeKind, normalizeAttr, type CustomKinds } from './kindSchemas';
import { isValidKey, joinPath, keyOf, nodeAt, parentPath, renameKey, setAttribute, childrenOf } from './schemaEdit';
import { KEEP, containsCode, printValue } from './schemaExport';
import s from './PrefSchemaEditor.module.css';

export interface AttributesPaneProps {
  schema: ToolPrefGroup;
  onChange(next: ToolPrefGroup): void;
  path: string | null;
  onRekey(path: string): void;
  kinds: readonly string[];
  custom: CustomKinds;
  /** Renderers the consumer passes for its own kinds — a custom kind's `default` may need one. */
  renderers?: Record<string, PrefRenderer>;
  onNotice(text: string | null): void;
}

export function AttributesPane({ schema, onChange, path, onRekey, kinds, custom, renderers, onNotice }: AttributesPaneProps) {
  const node = nodeAt(schema, path);
  const [key, setKey] = useState(path === null ? '' : keyOf(path));
  const [keyError, setKeyError] = useState<string | null>(null);
  useEffect(() => { setKey(path === null ? '' : keyOf(path)); setKeyError(null); }, [path]);
  if (!node) return <section className={s.pane} aria-label="Attributes" />;

  const { schema: attrs, readOnly } = attributeSchema(node, custom);
  const commitKey = () => {
    if (path === null || key === keyOf(path)) return;
    const parent = parentPath(path);
    if (!isValidKey(key)) { setKeyError(`"${key}" is not a valid key: use letters, digits, _ or $, not starting with a digit.`); return; }
    if (key in (childrenOf(nodeAt(schema, parent)!) ?? {})) { setKeyError(`"${key}" is taken here.`); return; }
    onChange(renameKey(schema, path, key));
    onRekey(joinPath(parent, key));
  };

  return (
    <section className={s.pane} aria-label="Attributes">
      {path !== null && (
        <div className={s.identity}>
          <Input label="Key" orientation="row" value={key} onChange={setKey} onBlur={commitKey}
            onKeyDown={(e) => { if (e.key === 'Enter') commitKey(); }} errorMessage={keyError ?? undefined} isInvalid={keyError !== null} />
          {isPrefLeaf(node) && (
            <Select label="Kind" orientation="row" selectedKey={node.kind}
              options={kinds.map((k) => ({ value: k, label: k }))}
              onSelectionChange={(k) => {
                const { root, dropped } = changeKind(schema, path, String(k), custom);
                onChange(root);
                onNotice(dropped.length ? `Dropped on kind change: ${dropped.join(', ')}` : null);
              }} />
          )}
        </div>
      )}
      {/* One wrapping group: PrefsForm gives each loose top-level leaf a column of its own. */}
      <PrefsForm
        schema={{ name: 'Attributes', children: { attrs: { ...attrs, name: isPrefLeaf(node) ? node.kind : 'group' } } }}
        values={{ attrs: node }}
        renderers={{ ...renderers, ...ATTR_RENDERERS }}
        onChange={(p, value) => {
          const attr = p.slice('attrs.'.length);
          onChange(setAttribute(schema, path, attr, normalizeAttr(attr, value)));
        }}
      />
      {readOnly.length > 0 && (
        <DetailList>
          {readOnly.map(([k, v]) => (
            <DetailRow key={k} label={k}>
              <Code size="xs" status="muted">{containsCode(v) ? `${KEEP} (code)` : printValue(v).replace(/\s*\n\s*/g, ' ')}</Code>
            </DetailRow>
          ))}
        </DetailList>
      )}
    </section>
  );
}
```

Check `Input`'s invalid prop (React Aria's `isInvalid`) and `Select`'s `label`/`orientation` names against their files before writing; use what they declare.

- [ ] **Step 5: Implement `ExportPanel.tsx`**

```tsx
import { useMemo } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { Button } from '../Button';
import { Tab, TabList, TabPanel, Tabs } from '../Tabs';
import { formatChanges, printSchema, type SchemaChange } from './schemaExport';
import s from './PrefSchemaEditor.module.css';

function Copy({ text }: { text: string }) {
  return <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(text); }}>Copy</Button>;
}

export function ExportPanel({ schema, changes }: { schema: ToolPrefGroup; changes: readonly SchemaChange[] }) {
  const literal = useMemo(() => printSchema(schema), [schema]);
  const list = useMemo(() => formatChanges(changes) || 'No changes.', [changes]);
  return (
    <Tabs className={s.export}>
      <TabList aria-label="Export">
        <Tab id="literal">Literal</Tab>
        <Tab id="changes">Changes</Tab>
      </TabList>
      <TabPanel id="literal">
        <Copy text={literal} />
        <pre className={s.code} data-testid="schema-literal">{literal}</pre>
      </TabPanel>
      <TabPanel id="changes">
        <Copy text={list} />
        <pre className={s.code}>{list}</pre>
      </TabPanel>
    </Tabs>
  );
}
```

- [ ] **Step 6: Implement `PrefSchemaEditor.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { Callout } from '../Callout';
import { PrefsForm, type PrefRenderer } from '../Prefs';
import { AttributesPane } from './AttributesPane';
import { ExportPanel } from './ExportPanel';
import { BUILTIN_KINDS, type CustomKinds } from './kindSchemas';
import { changedPaths, diffSchemas } from './schemaExport';
import { StructurePane } from './StructurePane';
import s from './PrefSchemaEditor.module.css';

/** Props for {@link PrefSchemaEditor}. */
export interface PrefSchemaEditorProps {
  schema: ToolPrefGroup;
  onChange(next: ToolPrefGroup): void;
  /** Baseline for the change list and the changed-row marks. Default: the first `schema` seen. */
  original?: ToolPrefGroup;
  /** Attribute schemas for custom kinds, by kind. A leaf of an unlisted custom kind edits its base fields only. */
  kinds?: CustomKinds;
  /** Renderers for custom kinds, used by the preview and by a custom kind's attributes. */
  renderers?: Record<string, PrefRenderer>;
  className?: string;
}

/**
 * An editor for a preference schema: its structure as a tree, the selected node's attributes as a form, a live
 * `PrefsForm` of the result, and an export of it as a TypeScript literal and a list of changes. Edits stay in
 * `schema`; nothing is written back to source.
 */
export function PrefSchemaEditor({ schema, onChange, original, kinds = {}, renderers, className }: PrefSchemaEditorProps) {
  const [first] = useState(schema);
  const base = original ?? first;
  const [selected, setSelected] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const changes = useMemo(() => diffSchemas(base, schema), [base, schema]);
  const changed = useMemo(() => changedPaths(changes), [changes]);
  const kindList = useMemo(() => [...BUILTIN_KINDS, ...Object.keys(kinds)], [kinds]);

  return (
    <div className={[s.editor, className].filter(Boolean).join(' ')}>
      <StructurePane schema={schema} onChange={onChange} selected={selected} onSelect={setSelected} changed={changed} kinds={kindList} />
      <div className={s.middle}>
        {notice && <Callout status="warning" onDismiss={() => setNotice(null)}>{notice}</Callout>}
        <AttributesPane schema={schema} onChange={onChange} path={selected} onRekey={setSelected}
          kinds={kindList} custom={kinds} renderers={renderers} onNotice={setNotice} />
      </div>
      <section className={s.pane} aria-label="Preview">
        <PrefsForm schema={schema} values={values} renderers={renderers} showHidden
          onChange={(path, v) => setValues((cur) => setAtPath(cur, path, v))} />
      </section>
      <ExportPanel schema={schema} changes={changes} />
    </div>
  );
}

function setAtPath(root: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) return { ...root, [head!]: value };
  const child = (root[head!] as Record<string, unknown> | undefined) ?? {};
  return { ...root, [head!]: setAtPath(child, rest.join('.'), value) };
}
```

Check `Callout`'s props (`grep -n "export interface CalloutProps" -A15 packages/ui/src/components/Callout/Callout.tsx`) and use its status and dismiss names; if it has no dismiss, drop `onDismiss` and clear the notice on the next selection change instead.

- [ ] **Step 7: Layout CSS** — append to `PrefSchemaEditor.module.css`:

```css
.editor {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(280px, 1.2fr) minmax(280px, 1.4fr);
  grid-template-rows: minmax(0, 1fr) auto;
  gap: var(--wzl-space-3);
  min-height: 0;
  height: 100%;
}
.middle { display: grid; align-content: start; gap: var(--wzl-space-2); min-height: 0; overflow: auto; }
.pane { min-height: 0; overflow: auto; }
.toolbar { display: flex; flex-wrap: wrap; gap: var(--wzl-space-2); margin-block-end: var(--wzl-space-2); }
.identity { display: grid; gap: var(--wzl-space-2); margin-block-end: var(--wzl-space-3); }
.export { grid-column: 1 / -1; }
.code {
  margin: var(--wzl-space-2) 0 0;
  max-height: 16rem;
  overflow: auto;
  font-family: var(--wzl-font-mono);
  font-size: var(--wzl-font-size-xs);
  white-space: pre;
}
.changed { font-weight: 600; }
```

Check the mono font token's name in `packages/theme` (`grep -rn "font-mono\|font-family-mono" packages/theme/src | head -3`).

- [ ] **Step 8: `index.ts` and package export**

```ts
export { PrefSchemaEditor, type PrefSchemaEditorProps } from './PrefSchemaEditor';
export type { CustomKinds, KindAttrs } from './kindSchemas';
export { diffSchemas, formatChanges, printSchema, type SchemaChange } from './schemaExport';
```

Add `export * from './components/PrefSchemaEditor';` to `packages/ui/src/index.ts` beside the Prefs export.

- [ ] **Step 9: Run tests**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor`
Expected: PASS. If `getByRole('region', { name: 'Preview' })` fails, a `<section>` gets the `region` role only with an accessible name — confirm `aria-label` is on it.

- [ ] **Step 10: Story** — `PrefSchemaEditor.stories.tsx`, following `Prefs.stories.tsx`'s `Meta`/`StoryObj` from `@weasel-js/forge`: title `'Primitives/PrefSchemaEditor'`, one `Default` story rendering a stateful wrapper over a schema with a group holding one leaf of every built-in kind, inside a 900×640 box (use a CSS module class for the box, not inline style).

- [ ] **Step 11: Changeset** — `.changeset/pref-schema-editor.md`:

```md
---
'@weasel-js/ui': patch
---

New `PrefSchemaEditor`: edit a preference schema's structure and each leaf's attributes with a live `PrefsForm` preview, and export the result as a TypeScript literal plus a list of changes. Attributes holding code (`encoding`, `unit`, `fromScalar`) are shown read-only and exported as `KEEP_FROM_SOURCE`, so a pasted literal fails typecheck until they are restored. Custom kinds describe their attributes through `kinds`. `printSchema`, `diffSchemas` and `formatChanges` are exported for use outside the component.
```

- [ ] **Step 12: Lint, typecheck, commit**

Run: `npm run lint -- packages/ui/src/components/PrefSchemaEditor && npm run typecheck`
Expected: clean.

```bash
git add packages/ui/src/components/PrefSchemaEditor packages/ui/src/index.ts .changeset/pref-schema-editor.md
git commit -m "add PrefSchemaEditor to @weasel-js/ui"
```

---

### Task 10: WeaselDraw `#/dev/prefs`

**Files:**
- Create: `apps/draw/src/dev/PrefSchemaPage.tsx`, `apps/draw/src/dev/PrefSchemaPage.module.css`, `apps/draw/src/dev/PrefSchemaPage.test.tsx`
- Modify: `apps/draw/src/main.tsx`, `apps/draw/src/dev/DevShell.tsx`, `apps/draw/src/CommandBar.tsx`

**Interfaces:**
- Consumes: `PrefSchemaEditor`, `CustomKinds` (Task 9); `PREFS` and the exported `RegistryEnumControl`, `DataControl` (Task 1); `defaultNodeProperties` from `@weasel-js/core`.

- [ ] **Step 1: Write the failing test**

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PrefSchemaPage } from './PrefSchemaPage';

afterEach(cleanup);

describe('PrefSchemaPage', () => {
  it('opens on WeaselDraw preferences and switches to a node kind', () => {
    render(<PrefSchemaPage />);
    const tree = () => screen.getByRole('tree', { name: 'Schema structure' });
    expect(within(tree()).getByText('tools')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Source/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Node: rect' }));
    expect(within(tree()).queryByText('tools')).toBeNull();
  });

  it('describes registry-enum attributes, so its source is editable', () => {
    render(<PrefSchemaPage />);
    fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('lastTool'));
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Source' })).toBeInTheDocument();
  });
});
```

`lastTool` sits under `tools`; the editor opens every branch on load, so it is visible. If `Select`'s trigger is not a button named after its label, adapt the two lines that open it to how `PrefsForm.test.tsx` drives a `Select`.

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=draw apps/draw/src/dev/PrefSchemaPage.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the page**

```tsx
import { useState } from 'react';
import { defaultNodeProperties, type ToolPrefGroup } from '@weasel-js/core';
import { PrefSchemaEditor, Select, type CustomKinds } from '@weasel-js/ui';
import { DataControl, RegistryEnumControl } from '../PreferencesModal';
import { PREFS } from '../prefs';
import { DevShell } from './DevShell';
import s from './PrefSchemaPage.module.css';

const SOURCES: ReadonlyArray<{ id: string; label: string; schema: ToolPrefGroup }> = [
  { id: 'prefs', label: 'WeaselDraw preferences', schema: PREFS },
  ...defaultNodeProperties.map((e) => ({ id: `node:${e.name}`, label: `Node: ${e.name}`, schema: e.schema })),
];

const KINDS: CustomKinds = {
  'registry-enum': {
    source: { kind: 'string', name: 'Source', description: 'Key into the modal\'s registryEnumSources.', default: '' },
    control: { kind: 'enum', name: 'Control', description: 'Which control draws it.', default: undefined, clearable: true,
      options: [{ value: 'select', label: 'select' }, { value: 'radio', label: 'radio' }] },
  },
  data: {},
};

const RENDERERS = { 'registry-enum': RegistryEnumControl, data: DataControl };

/** Edit a schema the app ships, in a scratch copy, and export it. */
export function PrefSchemaPage() {
  const [sourceId, setSourceId] = useState(SOURCES[0]!.id);
  const source = SOURCES.find((x) => x.id === sourceId)!;
  const [draft, setDraft] = useState<ToolPrefGroup>(source.schema);
  return (
    <DevShell
      title="Prefs Schema"
      header={
        <Select label="Source" orientation="row" width="fit" selectedKey={sourceId}
          options={SOURCES.map((x) => ({ value: x.id, label: x.label }))}
          onSelectionChange={(k) => {
            const next = SOURCES.find((x) => x.id === k)!;
            setSourceId(next.id);
            setDraft(next.schema);
          }} />
      }
    >
      <PrefSchemaEditor key={sourceId} className={s.editor} schema={draft} onChange={setDraft}
        original={source.schema} kinds={KINDS} renderers={RENDERERS} />
    </DevShell>
  );
}
```

`RegistryEnumControl` reads `RegistryEnumSourcesContext`; with no provider it falls back to a plain text input (its own doc says so), which is right for a scratch preview. `PrefSchemaPage.module.css`: `.editor { height: 100%; padding: var(--wzl-space-3); }`.

- [ ] **Step 4: Route and switcher entries**
  - `main.tsx`: add `const PrefSchemaPage = lazy(() => import('./dev/PrefSchemaPage').then((m) => ({ default: m.PrefSchemaPage })));` beside the other two, and a branch `hash.startsWith('#/dev/prefs') ? <PrefSchemaPage />` in the `surface` chain before `<App />`. Update the router's doc comment to name all three dev routes.
  - `DevShell.tsx` `DEV_PAGES`: `{ href: '#/dev/prefs', label: 'Prefs Schema' }`.
  - `CommandBar.tsx` `DEBUG_ROUTES`: `{ value: '#/dev/prefs', label: 'Prefs Schema' }`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run --project=draw apps/draw/src/dev/PrefSchemaPage.test.tsx apps/draw/src/PreferencesModal.test.tsx && npm run typecheck && npm run lint -- apps/draw/src`
Expected: PASS, clean.

- [ ] **Step 6: Look at it** — start draw's dev server (see `apps/draw/package.json` for the script; the wake plugin keeps one copy per machine, so use `WAKE_EXTRA=<port>` if one is already running from the main checkout), open `#/dev/prefs` headless with the playwright MCP, and screenshot: the page on load, after selecting `view.gridDensity`, and with the Changes tab open after one edit. Post each with `transom post <file>` to zone `weasel`. Check the three columns are visible side by side and the export drawer spans the bottom — a collapsed grid is invisible to jsdom.

- [ ] **Step 7: Commit**

```bash
git add apps/draw/src/dev/PrefSchemaPage.tsx apps/draw/src/dev/PrefSchemaPage.module.css apps/draw/src/dev/PrefSchemaPage.test.tsx apps/draw/src/main.tsx apps/draw/src/dev/DevShell.tsx apps/draw/src/CommandBar.tsx
git commit -m "add a prefs schema editor page to WeaselDraw's dev surfaces"
```

---

### Task 11: Close out

**Files:**
- Modify: `docs/TODO.md` (only if an entry covers prefs editing or Tree drag — `grep -n -i "tree\b.*drag\|reorder.*tree\|schema editor" docs/TODO.md`)
- Delete: `docs/superpowers/specs/2026-10-08-pref-schema-editor-design.md`, `docs/superpowers/plans/2026-10-08-pref-schema-editor.md`

- [ ] **Step 1:** Retire or rewrite any matching `docs/TODO.md` entry.
- [ ] **Step 2:** Move anything in the spec still worth keeping past the merge into a durable doc first. The one candidate is the Tree drop-zone rule (quarters, x picks the level); it already lives in `resolveDrop`'s doc comment, so nothing moves.
- [ ] **Step 3:** Delete the spec and this plan, and commit:

```bash
git rm docs/superpowers/specs/2026-10-08-pref-schema-editor-design.md docs/superpowers/plans/2026-10-08-pref-schema-editor.md
git commit -m "delete the pref schema editor spec and plan, now built"
```

- [ ] **Step 4:** Run the whole-branch checks: `npm run typecheck && npm run lint && npm run check:test-projects`. After merge to main, launch the full suite on the fleet with `onto test` and do not wait on it.
