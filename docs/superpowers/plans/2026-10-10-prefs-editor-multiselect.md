# Selecting Several Nodes in `PrefSchemaEditor`: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Unbuilt.** Delete this file and the spec beside it (`../specs/2026-10-10-prefs-editor-multiselect-design.md`) when the work merges.

**Goal:** Let the schema editor hold several selected nodes, and move, copy, remove, and edit them together from the tree, the attributes pane, and the live preview.

**Architecture:** The editor's one selected path becomes an ordered list whose last entry, the lead, stands for the selection wherever one node must. `Tree` already selects and drags several rows; the edit helpers already take lists. The new code is an aggregator that turns several nodes' attributes into one form with mixed values, a `mixed` set on `PrefsForm`, and a list-shaped `selected` on `PrefsForm`.

**Tech stack:** React, React Aria, vitest (`weasel-ui` project for jsdom, `browser` project for `*.browser.test.tsx`), CSS modules.

**Ground rules for every task**

- Work only in `/Users/mike/src/weasel/.claude/worktrees/prefs-editor-multiselect`. Use absolute paths under it.
- Never launch a visible browser. Browser checks are `*.browser.test.tsx` files, run headless.
- Run one test file at a time: `npx vitest run --project=weasel-ui --reporter=default <file>`. Running vitest from inside a package finds no files and looks like a pass.
- Commit by path: `git commit -m "<subject>" -- <paths>`. Never `git add -A`.
- US English and the Oxford comma in comments and messages. No backticks-as-quotes in commit subjects.
- All paths below are relative to `packages/ui/src/components/` unless they start with `packages/` or `docs/`.

---

### Task 0: Prepare the worktree

- [ ] **Step 1: Install**

Run from the worktree root: `npm ci`
A worktree without its own `node_modules` builds against the main checkout's stale `dist`.

- [ ] **Step 2: Confirm the starting point is green**

Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/PrefSchemaEditor/schemaEdit.test.ts`
Expected: every test passes. Read the count; do not trust the exit code alone.

---

## Step 1 of the spec: the selection list, the tree, and the actions

### Task 1: `outermost`, `carried`, and `removeNodes`

**Files:**
- Modify: `PrefSchemaEditor/schemaEdit.ts`
- Test: `PrefSchemaEditor/schemaEdit.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `carried, outermost, removeNodes` to the test file's import from `./schemaEdit`, and append inside `describe('schemaEdit', …)`:

```ts
  it('keeps only the paths with no ancestor among them', () => {
    expect(outermost(['a/x', 'b', 'b/x', 'a'])).toEqual(['b', 'a']);
  });

  it('lists what a drag of several carries in the schema\'s own order', () => {
    expect(carried(ROOT, ['z', 'b/x', 'a/y', 'b'])).toEqual(['a/y', 'b', 'z']);
  });

  it('removes several nodes, a nested one going with its parent', () => {
    const next = removeNodes(ROOT, ['a/x', 'b', 'b/x', 'z']);
    expect(keys(next, null)).toEqual(['a']);
    expect(keys(next, 'a')).toEqual(['y']);
    expect(keys(ROOT, null)).toEqual(['a', 'b', 'z']);
  });

  it('removes nothing for no paths', () => {
    expect(removeNodes(ROOT, [])).toBe(ROOT);
  });
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/PrefSchemaEditor/schemaEdit.test.ts`
Expected: FAIL, `outermost is not a function` (or a missing export error).

- [ ] **Step 3: Implement**

In `schemaEdit.ts`, after `isUnder`:

```ts
/** `paths` less any that lies beneath another of them. */
export function outermost(paths: readonly string[]): string[] {
  return paths.filter((p) => !paths.some((q) => isUnder(p, q)));
}
```

After `removeNode`:

```ts
/** `root` without the nodes at `paths`; one beneath another goes with it. */
export function removeNodes<R extends SchemaRoot>(root: R, paths: readonly string[]): R {
  return outermost(paths).reduce((next, p) => removeNode(next, p), root);
}
```

After `branchPaths`:

```ts
/** The outermost of `paths`, in the order the schema holds them. */
export function carried(root: SchemaRoot, paths: readonly string[]): string[] {
  const tops = new Set(outermost(paths));
  const out: string[] = [];
  const walk = (node: SchemaNode, path: string | null) => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const p = joinPath(path, key);
      if (tops.has(p)) out.push(p);
      else walk(child, p);
    }
  };
  walk(root, null);
  return out;
}
```

In `moveNodes` and `copyNodes`, replace each
`const tops = paths.filter((p) => !paths.some((q) => isUnder(p, q)));`
with `const tops = outermost(paths);`.

- [ ] **Step 4: Run and watch them pass**

Same command. Expected: PASS, the whole file.

- [ ] **Step 5: Commit**

```bash
git commit -m "remove several schema nodes at once, and name the outermost of a list of paths" -- packages/ui/src/components/PrefSchemaEditor/schemaEdit.ts packages/ui/src/components/PrefSchemaEditor/schemaEdit.test.ts
```

### Task 2: The selection rules and hook

**Files:**
- Create: `PrefSchemaEditor/useEditorSelection.ts`
- Test: `PrefSchemaEditor/useEditorSelection.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { GENERAL } from './generalBranch';
import { livePaths, nextSelection, toggled } from './useEditorSelection';

const ROOT: PrefGroup = {
  name: 'Root',
  children: {
    a: { name: 'A', children: { x: { kind: 'boolean', name: 'X', description: '', default: false } } },
    b: { kind: 'boolean', name: 'B', description: '', default: false },
  },
};

describe('the editor selection', () => {
  it('puts a newly picked path last, so it leads', () => {
    expect(nextSelection(['a'], new Set(['a', 'b']))).toEqual(['a', 'b']);
    expect(nextSelection(['b', 'a'], new Set(['a', 'b', 'a/x']))).toEqual(['b', 'a', 'a/x']);
  });

  it('keeps the order it had when a path leaves', () => {
    expect(nextSelection(['b', 'a', 'a/x'], new Set(['a/x', 'b']))).toEqual(['b', 'a/x']);
  });

  it('reads the General row alone as the root, and drops it beside real paths', () => {
    expect(nextSelection(['a'], new Set([GENERAL]))).toEqual([]);
    expect(nextSelection(['a'], new Set(['a', GENERAL]))).toEqual(['a']);
  });

  it('toggles one path in and out', () => {
    expect(toggled(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggled(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('drops paths the schema no longer holds, and returns the same list when none went', () => {
    const paths = ['a/x', 'b'];
    expect(livePaths(ROOT, paths)).toBe(paths);
    expect(livePaths(ROOT, ['a/x', 'gone', 'b'])).toEqual(['a/x', 'b']);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/PrefSchemaEditor/useEditorSelection.test.ts`
Expected: FAIL, cannot resolve `./useEditorSelection`.

- [ ] **Step 3: Implement**

```ts
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { GENERAL } from './generalBranch';
import { nodeAt, parentPath, rebasePaths, type SchemaRoot } from './schemaEdit';

const NONE: readonly string[] = [];

/** The selection after the tree reports `ids`: what stayed keeps its order, and what is new goes last. */
export function nextSelection(prev: readonly string[], ids: Iterable<string>): string[] {
  const now = new Set(ids);
  // General is the root's row, which an empty selection already means.
  now.delete(GENERAL);
  const kept = prev.filter((p) => now.has(p));
  return [...kept, ...[...now].filter((p) => !kept.includes(p))];
}

export function toggled(prev: readonly string[], path: string): string[] {
  return prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
}

/** `paths` that still name a node; `paths` itself when all do. */
export function livePaths(schema: SchemaRoot, paths: readonly string[]): readonly string[] {
  const live = paths.filter((p) => nodeAt(schema, p) !== undefined);
  return live.length === paths.length ? paths : live;
}

export interface EditorSelection {
  /** The selected paths, the newest last. Empty is the root. */
  paths: readonly string[];
  /** The path that stands for the selection where one node must: the newest. `null` is the root. */
  lead: string | null;
  set(paths: readonly string[]): void;
  /** Take what the tree reports. */
  pick(ids: Iterable<string>): void;
  /** Add `path` or take it out, opening the branches above it. */
  toggle(path: string): void;
  rebase(moves: ReadonlyArray<readonly [from: string, to: string]>): void;
  /** Select `paths`, opening the branches above each so the tree shows them. */
  reveal(paths: readonly string[]): void;
}

export function useEditorSelection(schema: SchemaRoot, setExpanded: Dispatch<SetStateAction<Set<string>>>): EditorSelection {
  const [stored, setStored] = useState<readonly string[]>(NONE);
  const paths = useMemo(() => livePaths(schema, stored), [schema, stored]);
  return {
    paths,
    lead: paths.at(-1) ?? null,
    set: setStored,
    pick: (ids) => setStored((prev) => nextSelection(prev, ids)),
    toggle: (path) => {
      const above: string[] = [];
      for (let p = parentPath(path); p !== null; p = parentPath(p)) above.push(p);
      // Harmless when the path is leaving: its branches are open already.
      setExpanded((e) => new Set([...e, ...above]));
      setStored((prev) => toggled(prev, path));
    },
    rebase: (moves) => setStored((prev) => [...rebasePaths(prev, moves)]),
    reveal: (next) => {
      const above: string[] = [];
      for (const path of next) for (let p = parentPath(path); p !== null; p = parentPath(p)) above.push(p);
      setExpanded((e) => new Set([...e, ...above]));
      setStored(next);
    },
  };
}
```

- [ ] **Step 4: Run and watch them pass**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "hold the schema editor's selection as an ordered list of paths" -- packages/ui/src/components/PrefSchemaEditor/useEditorSelection.ts packages/ui/src/components/PrefSchemaEditor/useEditorSelection.test.ts
```

### Task 3: A tree row says which node it is

`StructurePane` scrolls the selected row into view by `[aria-selected="true"]`, which with several selected is whichever comes first. It needs the lead's row.

**Files:**
- Modify: `Tree/Tree.tsx` (the `role="treeitem"` element, near line 329)
- Test: `Tree/Tree.test.tsx`

- [ ] **Step 1: Write the failing test**

Append inside the file's top-level `describe`:

```tsx
  it('marks each row with its node id', () => {
    render(<Tree aria-label="Food" nodes={NODES} />);
    expect(screen.getByText('Water').closest('[role="treeitem"]')).toHaveAttribute('data-tree-id', 'water');
  });
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/Tree/Tree.test.tsx`
Expected: FAIL, the attribute is missing.

- [ ] **Step 3: Implement**

On the `role="treeitem"` element, beside `data-muted`, add `data-tree-id={node.id}`.

- [ ] **Step 4: Run and watch it pass, then commit**

```bash
git commit -m "mark each tree row with its node id" -- packages/ui/src/components/Tree/Tree.tsx packages/ui/src/components/Tree/Tree.test.tsx
```

### Task 4: The editor and the structure pane on the list

**Files:**
- Modify: `PrefSchemaEditor/PrefSchemaEditor.tsx`, `PrefSchemaEditor/StructurePane.tsx`
- Create: `PrefSchemaEditor/PrefSchemaEditor.multi.test.tsx` (the existing test file is 654 lines; do not add to it)

- [ ] **Step 1: Write the failing tests**

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: 'Draw the grid.', default: true },
      snap: { kind: 'boolean', name: 'Snap', description: 'Snap to the grid.', default: false },
      zoom: { kind: 'number', name: 'Zoom', description: 'How far in.', default: 1, min: 0 },
    } },
    panels: { name: 'Panels', children: {
      dock: { kind: 'boolean', name: 'Dock', description: 'Dock panels to the edge.', default: true },
    } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => within(structure()).getByText(`(${key})`);
const item = (key: string) => row(key).closest('[role="treeitem"]')!;
const queryRow = (key: string) => within(structure()).queryByText(`(${key})`);
const attributes = () => screen.getByRole('region', { name: 'Attributes' });

describe('PrefSchemaEditor with several nodes selected', () => {
  it('adds a row to the selection with Cmd held, and a range with Shift', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('dock'), { metaKey: true });
    expect(item('grid')).toHaveAttribute('aria-selected', 'true');
    expect(item('dock')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(row('grid'));
    fireEvent.click(row('zoom'), { shiftKey: true });
    expect(item('snap')).toHaveAttribute('aria-selected', 'true');
    expect(item('dock')).toHaveAttribute('aria-selected', 'false');
  });

  it('says how many are selected', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('dock'), { metaKey: true });
    expect(within(attributes()).getByText('2 selected')).toBeInTheDocument();
  });

  it('removes every selected node as one step, and undo brings them back selected', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('dock'), { metaKey: true });
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(queryRow('grid')).toBeNull();
    expect(queryRow('dock')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(item('grid')).toHaveAttribute('aria-selected', 'true');
    expect(item('dock')).toHaveAttribute('aria-selected', 'true');
  });
});
```

If the Undo button's accessible name differs, read it from `EditorBar.tsx` and use that.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.multi.test.tsx`
Expected: FAIL. The first test fails on `item('grid')` no longer selected after the Cmd-click.

- [ ] **Step 3: `StructurePane.tsx`**

Props: replace `selected: string | null; onSelect(path: string | null): void;` with

```ts
  /** The selected paths; empty is the root. */
  selected: readonly string[];
  /** The path that stands for the selection: where an add lands and which row is brought into view. */
  lead: string | null;
  /** The tree's rows now selected, General among them when it is. */
  onPick(ids: Iterable<string>): void;
  /** Select exactly these, after an add. */
  onSelect(paths: readonly string[]): void;
```

and take `lead` and `onPick` in the destructuring. Then:

- The scroll effect becomes

```ts
  useEffect(() => {
    if (lead === null) return;
    const rows = treeArea.current?.querySelectorAll('[data-tree-id]') ?? [];
    [...rows].find((r) => r.getAttribute('data-tree-id') === lead)?.scrollIntoView?.({ block: 'nearest' });
  }, [lead]);
```

- In `addTarget`, every `selected` becomes `lead`.
- `onSelect(joinPath(parent, key))` in `add` becomes `onSelect([joinPath(parent, key)])`; `onSelect(path)` in `onPaletteDrop` becomes `onSelect([path])`.
- The Remove button: `disabled={selected.length === 0 || selected.some((p) => isFixed(schema, p))}`.
- The `Tree`:

```tsx
        selectionMode="multiple"
        // General is the root's row: with nothing selected the attributes pane shows the root's.
        selectedIds={selected.length === 0 ? (hasGeneral ? [GENERAL] : []) : selected}
        onSelectionChange={onPick}
```

- [ ] **Step 4: `PrefSchemaEditor.tsx`**

- Import `removeNodes` in place of `removeNode`, drop `parentPath` only if nothing else uses it, and import `useEditorSelection` and `PaneHeader`.
- Delete the `selected` state. After the `expanded` state add `const selection = useEditorSelection(schema, setExpanded);`.
- `useLatest({ schema, onChange, selected })` becomes `useLatest({ schema, onChange, paths: selection.paths })`.
- The history's selection hook:

```ts
      selection: {
        get: () => [...latest.current.paths],
        set: (ids) => selection.set(ids),
      },
```

  `selection.set` is a state setter, so it is safe to capture once.
- Replace `select` and `reveal` with

```ts
  const select = (paths: readonly string[]) => {
    selection.set(paths);
    setNotice(null);
  };
  const pick = (ids: Iterable<string>) => {
    selection.pick(ids);
    setNotice(null);
  };
  /** Select nodes picked outside the tree, opening the branches above them so the tree shows them. */
  const reveal = (paths: readonly string[]) => {
    selection.reveal(paths);
    setNotice(null);
  };
```

- In `outside.over`, the rail timer's `select(path === '' ? null : pathOf(...))` becomes `select(path === '' ? [] : [pathOf(path.split('.'))!])`.
- `moveTo`: `select(moved.paths)`. `copyTo`: `reveal(copied.paths)`.
- `remove`:

```ts
  const remove = () => {
    const { paths, schema: now } = latest.current;
    if (paths.length === 0 || paths.some((p) => isFixed(now, p))) return;
    const parent = parentPath(outermost(paths)[0]!);
    commit(removeNodes(now, paths));
    select(parent === null ? [] : [parent]);
  };
```

  (import `outermost`.)
- `rekey`: `selection.rebase([[from, to]]);` in place of `setSelected(to)`.
- The Delete handler's `selected !== null` becomes `selection.paths.length > 0`.
- `onDiscard`: `select([])`.
- `<StructurePane … selected={selection.paths} lead={selection.lead} onPick={pick} onSelect={select} …>`.
- The attributes pane, until Task 7 teaches it several nodes:

```tsx
        {selection.paths.length > 1
          ? <section className={s.pane} aria-label="Attributes"><PaneHeader title={`${selection.paths.length} selected`} /></section>
          : <AttributesPane schema={schema} onChange={(next) => commit(next, `attr:${selection.lead ?? ''}`)} path={selection.lead} onRekey={rekey}
              added={changes.some((c) => c.op === 'add' && c.path === selection.lead)}
              kinds={kindList} custom={custom} renderers={renderers} onNotice={setNotice} />}
```

- `<PreviewPane … selected={selection.lead} onSelect={(path) => reveal(path === null ? [] : [path])} …>`.

- [ ] **Step 5: Run the new file, then the old one**

Run the multi test file. Expected: PASS.
Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/PrefSchemaEditor/`
Expected: every file in the directory passes. A failure in a file this task did not touch is this task's to fix: the single-selection behavior must be unchanged.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck` (from the worktree root). Expected: clean.

```bash
git commit -m "select several rows in the schema editor's tree, and move, copy, and remove them together" -- packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.tsx packages/ui/src/components/PrefSchemaEditor/StructurePane.tsx packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.multi.test.tsx
```

---

## Step 2 of the spec: attributes over several nodes

### Task 5: `PrefsForm` draws a value that disagrees

**Files:**
- Modify: `Prefs/PrefsForm.tsx`, `Prefs/PrefsRow.tsx`
- Test: create `Prefs/PrefsForm.mixed.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm, type PrefRenderContext } from './index';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    title: { kind: 'string', name: 'Title', description: '', default: 'x' },
    odd: { kind: 'odd', name: 'Odd', description: '', default: 1 } as never,
  },
};

describe('PrefsForm with mixed values', () => {
  it('hands a custom renderer mixed and no value at a mixed path', () => {
    const seen: PrefRenderContext[] = [];
    render(<PrefsForm schema={SCHEMA} values={{ title: 'a', odd: 3 }} onChange={vi.fn()} layout="list"
      mixed={new Set(['odd'])} renderers={{ odd: (ctx) => { seen.push(ctx); return <span>odd</span>; } }} />);
    expect(seen.at(-1)).toMatchObject({ mixed: true, value: undefined });
  });

  it('says a path outside the set is not mixed', () => {
    const seen: PrefRenderContext[] = [];
    render(<PrefsForm schema={SCHEMA} values={{ odd: 3 }} onChange={vi.fn()} layout="list"
      renderers={{ odd: (ctx) => { seen.push(ctx); return <span>odd</span>; } }} />);
    expect(seen.at(-1)).toMatchObject({ mixed: false, value: 3 });
  });

  it('draws a built-in text control empty at a mixed path', () => {
    render(<PrefsForm schema={SCHEMA} values={{ title: 'a' }} onChange={vi.fn()} layout="list" mixed={new Set(['title'])} />);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/Prefs/PrefsForm.mixed.test.tsx`
Expected: FAIL on `mixed: true` (the context has no such field), and the textbox holds `a`.

- [ ] **Step 3: Implement**

`PrefsForm.tsx`, in `PrefsFormProps` after `auto`:

```ts
  /** Dotted paths whose leaves stand for several values that disagree: each draws
   *  its control in its mixed state, with no value. Editing one calls `onChange`
   *  as usual, which is the owner's cue to write them all. */
  mixed?: ReadonlySet<string>;
```

Add `mixed: props.mixed` to the `ctx: WalkCtx` literal.

`PrefsRow.tsx`:

- `WalkCtx`: add `mixed?: ReadonlySet<string>;` after `auto`.
- `PrefRenderContext`: after `value`, add

```ts
  /** The leaf stands for several values that disagree; `value` is undefined. */
  mixed: boolean;
```

- In `PrefRow`:

```ts
  const mixed = ctx.mixed?.has(from) ?? false;
```

  and in `renderCtx`, `value: mixed ? undefined : stored !== undefined ? stored : pref.default,` and `mixed,`.
- In `renderBuiltin`, the `prefFieldProps` call becomes
  `prefFieldProps(pref, { value, mixed: ctx.mixed, siblings, setValue, fields: ctx.fields })`.
- Every other place that builds a `PrefRenderContext` (the `renderValue` spread in the map branch spreads `ctx`, so it carries `mixed`; `ObjectLeaf` and `ListLeaf` build contexts for their fields and items) sets `mixed: false`. Typecheck finds them all, since the field is required.

- [ ] **Step 4: Run, typecheck, commit**

Run the test file. Expected: PASS. If the text control still shows `a`, the string branch of `prefFieldProps` ignores `mixed`; make that branch read `value: mixed ? '' : …` the way its number branch does, and say so in the commit body.

Run: `npm run typecheck`. Expected: clean. labkit's `ControlPanel` and `SelectionPanel` build render contexts of their own types and should be untouched; if typecheck names them, they construct a `PrefRenderContext` and need `mixed: false`.

```bash
git commit -m "let a preferences form draw leaves whose values disagree" -- packages/ui/src/components/Prefs/PrefsForm.tsx packages/ui/src/components/Prefs/PrefsRow.tsx packages/ui/src/components/Prefs/PrefsForm.mixed.test.tsx
```

Add any other file typecheck made you touch to the commit's path list.

### Task 6: The attribute aggregator

**Files:**
- Create: `PrefSchemaEditor/attrAggregate.ts`
- Test: `PrefSchemaEditor/attrAggregate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { aggregateAttributes, sameValue } from './attrAggregate';
import { attributeSchema } from './kindSchemas';

const num = (over: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name: 'N', description: 'd', default: 1, min: 0, ...over }) as PrefLeaf;
const bool: PrefLeaf = { kind: 'boolean', name: 'B', description: 'd', default: false };
const group: PrefGroup = { name: 'G', children: {} };

describe('sameValue', () => {
  it('compares structure, not identity', () => {
    expect(sameValue([{ a: 1 }], [{ a: 1 }])).toBe(true);
    expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
  });
});

describe('aggregateAttributes', () => {
  it('is the node\'s own schema for one node', () => {
    const one = aggregateAttributes([num()]);
    expect(one.schema).toEqual(attributeSchema(num()));
    expect(one.mixed.size).toBe(0);
    expect(one.kind).toBe('number');
  });

  it('keeps an attribute the nodes agree on, and marks one they do not', () => {
    const both = aggregateAttributes([num(), num({ name: 'Other', min: 5 })]);
    expect(both.values.description).toBe('d');
    expect(both.mixed.has('name')).toBe(true);
    expect(both.mixed.has('min')).toBe(true);
    expect(both.mixed.has('description')).toBe(false);
    expect('name' in both.values).toBe(false);
  });

  it('keeps only the attributes every kind has when the kinds differ', () => {
    const both = aggregateAttributes([num(), bool]);
    expect(Object.keys(both.schema.shared)).toContain('name');
    expect(both.schema.own).not.toHaveProperty('min');
    expect(both.kind).toBeNull();
  });

  it('says there is no kind when a group is among them', () => {
    const both = aggregateAttributes([num(), group]);
    expect(both.kind).toBeUndefined();
    expect(Object.keys(both.schema.shared)).toContain('name');
    expect(both.schema.own).toEqual({});
  });
});
```

`kind` is the shared leaf kind, `null` when every node is a leaf and the kinds differ, and `undefined` when any node is not a leaf.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/PrefSchemaEditor/attrAggregate.test.ts`
Expected: FAIL, cannot resolve `./attrAggregate`.

- [ ] **Step 3: Implement**

```ts
import { isPrefLeaf } from '@weasel-js/prefs';
import { attributeSchema, type AttributeSchema, type CustomKinds, type KindAttrs } from './kindSchemas';
import type { SchemaNode } from './schemaEdit';

/** Whether two attribute values hold the same thing. Functions and class instances compare by identity. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const tag = Object.prototype.toString.call(a);
  if (tag !== Object.prototype.toString.call(b)) return false;
  if (tag === '[object Array]') {
    const [x, y] = [a as unknown[], b as unknown[]];
    return x.length === y.length && x.every((v, i) => sameValue(v, y[i]));
  }
  if (tag !== '[object Object]') return false;
  const [x, y] = [a as Record<string, unknown>, b as Record<string, unknown>];
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every((k) => Object.hasOwn(y, k) && sameValue(x[k], y[k]));
}

/** Attribute kinds whose control cannot show several values at once, so a disagreement is listed and not edited. */
const WHOLE = new Set(['list', 'map', 'object', 'union']);

/** Several nodes' attributes as one form. */
export interface AttributeAggregate {
  /** The attributes every node has, each with one definition. */
  schema: AttributeSchema;
  /** Each agreed attribute's value. A mixed one has no entry. */
  values: Record<string, unknown>;
  /** The attributes in `schema` whose values disagree. */
  mixed: ReadonlySet<string>;
  /** Attributes every node has whose values disagree and cannot be edited together. */
  apart: readonly string[];
  /** The leaf kind every node has; `null` when all are leaves of differing kinds; `undefined` when any is not a leaf. */
  kind: string | null | undefined;
}

/**
 * The attributes `nodes` share, as {@link attributeSchema} gives them for one. `drawsMixed` says whether an
 * attribute kind's control has a mixed state; one that does not is left out when its values disagree.
 */
export function aggregateAttributes(
  nodes: readonly SchemaNode[], custom: CustomKinds = {}, drawsMixed: (kind: string) => boolean = (k) => !WHOLE.has(k),
): AttributeAggregate {
  const [first, ...rest] = nodes.map((n) => attributeSchema(n, custom));
  const held = nodes.map((n) => n as unknown as Record<string, unknown>);
  const values: Record<string, unknown> = {};
  const mixed = new Set<string>();
  const apart: string[] = [];
  const common = (part: 'shared' | 'own' | 'auto'): KindAttrs => {
    const out: KindAttrs = {};
    for (const [key, def] of Object.entries(first![part])) {
      if (!rest.every((s) => sameValue(s[part][key], def))) continue;
      if (held.every((h) => sameValue(h[key], held[0]![key]))) {
        out[key] = def;
        if (held[0]![key] !== undefined) values[key] = held[0]![key];
      } else if (drawsMixed(def.kind)) {
        out[key] = def;
        mixed.add(key);
      } else {
        apart.push(key);
      }
    }
    return out;
  };
  const schema: AttributeSchema = {
    shared: common('shared'),
    own: common('own'),
    auto: common('auto'),
    readOnly: first!.readOnly.filter(([k, v]) => rest.every((s) => s.readOnly.some(([k2, v2]) => k2 === k && sameValue(v2, v)))),
  };
  const kinds = nodes.map((n) => (isPrefLeaf(n) ? n.kind : undefined));
  const kind = kinds.includes(undefined) ? undefined : kinds.every((k) => k === kinds[0]) ? kinds[0]! : null;
  return { schema, values, mixed, apart, kind };
}
```

`Object.prototype.toString` and not `instanceof`: each jsdom test file runs in its own realm.

- [ ] **Step 4: Run and watch them pass, then commit**

```bash
git commit -m "gather several schema nodes' attributes into one form, marking where they disagree" -- packages/ui/src/components/PrefSchemaEditor/attrAggregate.ts packages/ui/src/components/PrefSchemaEditor/attrAggregate.test.ts
```

### Task 7: `AttributesPane` over a list of paths

**Files:**
- Modify: `PrefSchemaEditor/AttributesPane.tsx`, `PrefSchemaEditor/attrRenderers.tsx`, `PrefSchemaEditor/PrefSchemaEditor.tsx`
- Test: `PrefSchemaEditor/PrefSchemaEditor.multi.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to the `describe` in `PrefSchemaEditor.multi.test.tsx` (add `act` to the testing-library import if the undo assertion needs it):

```tsx
  const pickTwo = () => {
    fireEvent.click(row('grid'));
    fireEvent.click(row('snap'), { metaKey: true });
  };
  const field = (name: string) => within(attributes()).getByRole('textbox', { name });

  it('shows a value the nodes share, and none where they differ', () => {
    render(<Live />);
    pickTwo();
    expect(field('Name')).toHaveValue('');
    expect(field('Name')).toHaveAttribute('placeholder', 'Mixed');
    expect(within(attributes()).queryByRole('textbox', { name: 'Key' })).toBeNull();
  });

  it('writes an edit to every selected node, as one step back', () => {
    render(<Live />);
    pickTwo();
    fireEvent.change(field('Description'), { target: { value: 'Both.' } });
    fireEvent.click(row('grid'));
    expect(field('Description')).toHaveValue('Both.');
    fireEvent.click(row('snap'));
    expect(field('Description')).toHaveValue('Both.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(row('grid'));
    expect(field('Description')).toHaveValue('Draw the grid.');
  });

  it('leaves the keys alone when several nodes are named at once', () => {
    render(<Live />);
    pickTwo();
    fireEvent.focus(field('Name'));
    fireEvent.change(field('Name'), { target: { value: 'Same' } });
    fireEvent.blur(field('Name'));
    expect(row('grid')).toBeInTheDocument();
    expect(row('snap')).toBeInTheDocument();
  });

  it('offers only what every kind has when the kinds differ', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('zoom'), { metaKey: true });
    expect(field('Name')).toBeInTheDocument();
    expect(within(attributes()).queryByText('Minimum')).toBeNull();
  });
```

Before trusting the last test, select `zoom` alone in the running test (or read `kindSchemas.ts`) and use the label the `min` attribute actually shows in place of `'Minimum'`. If the description field's accessible name is not `Description`, use the real one. An assertion that names a label nothing draws passes for the wrong reason.

- [ ] **Step 2: Run and watch them fail**

Expected: FAIL. With two selected the pane shows only its header, so `field('Name')` throws.

- [ ] **Step 3: `attrRenderers.tsx`**

`OptionalNumber` gains a mixed state: `const shown = ctx.mixed || ctx.value === undefined ? '' : String(ctx.value);` and `placeholder={ctx.mixed ? 'Mixed' : undefined}` on its `Input`.

Export which of the editor's attribute kinds can show a disagreement:

```ts
/** Kinds drawn here whose control has a mixed state. The rest are listed, not edited, when values disagree. */
export const MIXED_ATTR_KINDS: ReadonlySet<string> = new Set([/* the key ATTR_RENDERERS files OptionalNumber under */]);
```

Fill the set with the one key `ATTR_RENDERERS` maps to `OptionalNumber`; read it from the bottom of the file.

- [ ] **Step 4: `AttributesPane.tsx`**

Props: `path: string | null` becomes `paths: readonly string[]` (empty is the root); `added` stays and means the one selected node is new.

Body, replacing from `const node = nodeAt(schema, path);` down to the `children` map:

```ts
  const targets: ReadonlyArray<string | null> = paths.length === 0 ? [null] : paths;
  const nodes = targets.map((p) => nodeAt(schema, p)).filter((n): n is SchemaNode => n !== undefined);
  const path = targets.length === 1 ? targets[0]! : null;
  const several = targets.length > 1;
```

- Keep the `key`, `keyError`, and `seen` state keyed on `path` as now. With several selected `path` is `null` and the Key row is not drawn.
- `if (nodes.length !== targets.length || nodes.length === 0) return <empty pane>;`
- `const node = nodes[0]!;` for the single-node code (`commitKey`, `followName`), which runs only when `!several`.
- Aggregate:

```ts
  const drawsMixed = (kind: string) => (kind in ATTR_RENDERERS ? MIXED_ATTR_KINDS.has(kind) : !['list', 'map', 'object', 'union'].includes(kind));
  const agg = useMemo(() => aggregateAttributes(nodes, custom, drawsMixed), [schema, paths, custom]);
  const { shared, own, auto, readOnly } = agg.schema;
  const held = agg.values;
  const noAutoValue = !agg.mixed.has('autoValue') && held.autoValue === undefined;
```

  Move the `useMemo` above the early return, and compute `nodes` inside it, so hooks run in one order. Export the list `['list', 'map', 'object', 'union']` from `attrAggregate.ts` as `WHOLE` and use it here rather than writing it twice.
- `leaf` becomes `agg.kind !== undefined`. `keyed` becomes `!several && path !== null && !(above && holdsFixed(above))`. `anyKind` becomes: every node is a leaf whose parent is not a union.
- One writer for every edit:

```ts
  const writeAll = (attr: string, value: unknown) =>
    onChange(targets.reduce<SchemaRoot>((root, p) => setAttribute(root, p, attr, value), schema));
```

  `PrefsForm`'s `onChange` and `onAutoChange` call `writeAll` in place of `setAttribute(schema, path, …)`.
- Name renderer: `value={ctx.mixed ? '' : String(value ?? '')}`, `placeholder={ctx.mixed ? 'Mixed' : undefined}`, and `onBlur={several ? undefined : followName}`. Take `mixed` from the render context.
- Kind renderer:

```tsx
    [KIND_KIND]: () => (
      <Select aria-label="Kind" selectedKey={agg.kind ?? null} placeholder="Mixed"
        options={kinds.map((k) => ({ value: k, label: k }))}
        onSelectionChange={(k) => {
          const dropped = new Set<string>();
          const next = targets.reduce<SchemaRoot>((root, p) => {
            const changed = changeKind(root, p!, String(k), custom);
            changed.dropped.forEach((d) => dropped.add(d));
            return changed.root;
          }, schema);
          onChange(next);
          onNotice(dropped.size ? `Dropped on kind change: ${[...dropped].join(', ')}` : null);
        }} />
    ),
```

- The own panel's heading: `name: agg.kind === undefined ? 'group' : agg.kind ?? 'Common'`. The panel is drawn only when `own` holds something, as now, so kinds with nothing in common show no heading.
- Header: `<PaneHeader title={several ? `${targets.length} selected` : 'Attributes'} />`.
- `PrefsForm`:

```tsx
        values={{ ...held, [OWN]: held, [AUTO]: noAutoValue ? { ...held, autoValue: held.default } : held }}
        mixed={mixedPaths}
```

  with

```ts
  const mixedPaths = useMemo(() => new Set([...agg.mixed].flatMap((k) => [k, `${OWN}.${k}`, `${AUTO}.${k}`])), [agg]);
```

- Read-only list: after the existing rows, one row per `agg.apart` entry: `<DetailRow key={k} label={k}><Code size="xs" status="muted">mixed</Code></DetailRow>`. Draw the `DetailList` when `readOnly.length + agg.apart.length > 0`.

- [ ] **Step 5: `PrefSchemaEditor.tsx`**

Replace the interim branch from Task 4 with one pane:

```tsx
        <AttributesPane schema={schema} paths={selection.paths} onRekey={rekey}
          onChange={(next) => commit(next, `attr:${[...selection.paths].sort().join(',')}`)}
          added={selection.paths.length === 1 && changes.some((c) => c.op === 'add' && c.path === selection.lead)}
          kinds={kindList} custom={custom} renderers={renderers} onNotice={setNotice} />
```

Remove the now-unused `PaneHeader` import.

- [ ] **Step 6: Run everything in the directory**

Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/PrefSchemaEditor/`
Expected: PASS, every file. `PrefSchemaEditor.keyFollows.test.tsx`, `.auto.test.tsx`, and `.compound.test.tsx` cover the one-node path this task rewired; a failure there is a regression in this task.

- [ ] **Step 7: Typecheck and commit**

```bash
git commit -m "edit the attributes several schema nodes share, writing each edit to all of them" -- packages/ui/src/components/PrefSchemaEditor/AttributesPane.tsx packages/ui/src/components/PrefSchemaEditor/attrRenderers.tsx packages/ui/src/components/PrefSchemaEditor/attrAggregate.ts packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.tsx packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.multi.test.tsx
```

---

## Step 3 of the spec: the live preview

### Task 8: `PrefsForm` marks several rows and reports a toggle

**Files:**
- Modify: `Prefs/selection.ts`, `Prefs/PrefsForm.tsx`, `Prefs/PrefsRow.tsx`, `Prefs/RailLayout.tsx`, `Prefs/PrefsPane.tsx`, and any layout that spreads `selection` onto its root (`FlatLayout`)
- Test: create `Prefs/PrefsForm.selection.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from './index';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    a: { kind: 'string', name: 'Alpha', description: '', default: '' },
    b: { kind: 'string', name: 'Beta', description: '', default: '' },
    c: { kind: 'string', name: 'Gamma', description: '', default: '' },
  },
};
const rowOf = (label: string) => screen.getByText(label).closest('[data-pref-path]')!;
const form = (selected: readonly string[], onSelect = vi.fn()) => {
  render(<PrefsForm schema={SCHEMA} values={{}} onChange={vi.fn()} layout="list" selected={selected} onSelect={onSelect} />);
  return onSelect;
};

describe('PrefsForm selection', () => {
  it('marks every selected row', () => {
    form(['a', 'c']);
    expect(rowOf('Alpha')).toHaveAttribute('data-selected');
    expect(rowOf('Beta')).not.toHaveAttribute('data-selected');
    expect(rowOf('Gamma')).toHaveAttribute('data-selected');
  });

  it('reports a plain press as a pick and a Cmd or Ctrl press as a toggle', () => {
    const onSelect = form(['a']);
    fireEvent.pointerDown(rowOf('Beta'));
    expect(onSelect).toHaveBeenLastCalledWith('b', { toggle: false });
    fireEvent.pointerDown(rowOf('Gamma'), { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('c', { toggle: true });
    fireEvent.pointerDown(rowOf('Alpha'), { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('a', { toggle: true });
  });

  it('does not report the focus that follows a press on the same row', () => {
    const onSelect = form(['a', 'b']);
    fireEvent.pointerDown(rowOf('Beta'), { metaKey: true });
    fireEvent.focus(screen.getByRole('textbox', { name: 'Beta' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('holds a press on one of several selected rows until the click, then picks that row alone', () => {
    const onSelect = form(['a', 'b']);
    fireEvent.pointerDown(rowOf('Alpha'));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(rowOf('Alpha'));
    expect(onSelect).toHaveBeenLastCalledWith('a', { toggle: false });
  });

  it('reports nothing for a press on the only selected row', () => {
    const onSelect = form(['a']);
    fireEvent.pointerDown(rowOf('Alpha'));
    fireEvent.click(rowOf('Alpha'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/Prefs/PrefsForm.selection.test.tsx`
Expected: FAIL. `selected` given a list marks nothing, and `onSelect` is called with one argument.

- [ ] **Step 3: `selection.ts`**

```ts
/** What a form marks while it draws: the selection. */
export interface PrefMarks {
  selected?: readonly string[];
}
```

In `selectionAttrs`: `'data-selected': path !== '' && marks.selected?.includes(path) ? '' : undefined,`.

Export the callback's second argument:

```ts
/** How a row was picked. */
export interface PrefSelectHow {
  /** Cmd or Ctrl was held: the row joins or leaves the selection. */
  toggle: boolean;
}
```

`useSelectedRow` becomes:

```ts
export interface SelectionRoot {
  ref: RefObject<HTMLDivElement | null>;
  onPointerDown?: (e: PointerEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  onClick?: (e: MouseEvent) => void;
}

/**
 * Props for a form's root element: they scroll `shown` into view each time the last of `selected` changes, and
 * report the row or group the reader presses or focuses into, a group's rail entry included.
 */
export function useSelectedRow(
  selected: readonly string[],
  shown: string | null,
  onSelect: ((path: string, how: PrefSelectHow) => void) | undefined,
): SelectionRoot {
  const ref = useRef<HTMLDivElement | null>(null);
  const pending = useRef(false);
  const reported = useRef<string | null>(null);
  const lead = selected.at(-1);
  useEffect(() => {
    // A selection the reader made here is already under their pointer; scrolling it would move it mid-click.
    pending.current = lead !== undefined && lead !== reported.current;
    reported.current = null;
  }, [lead]);
  // (the every-render scroll effect is unchanged)
  // A press on one of several selected rows waits for the click: it may be the start of a drag of them all.
  const held = useRef<string | null>(null);
  // The focus that follows a press is the same pick, not a second one.
  const pressed = useRef<string | null>(null);
  if (onSelect === undefined) return { ref };
  const pathAt = (e: { target: EventTarget }): string | null => {
    const el = (e.target as Element).closest?.(`[${PATH_ATTR}], [${RAIL_ATTR}]`);
    return el?.getAttribute(PATH_ATTR) ?? el?.getAttribute(RAIL_ATTR) ?? null;
  };
  const report = (path: string, toggle: boolean): void => {
    reported.current = path;
    onSelect(path, { toggle });
  };
  return {
    ref,
    onPointerDown: (e) => {
      const path = pathAt(e);
      held.current = null;
      pressed.current = path;
      if (path === null) return;
      if (e.metaKey || e.ctrlKey) report(path, true);
      else if (!selected.includes(path)) report(path, false);
      else if (selected.length > 1) held.current = path;
    },
    onClick: (e) => {
      const path = held.current;
      held.current = null;
      pressed.current = null;
      if (path !== null && pathAt(e) === path) report(path, false);
    },
    onFocus: (e) => {
      const path = pathAt(e);
      if (path === null || path === pressed.current || selected.includes(path)) return;
      report(path, false);
    },
  };
}
```

Import `MouseEvent` from `react` with the other event types.

- [ ] **Step 4: `PrefsForm.tsx`, `PrefsRow.tsx`, the layouts**

`PrefsFormProps`:

```ts
  /** Dotted paths of the leaves and groups to mark. Each time the last one
   *  changes the form brings it into view, and a rail opens the group that
   *  holds it. A path the form does not draw marks nothing. */
  selected?: readonly string[];
  /** The reader pressed or focused into a leaf's row, a group, or a group's
   *  entry in a rail. The empty path is the root, from the rail entry for its
   *  own leaves. `how.toggle` is true when Cmd or Ctrl was held. */
  onSelect?: (path: string, how: PrefSelectHow) => void;
```

Body:

```ts
const NO_SELECTION: readonly string[] = [];
…
  const selected = props.selected ?? NO_SELECTION;
  const shown = useMemo(
    () => selected.map((p) => shownPath(root, p)).filter((p): p is string => p !== null),
    [root, selected],
  );
  const lead = shown.at(-1) ?? null;
  const selection = useSelectedRow(selected, lead, props.onSelect);
  const ctx: WalkCtx = { values, onChange, renderers, auto, mixed: props.mixed, onAutoChange, canInherit, inheritHint, fields, selected: shown, lead };
```

`WalkCtx` in `PrefsRow.tsx`:

```ts
  /** Paths of the rows and groups the form marks as selected. */
  selected?: readonly string[];
  /** The one of `selected` the form brings into view and opens the page of. */
  lead?: string | null;
```

`RailLayout.tsx` line 77 and `PrefsPane.tsx` lines 158 to 161 read `ctx.selected` as the one path to open; each becomes `ctx.lead`. `RailLayout`'s effect on `[props.selected]` becomes `[props.ctx.lead]`. Wherever a layout spreads `selection.onPointerDown` and `selection.onFocus` onto its root, spread `selection.onClick` too.

Export `PrefSelectHow` from `Prefs/index.ts` and from wherever the package barrel re-exports `PrefsFormProps`.

- [ ] **Step 5: Fix the callers**

Run: `npm run typecheck`. It names every caller passing a string. Known ones:

- `PrefSchemaEditor/PreviewPane.tsx`: handled in Task 9; for now pass `selected={selected === null ? undefined : [keysOf(selected).join('.')]}` wrapped in `useMemo` on `selected`, so the list keeps its identity between renders.
- `packages/labkit/src/specimen/Specimen.tsx:795` passes `onSelect={setBand}`: check whether that element is a `PrefsForm`. If it is, a one-argument function still fits the new type; no change.
- `Prefs.stories.tsx` and any test that passes `selected="…"`: wrap in a list.

An inline `selected={[x]}` makes a new list every render and re-runs the form's memo; that is correct but wasteful, so memoize it at each caller.

- [ ] **Step 6: Run, then commit**

Run the new test file, then `npx vitest run --project=weasel-ui --reporter=default packages/ui/src/components/Prefs/`. Expected: PASS.

```bash
git commit -m "mark several selected rows in a preferences form, and report a Cmd or Ctrl press as a toggle" -- packages/ui/src/components/Prefs packages/ui/src/components/PrefSchemaEditor/PreviewPane.tsx
```

Add any other caller typecheck made you touch.

### Task 9: The preview selects and drags several

**Files:**
- Modify: `PrefSchemaEditor/PreviewPane.tsx`, `PrefSchemaEditor/usePreviewDrag.ts`, `PrefSchemaEditor/PrefSchemaEditor.tsx`, `PrefSchemaEditor/previewDrop.test.ts`
- Test: `PrefSchemaEditor/PrefSchemaEditor.multi.test.tsx`, and create `PrefSchemaEditor/PrefSchemaEditor.multi.browser.test.tsx`

- [ ] **Step 1: Pin what the drop helpers do with several nodes**

These take lists and have only been called with one node. Append to `previewDrop.test.ts`, reusing that file's schema fixture (read it first and name real paths; the names below assume a root with a page `view` holding leaves `grid` and `snap`, and a page `panels`):

```ts
  it('lands several leaves from two parents together', () => {
    const nodes = [nodeAt(SCHEMA, 'view/grid')!, nodeAt(SCHEMA, 'panels/dock')!];
    expect(previewTarget(SCHEMA, { path: 'view.snap', where: 'after' }, nodes, ['view/grid', 'panels/dock']))
      .toEqual({ parentPath: 'view', index: 2 });
  });

  it('refuses the whole drag when one node does not fit', () => {
    const nodes = [nodeAt(SCHEMA, 'view/grid')!, nodeAt(SCHEMA, 'panels')!];
    expect(previewTarget(SCHEMA, { path: 'view.snap', where: 'after' }, nodes, ['view/grid', 'panels'], 1)).toBeNull();
  });

  it('draws every dragged node, each from its own place', () => {
    const nodes = [nodeAt(SCHEMA, 'view/grid')!, nodeAt(SCHEMA, 'panels/dock')!];
    expect(previewDrop({ path: 'view.snap', where: 'after' }, nodes, ['view/grid', 'panels/dock']).from).toEqual(['view.grid', 'panels.dock']);
  });
```

Run the file. These may pass as written: they record behavior, and a failure is a bug to fix in `previewDrop.ts` before going on. The second test's last argument is `maxDepth`; if `view` already sits at depth 1 a page dropped into it must be refused. Adjust the expected index in the first test to the fixture's real child order.

- [ ] **Step 2: Write the failing jsdom tests**

Append to `PrefSchemaEditor.multi.test.tsx`:

```tsx
  const preview = () => screen.getByRole('region', { name: 'Live preview' });
  const previewRow = (label: string) => within(preview()).getByText(label).closest('[data-pref-path]')!;

  it('marks every selected node in the preview', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('snap'), { metaKey: true });
    expect(previewRow('Show grid')).toHaveAttribute('data-selected');
    expect(previewRow('Snap')).toHaveAttribute('data-selected');
  });

  it('adds a preview row to the selection with Cmd held', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.pointerDown(previewRow('Snap'), { metaKey: true });
    expect(item('grid')).toHaveAttribute('aria-selected', 'true');
    expect(item('snap')).toHaveAttribute('aria-selected', 'true');
    fireEvent.pointerDown(previewRow('Show grid'), { metaKey: true });
    expect(item('grid')).toHaveAttribute('aria-selected', 'false');
  });
```

Run. Expected: FAIL; only the lead is marked, and a Cmd-press replaces the selection.

- [ ] **Step 3: `PreviewPane.tsx`**

Props: `selected?: readonly string[]` (tree paths) and `onSelect?: (path: string | null, how: PrefSelectHow) => void`. In `GroupPreview`:

```tsx
  // Under a group root every key is one step of the value path, so the two paths differ only in their separator.
  const marked = useMemo(() => selected.map((p) => keysOf(p).join('.')), [selected]);
  …
        selected={marked}
        onSelect={onSelect && ((path, how) => onSelect(path === '' ? null : pathOf(path.split('.')), how))}
```

Confirm `PrefsDialog` forwards `selected` and `onSelect` to `PrefsForm` with their new types; it does today for the old ones.

- [ ] **Step 4: `PrefSchemaEditor.tsx`**

```tsx
      <PreviewPane … selected={selection.paths}
        onSelect={(path, how) => {
          // The root's own entry names no node to add to a selection.
          if (how.toggle && path !== null) { selection.toggle(path); setNotice(null); }
          else reveal(path === null ? [] : [path]);
        }} … />
```

`selection.toggle` opens the branches above the node (Task 2), so the tree shows a row added from the preview.

Run the multi test file. Expected: PASS.

- [ ] **Step 5: `usePreviewDrag.ts` carries the selection**

Add `selected(): readonly string[]` to the options. After `node` is found:

```ts
    const chosen = selected();
    // One of several selected rows carries them all; any other row goes alone.
    const paths = chosen.length > 1 && chosen.includes(path) ? carried(schema(), chosen) : [path];
    if (paths.some((p) => isFixed(schema(), p))) return;
    const nodes = paths.map((p) => nodeAt(schema(), p)!);
```

Then `held` returns `ev.altKey ? [] : paths`; `place.over(nodes, held(ev), …)`; `place.target(nodes, held(ev), …)`; `(ev.altKey ? onCopy : onMove)(paths, to)`. `PreviewGhost` gains `count: number`, set to `paths.length`. Import `carried` and `isFixed`.

In `PrefSchemaEditor.tsx`, pass `selected: () => latest.current.paths` to `usePreviewDrag`.

In `PreviewPane.tsx`, beside the `NodeGhost` inside `DragGhost`, draw the count when it is more than one:

```tsx
{ghost.count > 1 && <Badge size="xs" className={s.ghostCount}>{ghost.count}</Badge>}
```

Add `.ghostCount` to `PrefSchemaEditor.module.css`: `position: absolute; top: -6px; right: -6px; font-variant-numeric: tabular-nums;`, and make sure the ghost's wrapper is `position: relative`.

`usePreviewDrag`'s `onClick` already ends the session for a release that was not a drag. `PrefsForm`'s own click handler (Task 8) collapses a held press, but `startThresholdDrag` holds the pointer, so the form may never see that click. In `onClick`, after `end()`, call a new option `onPick(path)` when `chosen.length > 1 && chosen.includes(path)`, and have the editor pass `onPick: (p) => reveal([p])`. The browser test below is what proves which of the two paths fires; keep both, since the form must also work with no drag hook around it.

- [ ] **Step 6: The browser test**

Create `PrefSchemaEditor.multi.browser.test.tsx`. Read `PrefSchemaEditor.copy.browser.test.tsx` first and reuse its render, its way of finding rows, and its pointer-driving helper exactly; it drives a real drag through this editor already. The cases, each with its assertion:

1. Cmd-click two preview rows (`userEvent.click(el, { modifiers: ['Meta'] })` or the helper's equivalent): both carry `data-selected`, and the attributes pane's header reads `2 selected`.
2. With two leaves of `view` selected, press one in the preview and release without moving: only that one is selected afterward.
3. With two leaves of `view` selected, drag one's label onto the `panels` rail entry and release: both keys are now under `panels` in the structure tree, in their original order, and both are selected.
4. With two rows selected in the structure tree, drag one onto a preview row in another group: both land there. This is the first time a tree drag hands `DropOutside` more than one node.

Run: `npx vitest run --project=browser --reporter=default packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.multi.browser.test.tsx`
Expected: PASS. Watch each fail first by commenting out the `carried` line in `usePreviewDrag.ts` (cases 2 and 3) before trusting it.

- [ ] **Step 7: Run the directory, typecheck, commit**

```bash
git commit -m "select and drag several nodes from the schema editor's live preview" -- packages/ui/src/components/PrefSchemaEditor
```

---

### Task 10: Stories, changeset, and the TODO list

**Files:**
- Modify: `Prefs/Prefs.stories.tsx`, `PrefSchemaEditor/PrefSchemaEditor.stories.tsx`, `docs/TODO.md`
- Create: `.changeset/schema-editor-multiselect.md`

- [ ] **Step 1: Stories**

In `Prefs.stories.tsx`, add a story `SeveralSelected`: a `PrefsForm` with `selected` holding two paths on one page and `mixed` holding one of them. In `PrefSchemaEditor.stories.tsx`, add a story `SeveralSelected` whose blurb says: Cmd-click or Shift-click rows in the tree, or Cmd-click rows in the preview, then edit, drag, or delete them together. Follow each file's existing story shape. Do not set `data-theme` or wrap in a mode decorator.

- [ ] **Step 2: Changeset**

Read `.changeset/prefs-form-selection.md` for the frontmatter's package list and its voice. Write `.changeset/schema-editor-multiselect.md` with every package at `patch`, saying in prose:

- `PrefSchemaEditor` selects several nodes: Cmd/Ctrl and Shift in the tree, Cmd/Ctrl in the preview. They move, copy, and remove together, and the attributes pane edits what they share.
- `PrefsForm` and `PrefsDialog`: `selected` is now a list of paths, the last one brought into view. `onSelect` gains a second argument, `{ toggle }`. New `mixed` set of paths; `PrefRenderContext` gains `mixed`. Say plainly that `selected` changed shape and a caller passing a string must pass a list.
- `Tree` rows carry `data-tree-id`.

Run: `npm run check:bumps`. Expected: passes. Never write a `bump-approved` marker.

- [ ] **Step 3: `docs/TODO.md`**

Search it for `PrefSchemaEditor`. Add one P3 entry for each thing the spec leaves out and nothing tracks: dragging several nodes out of the Unplaced tree or the palette; select-all (Mod+A) in `Tree`. If an existing entry now reads wrong (the "properties-panel preview ignores the selection" one still stands), rewrite it around what is left.

- [ ] **Step 4: Look at it in a browser, headless**

The attributes pane's header and the ghost's count are new boxes that jsdom cannot lay out. Start the site dev server from this worktree with `WAKE_EXTRA=<a free port>` in the background, open the editor's story with the headless playwright MCP, select three rows, and screenshot at 1x. Send the screenshot to the wall with `transom post`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git commit -m "stories and changeset for selecting several nodes in the schema editor" -- packages/ui/src/components/Prefs/Prefs.stories.tsx packages/ui/src/components/PrefSchemaEditor/PrefSchemaEditor.stories.tsx .changeset/schema-editor-multiselect.md docs/TODO.md
```

- [ ] **Step 6: Hand back**

Do not push and do not merge without being asked. When the branch does merge: delete this plan and its spec in the same change, start the full suite on the fleet with `onto test` in the background, switch back to `main`, and remove this worktree and branch.
