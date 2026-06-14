# Bundle Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only catalog browser at `#/dev/registry` in `apps/swillustrator` that lets you browse every tool, action, shape kind, bundle, icon, op factory, and public export the weasel kit registers — with a categorized tree, bundle filter, text filter, and per-leaf detail pane.

**Architecture:** New page sibling to `ToolkitBuilder`, mounted from `apps/swillustrator/src/main.tsx` on `#/dev/registry`. Data is collected by a hybrid pipeline: a hidden `<SceneCanvas>` provides runtime introspection of tools/actions/bundles (via `useActionsRegistry` + the synthesized `ToolsApi`), while barrel imports from `@weasel-js/core` and `apps/swillustrator/src/*Icons.tsx` cover icons, op factories, and public exports. Source-file paths and JSDoc snippets are pulled lazily on selection through a Vite `import.meta.glob` of raw source.

**Tech Stack:** React, TypeScript, Vite, CSS modules, `@weasel-js/core`, `@weasel-js/core/routing`, Vitest + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-05-16-bundle-inspector-design.md`.

---

## File Structure

**Created:**
- `apps/swillustrator/src/dev/RegistryInspector.tsx` — top-level page component
- `apps/swillustrator/src/dev/RegistryInspector.module.css` — styles (mirrors ToolkitBuilder pattern)
- `apps/swillustrator/src/dev/registryData.ts` — types + static collectors (icons, bundles, op factories, exports)
- `apps/swillustrator/src/dev/registryData.test.ts` — unit tests for the static collectors
- `apps/swillustrator/src/dev/registryProbe.tsx` — hidden `<SceneCanvas>` probe + runtime collector
- `apps/swillustrator/src/dev/registryProbe.test.tsx` — runtime collector test
- `apps/swillustrator/src/dev/RegistryTree.tsx` — left-pane tree component with text filter
- `apps/swillustrator/src/dev/RegistryTree.test.tsx` — tree behavior tests
- `apps/swillustrator/src/dev/RegistryDetail.tsx` — right-pane detail dispatcher
- `apps/swillustrator/src/dev/RegistryInspector.test.tsx` — integration smoke test
- `apps/swillustrator/src/dev/sourceLookup.ts` — lazy JSDoc/path loader (`import.meta.glob` over `src/**`)
- `apps/swillustrator/src/dev/sourceLookup.test.ts` — JSDoc extraction tests

**Modified:**
- `apps/swillustrator/src/main.tsx` — add `#/dev/registry` route case

**Boundaries:**
- `registryData.ts` is pure TS — no React, no runtime probing. Static collectors and types.
- `registryProbe.tsx` is the only file that mounts a `<SceneCanvas>` for introspection. It exposes a hook (`useRuntimeEntries`) consumed by `RegistryInspector.tsx`.
- `RegistryTree.tsx` consumes a finished `TreeNode[]` shape; it does not know about runtime vs static sources.
- `RegistryDetail.tsx` receives a single `TreeEntry` and dispatches on `entry.kind`.

---

## Task 1: Route & page shell

**Files:**
- Create: `apps/swillustrator/src/dev/RegistryInspector.tsx`
- Create: `apps/swillustrator/src/dev/RegistryInspector.module.css`
- Create: `apps/swillustrator/src/dev/RegistryInspector.test.tsx`
- Modify: `apps/swillustrator/src/main.tsx:36`

- [ ] **Step 1: Write the failing integration test**

Create `apps/swillustrator/src/dev/RegistryInspector.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ActionsProvider, SelectionContextProvider } from '@weasel-js/core';
import { RegistryInspector } from './RegistryInspector';

describe('RegistryInspector', () => {
  it('renders the page heading', () => {
    render(
      <ActionsProvider>
        <SelectionContextProvider>
          <RegistryInspector />
        </SelectionContextProvider>
      </ActionsProvider>,
    );
    expect(screen.getByRole('heading', { name: /bundle inspector/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryInspector.test.tsx`
Expected: FAIL — module `./RegistryInspector` not found.

- [ ] **Step 3: Create the minimal page shell**

Create `apps/swillustrator/src/dev/RegistryInspector.module.css`:

```css
.root {
  font-family: system-ui, sans-serif;
  color: var(--wzl-fg, #d4c4a8);
  background: var(--wzl-bg, #1e1610);
  min-height: 100vh;
  padding: 16px 20px;
  box-sizing: border-box;
}
.header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 16px; }
.title { margin: 0; font-size: 20px; font-weight: 600; flex: 1; }
.layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.tree, .detail {
  background: var(--wzl-surface, #2a2018);
  border-radius: 6px;
  padding: 12px;
  min-width: 0;
}
.filterInput {
  width: 100%;
  background: var(--wzl-bg, #1e1610);
  color: var(--wzl-fg, #d4c4a8);
  border: 1px solid var(--wzl-panel-border, #4a3c2e);
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
  font-family: inherit;
  box-sizing: border-box;
  margin-bottom: 8px;
}
.bundlePicker { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--wzl-muted, #a59685); }
.bundlePicker select {
  background: var(--wzl-bg, #1e1610);
  color: var(--wzl-fg, #d4c4a8);
  border: 1px solid var(--wzl-panel-border, #4a3c2e);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  font-family: inherit;
}
.empty { color: var(--wzl-muted, #a59685); font-size: 13px; font-style: italic; }
```

Create `apps/swillustrator/src/dev/RegistryInspector.tsx`:

```tsx
import { useEffect } from 'react';
import s from './RegistryInspector.module.css';

/** Bundle Inspector — read-only catalog browser at `#/dev/registry`.
 *  Mounted as a sibling to ToolkitBuilder. See
 *  `docs/superpowers/specs/2026-05-16-bundle-inspector-design.md`. */
export function RegistryInspector() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Bundle Inspector';
    return () => { document.title = prev; };
  }, []);

  return (
    <div className={s.root}>
      <header className={s.header}>
        <h1 className={s.title}>Bundle Inspector</h1>
      </header>
      <div className={s.layout}>
        <aside className={s.tree}>
          <p className={s.empty}>Tree placeholder</p>
        </aside>
        <section className={s.detail}>
          <p className={s.empty}>Select an entry to see details.</p>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryInspector.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the hash route in `main.tsx`**

Modify `apps/swillustrator/src/main.tsx`. Find this block:

```tsx
  if (hash.startsWith('#/dev/toolkits')) return <ToolkitBuilder />;
  return <App />;
```

Replace with:

```tsx
  if (hash.startsWith('#/dev/toolkits')) return <ToolkitBuilder />;
  if (hash.startsWith('#/dev/registry')) return <RegistryInspector />;
  return <App />;
```

Add the import at the top of the file, next to the existing ToolkitBuilder import:

```tsx
import { RegistryInspector } from './dev/RegistryInspector';
```

- [ ] **Step 6: Commit**

```bash
git add apps/swillustrator/src/dev/RegistryInspector.tsx \
        apps/swillustrator/src/dev/RegistryInspector.module.css \
        apps/swillustrator/src/dev/RegistryInspector.test.tsx \
        apps/swillustrator/src/main.tsx
git commit -m "feat(swill): scaffold #/dev/registry bundle inspector page"
```

---

## Task 2: Tree data model + static collectors

**Files:**
- Create: `apps/swillustrator/src/dev/registryData.ts`
- Create: `apps/swillustrator/src/dev/registryData.test.ts`

This task defines the typed tree shape every consumer uses, then implements the static (non-runtime) collectors: icons, bundles, op factories, and public exports.

- [ ] **Step 1: Write the failing test**

Create `apps/swillustrator/src/dev/registryData.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  collectIcons,
  collectBundles,
  collectOpFactories,
  collectPublicExports,
} from './registryData';

describe('registryData static collectors', () => {
  it('collectIcons returns named entries for action and kind icons', () => {
    const icons = collectIcons();
    expect(icons.length).toBeGreaterThan(10);
    const names = icons.map((i) => i.id);
    expect(names).toContain('DeleteIcon');
    expect(names).toContain('PageIcon');
    for (const i of icons) {
      expect(i.kind).toBe('icon');
      expect(typeof i.Component).toBe('function');
    }
  });

  it('collectBundles returns the three named tool bundles', () => {
    const bundles = collectBundles();
    expect(bundles.map((b) => b.id)).toEqual(['minimal', 'standard', 'exhaustive']);
    const exhaustive = bundles.find((b) => b.id === 'exhaustive')!;
    expect(exhaustive.tools).toContain('rect');
    expect(exhaustive.tools).toContain('ellipse');
  });

  it('collectOpFactories returns named op factories from the kit barrel', () => {
    const ops = collectOpFactories();
    const ids = ops.map((o) => o.id);
    expect(ids).toContain('createInsertOp');
    expect(ids).toContain('createDeleteOp');
    expect(ids).toContain('createTransformOp');
  });

  it('collectPublicExports returns a non-empty list', () => {
    const exports = collectPublicExports();
    expect(exports.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/registryData.test.ts`
Expected: FAIL — `./registryData` not found.

- [ ] **Step 3: Implement the data module**

Create `apps/swillustrator/src/dev/registryData.ts`:

```ts
import type { ComponentType } from 'react';
import * as Weasel from '@weasel-js/core';
import * as ActionIcons from '../actionIcons';
import * as KindIcons from '../kindIcons';

/** Discriminated leaf entry. One of these per row in the tree's right pane. */
export type TreeEntry =
  | ToolEntry
  | ActionEntry
  | ShapeKindEntry
  | BundleEntry
  | IconEntry
  | OpFactoryEntry
  | PublicExportEntry;

export interface ToolEntry {
  kind: 'tool';
  id: string;                       // e.g. 'rect'
  label: string;                    // e.g. 'useRectTool'
  hookName?: string;                // e.g. 'useRectTool'
  cursor?: string;
  contributesActionIds: readonly string[];
}

export interface ActionEntry {
  kind: 'action';
  id: string;                       // e.g. 'delete'
  label: string;
  shortcut?: string;
  hookName?: string;
}

export interface ShapeKindEntry {
  kind: 'shapeKind';
  id: string;                       // e.g. 'rect'
  label: string;
}

export interface BundleEntry {
  kind: 'bundle';
  id: 'minimal' | 'standard' | 'exhaustive';
  label: string;
  tools: readonly string[];
  actions: readonly string[];
}

export interface IconEntry {
  kind: 'icon';
  id: string;                       // e.g. 'DeleteIcon'
  label: string;
  source: 'action' | 'kind';
  Component: ComponentType;
}

export interface OpFactoryEntry {
  kind: 'opFactory';
  id: string;                       // e.g. 'createInsertOp'
  label: string;
}

export interface PublicExportEntry {
  kind: 'publicExport';
  id: string;                       // export name
  label: string;
}

export type TreeCategory =
  | 'tools' | 'actions' | 'shapeKinds' | 'bundles'
  | 'icons' | 'opFactories' | 'publicExports';

/** A category node in the tree. */
export interface TreeCategoryNode {
  id: TreeCategory;
  label: string;
  entries: readonly TreeEntry[];
}

// ── Static collectors ──────────────────────────────────────────────────────

/** Action and kind icon components, named by their export identifier. */
export function collectIcons(): readonly IconEntry[] {
  const out: IconEntry[] = [];
  for (const [id, Component] of Object.entries(ActionIcons)) {
    if (typeof Component !== 'function') continue;
    out.push({ kind: 'icon', id, label: id, source: 'action', Component: Component as ComponentType });
  }
  for (const [id, Component] of Object.entries(KindIcons)) {
    if (typeof Component !== 'function') continue;
    out.push({ kind: 'icon', id, label: id, source: 'kind', Component: Component as ComponentType });
  }
  return out;
}

/** The three named `ToolBundle` presets the kit exposes via SceneCanvas's
 *  `toolBundle` prop. Mirrored here because the kit does not currently export
 *  the BUNDLE_TOOLS map. Tracked under the "kit-barrel drift" follow-up in
 *  docs/TODO.md. */
const BUNDLE_DEFINITIONS = [
  { id: 'minimal' as const,    label: 'Minimal',
    tools: ['select', 'hand'] as const,
    actions: ['undoRedo', 'escape'] as const },
  { id: 'standard' as const,   label: 'Standard',
    tools: ['select', 'resize', 'rotate', 'hand', 'rect', 'ellipse', 'line', 'pencil'] as const,
    actions: ['delete', 'undoRedo', 'duplicate', 'nudge', 'escape', 'selectAll', 'clipboard'] as const },
  { id: 'exhaustive' as const, label: 'Exhaustive',
    tools: ['select', 'resize', 'rotate', 'hand', 'rect', 'ellipse', 'line',
            'polygon', 'star', 'pencil', 'lasso', 'text', 'clone'] as const,
    actions: ['delete', 'undoRedo', 'duplicate', 'nudge', 'escape', 'selectAll',
              'reorder', 'align', 'distribute', 'flip', 'clipboard', 'group', 'nest'] as const },
];

export function collectBundles(): readonly BundleEntry[] {
  return BUNDLE_DEFINITIONS.map((b) => ({ kind: 'bundle', ...b }));
}

const OP_FACTORY_NAMES: readonly string[] = [
  'createInsertOp', 'createDeleteOp', 'createTransformOp',
  'createReparentOp', 'createSetSelectionOp', 'createSetTextOp', 'createSetPathOp',
];

export function collectOpFactories(): readonly OpFactoryEntry[] {
  return OP_FACTORY_NAMES
    .filter((name) => typeof (Weasel as Record<string, unknown>)[name] === 'function')
    .map((id) => ({ kind: 'opFactory', id, label: id }));
}

/** All function/object exports from the `@weasel-js/core` barrel. Filters
 *  out type-only re-exports (which vanish at runtime anyway). */
export function collectPublicExports(): readonly PublicExportEntry[] {
  const out: PublicExportEntry[] = [];
  for (const [id, value] of Object.entries(Weasel)) {
    if (value === undefined || value === null) continue;
    if (id === 'default') continue;
    out.push({ kind: 'publicExport', id, label: id });
  }
  return out;
}

/** Shape-kind ids the kit's BuiltinShapeToolId covers — used until the kit
 *  exports a dedicated kind catalog (see kit-barrel-drift TODO). */
const SHAPE_KIND_IDS: readonly string[] = [
  'rect', 'ellipse', 'line', 'polygon', 'star', 'pencil', 'lasso', 'text', 'clone',
];

export function collectShapeKinds(): readonly ShapeKindEntry[] {
  return SHAPE_KIND_IDS.map((id) => ({ kind: 'shapeKind', id, label: id }));
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/registryData.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/swillustrator/src/dev/registryData.ts \
        apps/swillustrator/src/dev/registryData.test.ts
git commit -m "feat(swill): static collectors for registry inspector entries"
```

---

## Task 3: Runtime probe — tools and actions

**Files:**
- Create: `apps/swillustrator/src/dev/registryProbe.tsx`
- Create: `apps/swillustrator/src/dev/registryProbe.test.tsx`

The probe mounts a hidden `<SceneCanvas toolBundle="exhaustive">` and reads the synthesized `ToolsApi` plus the live `ActionsRegistry` from a child component. To get a populated actions registry, we also call the same standard action hooks `ToolkitBuilder` calls (the kit doesn't auto-register actions just from mounting tools).

- [ ] **Step 1: Write the failing test**

Create `apps/swillustrator/src/dev/registryProbe.test.tsx`:

```tsx
import { render, waitFor } from '@testing-library/react';
import { ActionsProvider, SelectionContextProvider } from '@weasel-js/core';
import { RegistryProbe } from './registryProbe';

describe('RegistryProbe', () => {
  it('reports tool and action entries after mount', async () => {
    let snapshot: { tools: readonly { id: string }[]; actions: readonly { id: string }[] } | null = null;
    render(
      <ActionsProvider>
        <SelectionContextProvider>
          <RegistryProbe onSnapshot={(s) => { snapshot = s; }} />
        </SelectionContextProvider>
      </ActionsProvider>,
    );
    await waitFor(() => {
      expect(snapshot).not.toBeNull();
      expect(snapshot!.tools.length).toBeGreaterThan(3);
      expect(snapshot!.actions.length).toBeGreaterThan(3);
    });
    const toolIds = snapshot!.tools.map((t) => t.id);
    expect(toolIds).toContain('rect');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/registryProbe.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the probe**

Create `apps/swillustrator/src/dev/registryProbe.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  SceneCanvas,
  useActionsRegistry,
  useDelete,
  useDuplicate,
  useEscape,
  useNudge,
  useScene,
  useSceneAdapter,
  useSelectAll,
  useSelection,
  useUndoRedo,
  type ToolsApi,
} from '@weasel-js/core';
import type { ToolEntry, ActionEntry } from './registryData';

export interface RegistrySnapshot {
  readonly tools: readonly ToolEntry[];
  readonly actions: readonly ActionEntry[];
}

interface ProbeProps {
  onSnapshot(s: RegistrySnapshot): void;
}

interface ShapeData { fill: string }
interface ShapePose { x: number; y: number; width: number; height: number }

/** Mounts a hidden SceneCanvas with the exhaustive tool bundle and a minimal
 *  set of action hooks. Calls `onSnapshot` with the resulting tool/action lists
 *  on every change. Visually hidden but kept in the layout tree so hooks
 *  remain alive. */
export function RegistryProbe({ onSnapshot }: ProbeProps) {
  const scene = useScene<ShapeData, 'default', ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ mode: 'multi' });
  const adapter = useSceneAdapter(scene, { selection });
  const applyOps = adapter.applyOps?.bind(adapter);
  const getSelection = () => [...selection.current];

  useDelete({
    getSelection,
    getNode: (id) => scene.get(id) ?? { id },
    getNodeIndex: (id) => [...scene.renderOrder()].indexOf(asNodeId(id)),
    removeNode: (id) => scene.remove(asNodeId(id)),
    applyOps,
  }, { enableKeyboard: false });

  useUndoRedo({
    undo: () => scene.undo(),
    redo: () => scene.redo(),
    canUndo: () => scene.canUndo(),
    canRedo: () => scene.canRedo(),
  }, { bindKeyboard: false });

  useDuplicate<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    cloneNode: (id) => ({ id }),
    applyOps,
  }, { enableKeyboard: false });

  useNudge<ShapePose>({
    getSelection,
    getPose: (id) => adapter.getPose(id),
    applyOps,
  }, {
    enableKeyboard: false,
    translatePose: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
  });

  useEscape({
    getSelection,
    setSelection: (ids) => selection.set(ids),
    applyOps,
  }, { enableKeyboard: false });

  useSelectAll({
    getSelection,
    listAll: () => [...scene.renderOrder()],
    setSelection: (ids) => selection.set(ids),
    applyOps,
  }, { enableKeyboard: false });

  const [tools, setTools] = useState<ToolsApi | null>(null);
  const reg = useActionsRegistry();

  // Roll up tool ids and contributed action ids from the synthesized ToolsApi.
  const toolEntries: readonly ToolEntry[] = useMemo(() => {
    if (!tools) return [];
    return Object.values(tools.registry).map((t) => {
      const def = t.def;
      const contributesActionIds: string[] = [];
      // Best-effort: walk phases.routes for action ids if present.
      if (def && typeof def === 'object' && 'phases' in def) {
        const phases = (def as { phases?: Record<string, unknown> }).phases ?? {};
        for (const p of Object.values(phases)) {
          if (p && typeof p === 'object' && 'routes' in p) {
            const routes = (p as { routes?: Record<string, unknown> }).routes ?? {};
            for (const r of Object.values(routes)) {
              if (r && typeof r === 'object' && 'actionId' in r) {
                const a = (r as { actionId?: string }).actionId;
                if (a) contributesActionIds.push(a);
              }
            }
          }
        }
      }
      return {
        kind: 'tool' as const,
        id: t.id,
        label: t.id,
        cursor: t.cursor,
        contributesActionIds: Array.from(new Set(contributesActionIds)),
      };
    });
  }, [tools]);

  const actionEntries: readonly ActionEntry[] = useMemo(() => {
    if (!reg) return [];
    return reg.list().map((a) => ({
      kind: 'action' as const,
      id: a.id,
      label: a.label ?? a.id,
      shortcut: a.defaultBinding
        ? formatBinding(a.defaultBinding)
        : undefined,
    }));
  }, [reg, tools]);  // re-run when tools changes (actions register lazily)

  const lastRef = useRef<string>('');
  useEffect(() => {
    const sig = JSON.stringify({
      t: toolEntries.map((t) => t.id),
      a: actionEntries.map((a) => a.id),
    });
    if (sig === lastRef.current) return;
    lastRef.current = sig;
    onSnapshot({ tools: toolEntries, actions: actionEntries });
  }, [toolEntries, actionEntries, onSnapshot]);

  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: -99999, top: -99999, width: 1, height: 1, overflow: 'hidden' }}>
      <SceneCanvas
        scene={scene}
        width={200}
        height={200}
        toolBundle="exhaustive"
        onToolsCreated={(api) => setTools(api)}
      />
    </div>
  );
}

function formatBinding(b: { key: string | readonly string[]; mod?: boolean; alt?: boolean; shift?: boolean }): string {
  const parts: string[] = [];
  if (b.mod) parts.push('Mod');
  if (b.alt) parts.push('Alt');
  if (b.shift) parts.push('Shift');
  parts.push(typeof b.key === 'string' ? b.key : b.key.join('/'));
  return parts.join('+');
}
```

If the kit does not expose `onToolsCreated` on SceneCanvas with that exact name, locate the equivalent in `src/canvas/SceneCanvas.tsx` (search `tools` callback prop) and adjust. ToolkitBuilder calls this pattern; verify by reading lines 400-430 of `apps/swillustrator/src/dev/ToolkitBuilder.tsx`.

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/registryProbe.test.tsx`
Expected: PASS.

If the test fails because actions don't register in jsdom (no keyboard wiring needed; they still register), inspect `reg.list()` output by adding a temporary console.log in the test, then adjust the probe to mount more action hooks until the assertion passes. The kit's `useStandardActions` may be a cleaner one-call alternative — check `src/interactions/actions/useStandardActions.ts` and swap if its surface is right.

- [ ] **Step 5: Commit**

```bash
git add apps/swillustrator/src/dev/registryProbe.tsx \
        apps/swillustrator/src/dev/registryProbe.test.tsx
git commit -m "feat(swill): hidden SceneCanvas probe for runtime tool/action introspection"
```

---

## Task 4: Tree component with text filter

**Files:**
- Create: `apps/swillustrator/src/dev/RegistryTree.tsx`
- Create: `apps/swillustrator/src/dev/RegistryTree.test.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryInspector.module.css`

- [ ] **Step 1: Write the failing test**

Create `apps/swillustrator/src/dev/RegistryTree.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RegistryTree } from './RegistryTree';
import type { TreeCategoryNode } from './registryData';

const NODES: readonly TreeCategoryNode[] = [
  {
    id: 'tools',
    label: 'Tools',
    entries: [
      { kind: 'tool', id: 'rect', label: 'useRectTool', contributesActionIds: [] },
      { kind: 'tool', id: 'ellipse', label: 'useEllipseTool', contributesActionIds: [] },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    entries: [{ kind: 'action', id: 'delete', label: 'Delete' }],
  },
];

describe('RegistryTree', () => {
  it('renders category headings', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('expands a category on click and shows its entries', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Tools'));
    expect(screen.getByText('rect')).toBeInTheDocument();
    expect(screen.getByText('ellipse')).toBeInTheDocument();
  });

  it('text filter narrows leaves and auto-expands parents', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'rect' } });
    expect(screen.getByText('rect')).toBeInTheDocument();
    expect(screen.queryByText('ellipse')).not.toBeInTheDocument();
    expect(screen.queryByText('delete')).not.toBeInTheDocument();
  });

  it('calls onSelect when a leaf is clicked', () => {
    const onSelect = vi.fn();
    render(<RegistryTree nodes={NODES} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Tools'));
    fireEvent.click(screen.getByText('rect'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ kind: 'tool', id: 'rect' });
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryTree.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the tree component**

Create `apps/swillustrator/src/dev/RegistryTree.tsx`:

```tsx
import { useMemo, useState } from 'react';
import s from './RegistryInspector.module.css';
import type { TreeCategoryNode, TreeEntry } from './registryData';

interface Props {
  nodes: readonly TreeCategoryNode[];
  selected: TreeEntry | null;
  onSelect(entry: TreeEntry): void;
}

export function RegistryTree({ nodes, selected, onSelect }: Props) {
  const [filter, setFilter] = useState('');
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  const lower = filter.trim().toLowerCase();

  const filteredNodes = useMemo(() => {
    if (!lower) return nodes;
    return nodes
      .map((n) => ({
        ...n,
        entries: n.entries.filter((e) => e.id.toLowerCase().includes(lower) || e.label.toLowerCase().includes(lower)),
      }))
      .filter((n) => n.entries.length > 0);
  }, [nodes, lower]);

  const isOpen = (id: string) => (lower ? true : openIds.has(id));
  const toggle = (id: string) => {
    if (lower) return;
    setOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <input
        className={s.filterInput}
        placeholder="Filter…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className={s.treeList}>
        {filteredNodes.map((n) => (
          <li key={n.id} className={s.treeCategory}>
            <button type="button" className={s.treeCategoryButton} onClick={() => toggle(n.id)}>
              <span className={s.treeChevron}>{isOpen(n.id) ? '▾' : '▸'}</span>
              {n.label} <span className={s.treeCount}>({n.entries.length})</span>
            </button>
            {isOpen(n.id) && (
              <ul className={s.treeLeaves}>
                {n.entries.map((e) => {
                  const isSelected = selected && selected.kind === e.kind && selected.id === e.id;
                  return (
                    <li key={`${e.kind}:${e.id}`}>
                      <button
                        type="button"
                        className={`${s.treeLeaf} ${isSelected ? s.treeLeafSelected : ''}`}
                        onClick={() => onSelect(e)}
                      >
                        {e.id}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Add the tree-specific CSS**

Append to `apps/swillustrator/src/dev/RegistryInspector.module.css`:

```css
.treeList { list-style: none; margin: 0; padding: 0; }
.treeCategory { margin-bottom: 4px; }
.treeCategoryButton {
  display: flex; align-items: center; gap: 6px;
  background: transparent;
  border: none;
  color: var(--wzl-fg, #d4c4a8);
  cursor: pointer;
  padding: 4px 2px;
  font: inherit;
  font-weight: 600;
  width: 100%;
  text-align: left;
}
.treeChevron { font-size: 10px; width: 10px; }
.treeCount { color: var(--wzl-muted, #a59685); font-weight: 400; }
.treeLeaves { list-style: none; margin: 0; padding: 0 0 0 20px; }
.treeLeaf {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--wzl-fg, #d4c4a8);
  cursor: pointer;
  padding: 2px 4px;
  font: inherit;
  font-size: 12px;
  border-radius: 3px;
}
.treeLeaf:hover { background: var(--wzl-panel-border, #4a3c2e); }
.treeLeafSelected { background: var(--wzl-accent, #c89a5e); color: #1e1610; }
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryTree.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/swillustrator/src/dev/RegistryTree.tsx \
        apps/swillustrator/src/dev/RegistryTree.test.tsx \
        apps/swillustrator/src/dev/RegistryInspector.module.css
git commit -m "feat(swill): registry tree component with text filter"
```

---

## Task 5: Wire tree into inspector + bundle filter dropdown

**Files:**
- Modify: `apps/swillustrator/src/dev/RegistryInspector.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryInspector.test.tsx`

- [ ] **Step 1: Extend the failing test**

Replace the contents of `apps/swillustrator/src/dev/RegistryInspector.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionsProvider, SelectionContextProvider } from '@weasel-js/core';
import { RegistryInspector } from './RegistryInspector';

function renderInspector() {
  return render(
    <ActionsProvider>
      <SelectionContextProvider>
        <RegistryInspector />
      </SelectionContextProvider>
    </ActionsProvider>,
  );
}

describe('RegistryInspector', () => {
  it('renders the page heading', () => {
    renderInspector();
    expect(screen.getByRole('heading', { name: /bundle inspector/i })).toBeInTheDocument();
  });

  it('renders all category nodes in the tree', async () => {
    renderInspector();
    await waitFor(() => expect(screen.getByText('Bundles')).toBeInTheDocument());
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Shape kinds')).toBeInTheDocument();
    expect(screen.getByText('Icons')).toBeInTheDocument();
  });

  it('bundle dropdown narrows the tools list to bundle members', async () => {
    renderInspector();
    await waitFor(() => expect(screen.getByText('Bundles')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Tools'));
    expect(screen.getByText('rect')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/bundle/i), { target: { value: 'minimal' } });
    expect(screen.queryByText('rect')).not.toBeInTheDocument();
    expect(screen.getByText('select')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryInspector.test.tsx`
Expected: FAIL — tree categories not rendered yet.

- [ ] **Step 3: Implement the wired inspector**

Replace `apps/swillustrator/src/dev/RegistryInspector.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import s from './RegistryInspector.module.css';
import { RegistryTree } from './RegistryTree';
import { RegistryProbe, type RegistrySnapshot } from './registryProbe';
import {
  collectBundles,
  collectIcons,
  collectOpFactories,
  collectPublicExports,
  collectShapeKinds,
  type TreeCategoryNode,
  type TreeEntry,
} from './registryData';

const BUNDLE_OPTIONS = [
  { id: 'all', label: 'All bundles' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'standard', label: 'Standard' },
  { id: 'exhaustive', label: 'Exhaustive' },
] as const;

export function RegistryInspector() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Bundle Inspector';
    return () => { document.title = prev; };
  }, []);

  const [runtime, setRuntime] = useState<RegistrySnapshot>({ tools: [], actions: [] });
  const [bundleFilter, setBundleFilter] = useState<string>('all');
  const [selected, setSelected] = useState<TreeEntry | null>(null);

  const onSnapshot = useCallback((s: RegistrySnapshot) => setRuntime(s), []);

  const bundles = useMemo(() => collectBundles(), []);
  const icons = useMemo(() => collectIcons(), []);
  const opFactories = useMemo(() => collectOpFactories(), []);
  const publicExports = useMemo(() => collectPublicExports(), []);
  const shapeKinds = useMemo(() => collectShapeKinds(), []);

  const activeBundle = bundles.find((b) => b.id === bundleFilter);

  const filterByBundle = <T extends { id: string }>(entries: readonly T[], allowed: readonly string[] | null): readonly T[] => {
    if (!allowed) return entries;
    const allow = new Set(allowed);
    return entries.filter((e) => allow.has(e.id));
  };

  const nodes: readonly TreeCategoryNode[] = useMemo(() => [
    {
      id: 'tools',
      label: 'Tools',
      entries: filterByBundle(runtime.tools, activeBundle ? activeBundle.tools : null),
    },
    {
      id: 'actions',
      label: 'Actions',
      entries: filterByBundle(runtime.actions, activeBundle ? activeBundle.actions : null),
    },
    { id: 'shapeKinds', label: 'Shape kinds', entries: shapeKinds },
    { id: 'bundles', label: 'Bundles', entries: bundles },
    { id: 'icons', label: 'Icons', entries: icons },
    { id: 'opFactories', label: 'Op factories', entries: opFactories },
    { id: 'publicExports', label: 'Public exports', entries: publicExports },
  ], [runtime, activeBundle, bundles, icons, opFactories, publicExports, shapeKinds]);

  return (
    <div className={s.root}>
      <RegistryProbe onSnapshot={onSnapshot} />
      <header className={s.header}>
        <h1 className={s.title}>Bundle Inspector</h1>
        <label className={s.bundlePicker}>
          bundle
          <select
            aria-label="bundle filter"
            value={bundleFilter}
            onChange={(e) => setBundleFilter(e.target.value)}
          >
            {BUNDLE_OPTIONS.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </label>
      </header>
      <div className={s.layout}>
        <aside className={s.tree}>
          <RegistryTree nodes={nodes} selected={selected} onSelect={setSelected} />
        </aside>
        <section className={s.detail}>
          {selected ? <pre>{JSON.stringify(selected, null, 2)}</pre> : <p className={s.empty}>Select an entry to see details.</p>}
        </section>
      </div>
    </div>
  );
}
```

(The `<pre>` JSON detail is a temporary placeholder. Task 6+ replaces it with `RegistryDetail`.)

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryInspector.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/swillustrator/src/dev/RegistryInspector.tsx \
        apps/swillustrator/src/dev/RegistryInspector.test.tsx
git commit -m "feat(swill): wire tree + bundle filter into inspector"
```

---

## Task 6: Detail pane — Tool, Action, Bundle

**Files:**
- Create: `apps/swillustrator/src/dev/RegistryDetail.tsx`
- Create: `apps/swillustrator/src/dev/RegistryDetail.test.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryInspector.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryInspector.module.css`

This task introduces the dispatcher and the first three leaf types. Shape kinds, icons, op factories, and exports come in Task 7.

- [ ] **Step 1: Write the failing test**

Create `apps/swillustrator/src/dev/RegistryDetail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { RegistryDetail } from './RegistryDetail';
import type { TreeEntry } from './registryData';

describe('RegistryDetail', () => {
  it('renders a Tool entry with id and contributed actions', () => {
    const entry: TreeEntry = {
      kind: 'tool',
      id: 'rect',
      label: 'useRectTool',
      contributesActionIds: ['insert.rect', 'commit.rect'],
    };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText(/rect/)).toBeInTheDocument();
    expect(screen.getByText('insert.rect')).toBeInTheDocument();
  });

  it('renders an Action entry with shortcut', () => {
    const entry: TreeEntry = { kind: 'action', id: 'delete', label: 'Delete', shortcut: 'Backspace' };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText('Backspace')).toBeInTheDocument();
  });

  it('renders a Bundle with clickable members that fire onNavigate', () => {
    const entry: TreeEntry = {
      kind: 'bundle', id: 'minimal', label: 'Minimal',
      tools: ['select', 'hand'], actions: ['escape'],
    };
    const onNavigate = vi.fn();
    render(<RegistryDetail entry={entry} onNavigate={onNavigate} />);
    screen.getByText('select').click();
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'tool', id: 'select' });
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryDetail.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement RegistryDetail**

Create `apps/swillustrator/src/dev/RegistryDetail.tsx`:

```tsx
import s from './RegistryInspector.module.css';
import type { TreeEntry, ToolEntry, ActionEntry, BundleEntry } from './registryData';

interface Props {
  entry: TreeEntry;
  onNavigate(target: { kind: 'tool'; id: string } | { kind: 'action'; id: string }): void;
}

export function RegistryDetail({ entry, onNavigate }: Props) {
  switch (entry.kind) {
    case 'tool':       return <ToolDetail entry={entry} />;
    case 'action':     return <ActionDetail entry={entry} />;
    case 'bundle':     return <BundleDetail entry={entry} onNavigate={onNavigate} />;
    default:           return <pre>{JSON.stringify(entry, null, 2)}</pre>;
  }
}

function ToolDetail({ entry }: { entry: ToolEntry }) {
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <dl className={s.detailList}>
        <dt>label</dt><dd>{entry.label}</dd>
        {entry.cursor && (<><dt>cursor</dt><dd>{entry.cursor}</dd></>)}
        {entry.contributesActionIds.length > 0 && (
          <>
            <dt>actions</dt>
            <dd>{entry.contributesActionIds.map((a) => <code key={a} className={s.tag}>{a}</code>)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function ActionDetail({ entry }: { entry: ActionEntry }) {
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <dl className={s.detailList}>
        <dt>label</dt><dd>{entry.label}</dd>
        {entry.shortcut && (<><dt>shortcut</dt><dd><code>{entry.shortcut}</code></dd></>)}
      </dl>
    </div>
  );
}

function BundleDetail({ entry, onNavigate }: { entry: BundleEntry; onNavigate: Props['onNavigate'] }) {
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <h3>Tools</h3>
      <ul className={s.memberList}>
        {entry.tools.map((t) => (
          <li key={t}>
            <button type="button" className={s.memberLink} onClick={() => onNavigate({ kind: 'tool', id: t })}>{t}</button>
          </li>
        ))}
      </ul>
      <h3>Actions</h3>
      <ul className={s.memberList}>
        {entry.actions.map((a) => (
          <li key={a}>
            <button type="button" className={s.memberLink} onClick={() => onNavigate({ kind: 'action', id: a })}>{a}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Add detail-pane CSS**

Append to `apps/swillustrator/src/dev/RegistryInspector.module.css`:

```css
.detailHeading { margin: 0 0 12px; font-size: 16px; }
.detailList { display: grid; grid-template-columns: 100px 1fr; gap: 4px 12px; font-size: 13px; margin: 0; }
.detailList dt { color: var(--wzl-muted, #a59685); }
.detailList dd { margin: 0; }
.tag { background: var(--wzl-bg, #1e1610); padding: 1px 6px; border-radius: 3px; margin-right: 4px; font-size: 11px; }
.memberList { list-style: none; padding: 0; margin: 4px 0 12px; }
.memberLink {
  background: transparent;
  border: none;
  color: var(--wzl-accent, #c89a5e);
  cursor: pointer;
  padding: 2px 0;
  font: inherit;
  text-align: left;
  text-decoration: underline;
}
```

- [ ] **Step 5: Wire the detail into the inspector and handle navigation**

In `apps/swillustrator/src/dev/RegistryInspector.tsx`, replace the placeholder `<pre>` block:

```tsx
          {selected ? <pre>{JSON.stringify(selected, null, 2)}</pre> : <p className={s.empty}>Select an entry to see details.</p>}
```

with:

```tsx
          {selected
            ? <RegistryDetail entry={selected} onNavigate={(t) => {
                const list = t.kind === 'tool' ? runtime.tools : runtime.actions;
                const next = list.find((e) => e.id === t.id);
                if (next) setSelected(next);
              }} />
            : <p className={s.empty}>Select an entry to see details.</p>}
```

Add the import at the top:

```tsx
import { RegistryDetail } from './RegistryDetail';
```

- [ ] **Step 6: Run the tests, confirm they pass**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryDetail.test.tsx apps/swillustrator/src/dev/RegistryInspector.test.tsx`
Expected: PASS (6 tests total).

- [ ] **Step 7: Commit**

```bash
git add apps/swillustrator/src/dev/RegistryDetail.tsx \
        apps/swillustrator/src/dev/RegistryDetail.test.tsx \
        apps/swillustrator/src/dev/RegistryInspector.tsx \
        apps/swillustrator/src/dev/RegistryInspector.module.css
git commit -m "feat(swill): tool/action/bundle detail panes for inspector"
```

---

## Task 7: Detail pane — Shape kind, Icon, Op factory, Public export

**Files:**
- Modify: `apps/swillustrator/src/dev/RegistryDetail.tsx`
- Modify: `apps/swillustrator/src/dev/RegistryDetail.test.tsx`

- [ ] **Step 1: Extend the failing test**

Append these cases to the existing `describe` block in `apps/swillustrator/src/dev/RegistryDetail.test.tsx`:

```tsx
  it('renders an Icon entry with a visual preview', () => {
    const Component = () => <svg data-testid="icon-svg" width={16} height={16} />;
    const entry: TreeEntry = { kind: 'icon', id: 'TestIcon', label: 'TestIcon', source: 'action', Component };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getAllByTestId('icon-svg').length).toBeGreaterThanOrEqual(2); // 32px and 64px
  });

  it('renders a ShapeKind entry with id', () => {
    const entry: TreeEntry = { kind: 'shapeKind', id: 'rect', label: 'rect' };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText('rect')).toBeInTheDocument();
  });

  it('renders an OpFactory entry with id', () => {
    const entry: TreeEntry = { kind: 'opFactory', id: 'createInsertOp', label: 'createInsertOp' };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText('createInsertOp')).toBeInTheDocument();
  });

  it('renders a PublicExport entry with id', () => {
    const entry: TreeEntry = { kind: 'publicExport', id: 'SceneCanvas', label: 'SceneCanvas' };
    render(<RegistryDetail entry={entry} onNavigate={() => {}} />);
    expect(screen.getByText('SceneCanvas')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryDetail.test.tsx`
Expected: FAIL — new cases assert content not yet rendered.

- [ ] **Step 3: Add the new detail cases**

In `apps/swillustrator/src/dev/RegistryDetail.tsx`, update the switch and add the new components:

```tsx
import type { TreeEntry, ToolEntry, ActionEntry, BundleEntry, IconEntry, ShapeKindEntry, OpFactoryEntry, PublicExportEntry } from './registryData';

// ...
export function RegistryDetail({ entry, onNavigate }: Props) {
  switch (entry.kind) {
    case 'tool':           return <ToolDetail entry={entry} />;
    case 'action':         return <ActionDetail entry={entry} />;
    case 'bundle':         return <BundleDetail entry={entry} onNavigate={onNavigate} />;
    case 'shapeKind':      return <SimpleDetail label={entry.id} />;
    case 'icon':           return <IconDetail entry={entry} />;
    case 'opFactory':      return <SimpleDetail label={entry.id} />;
    case 'publicExport':   return <SimpleDetail label={entry.id} />;
  }
}

function SimpleDetail({ label }: { label: string }) {
  return (
    <div>
      <h2 className={s.detailHeading}>{label}</h2>
      <p className={s.empty}>Source path and JSDoc snippet are loaded lazily — see Task 8 follow-up.</p>
    </div>
  );
}

function IconDetail({ entry }: { entry: IconEntry }) {
  const C = entry.Component;
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <div className={s.iconPreviewRow}>
        <div className={s.iconPreviewCell} style={{ width: 32, height: 32 }}><C /></div>
        <div className={s.iconPreviewCell} style={{ width: 64, height: 64 }}><C /></div>
      </div>
      <dl className={s.detailList}>
        <dt>source</dt><dd>{entry.source}</dd>
      </dl>
    </div>
  );
}
```

(The unused types `ShapeKindEntry`, `OpFactoryEntry`, `PublicExportEntry` can be removed from the import if TypeScript complains.)

Append to `apps/swillustrator/src/dev/RegistryInspector.module.css`:

```css
.iconPreviewRow { display: flex; gap: 12px; margin: 8px 0 12px; align-items: flex-end; }
.iconPreviewCell {
  background: var(--wzl-bg, #1e1610);
  border: 1px solid var(--wzl-panel-border, #4a3c2e);
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  padding: 4px;
}
.iconPreviewCell > svg { width: 100%; height: 100%; }
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/RegistryDetail.test.tsx`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add apps/swillustrator/src/dev/RegistryDetail.tsx \
        apps/swillustrator/src/dev/RegistryDetail.test.tsx \
        apps/swillustrator/src/dev/RegistryInspector.module.css
git commit -m "feat(swill): icon, shape-kind, op-factory, export detail panes"
```

---

## Task 8: Source-file lookup with JSDoc snippets (lazy)

**Files:**
- Create: `apps/swillustrator/src/dev/sourceLookup.ts`
- Create: `apps/swillustrator/src/dev/sourceLookup.test.ts`
- Modify: `apps/swillustrator/src/dev/RegistryDetail.tsx`

The lookup scans the kit's `src/**/*.{ts,tsx}` and the app's own `apps/swillustrator/src/**/*.{ts,tsx}` for a line that exports the symbol by name, returns the file path, and captures any JSDoc comment immediately above the `export` keyword. Lazy: the glob loader returns one entry per file path → raw source string; we parse on demand and cache.

- [ ] **Step 1: Write the failing test**

Create `apps/swillustrator/src/dev/sourceLookup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractExportInfo } from './sourceLookup';

describe('extractExportInfo', () => {
  it('returns null when the symbol is not exported in the source', () => {
    const src = `function foo() { return 1; }\n`;
    expect(extractExportInfo(src, 'foo')).toBeNull();
  });

  it('finds an export function declaration', () => {
    const src = `export function bar() { return 1; }\n`;
    const info = extractExportInfo(src, 'bar');
    expect(info).not.toBeNull();
    expect(info!.jsdoc).toBeNull();
  });

  it('captures a JSDoc block immediately preceding the export', () => {
    const src = [
      '/** Adds one to its argument. */',
      'export function addOne(x: number) { return x + 1; }',
      '',
    ].join('\n');
    const info = extractExportInfo(src, 'addOne');
    expect(info).not.toBeNull();
    expect(info!.jsdoc).toContain('Adds one');
  });

  it('captures a multi-line JSDoc block', () => {
    const src = [
      '/**',
      ' * Multi-line.',
      ' * Description.',
      ' */',
      'export const Thing = 1;',
    ].join('\n');
    const info = extractExportInfo(src, 'Thing');
    expect(info!.jsdoc).toContain('Multi-line.');
    expect(info!.jsdoc).toContain('Description.');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/sourceLookup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the lookup**

Create `apps/swillustrator/src/dev/sourceLookup.ts`:

```ts
export interface ExportInfo {
  jsdoc: string | null;
}

/** Locate the line that exports `symbol` in the supplied source string and
 *  return the JSDoc block (if any) immediately above it. Returns null if no
 *  matching export is found.
 *
 *  Recognized forms:
 *    export function NAME
 *    export const NAME
 *    export class NAME
 *    export type NAME
 *    export interface NAME
 *    export { NAME [as ALIAS] }
 *
 *  The check is line-based and intentionally simple — it is not a full
 *  TypeScript parser. */
export function extractExportInfo(source: string, symbol: string): ExportInfo | null {
  const lines = source.split('\n');
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`^\\s*export\\s+(function|const|class|type|interface|enum)\\s+${escaped}\\b`),
    new RegExp(`^\\s*export\\s+\\{[^}]*\\b${escaped}\\b`),
  ];
  let lineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (patterns.some((p) => p.test(lines[i]))) {
      lineIndex = i;
      break;
    }
  }
  if (lineIndex === -1) return null;
  return { jsdoc: readJsdocAbove(lines, lineIndex) };
}

function readJsdocAbove(lines: string[], exportLineIndex: number): string | null {
  // Walk upward past blank lines.
  let i = exportLineIndex - 1;
  while (i >= 0 && lines[i].trim() === '') i--;
  if (i < 0) return null;
  const last = lines[i].trim();
  if (last === '*/') {
    // Multi-line JSDoc: walk back to `/**`.
    const collected: string[] = [];
    let j = i;
    while (j >= 0) {
      collected.unshift(lines[j]);
      if (lines[j].trim().startsWith('/**')) break;
      j--;
    }
    if (j < 0) return null;
    return collected
      .map((l) => l.replace(/^\s*\/?\*+\/?\s?/, '').replace(/\s+$/, ''))
      .join('\n')
      .trim() || null;
  }
  // Single-line JSDoc: `/** ... */`
  const single = /^\/\*\*\s*(.+?)\s*\*\/$/.exec(last);
  if (single) return single[1];
  return null;
}

// ── Vite glob (only used in app code, not in unit tests) ───────────────────

type RawSourceMap = Record<string, string>;

// `as: 'raw'` returns each module as its source string; `eager: true` so the
// loader is synchronous for this dev-only page. Vite handles both globs at
// build time; the resulting bundle includes only matched files.
const rawSources: RawSourceMap = {
  ...(import.meta.glob('/src/**/*.{ts,tsx}', { as: 'raw', eager: true }) as RawSourceMap),
  ...(import.meta.glob('/apps/swillustrator/src/**/*.{ts,tsx}', { as: 'raw', eager: true }) as RawSourceMap),
};

export interface SourceMatch {
  path: string;
  jsdoc: string | null;
}

/** Search every loaded source file for an export of `symbol`. Returns the
 *  first match — symbol names should be globally unique by convention. */
export function findSourceMatch(symbol: string): SourceMatch | null {
  for (const [path, source] of Object.entries(rawSources)) {
    const info = extractExportInfo(source, symbol);
    if (info) return { path, jsdoc: info.jsdoc };
  }
  return null;
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run --project=swillustrator apps/swillustrator/src/dev/sourceLookup.test.ts`
Expected: PASS (4 tests).

If `import.meta.glob` causes vitest to fail (it sometimes does in unit tests), gate the glob behind a `typeof import.meta.glob === 'function'` check so the test environment can skip loading sources without crashing.

- [ ] **Step 5: Surface the source info in the detail pane**

In `apps/swillustrator/src/dev/RegistryDetail.tsx`, replace `SimpleDetail`:

```tsx
import { findSourceMatch } from './sourceLookup';

function SimpleDetail({ label }: { label: string }) {
  const match = findSourceMatch(label);
  return (
    <div>
      <h2 className={s.detailHeading}>{label}</h2>
      {match?.path && <p className={s.sourcePath}><code>{match.path}</code></p>}
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
      {!match && <p className={s.empty}>No source match found.</p>}
    </div>
  );
}
```

Append CSS to `RegistryInspector.module.css`:

```css
.sourcePath { font-size: 11px; color: var(--wzl-muted, #a59685); margin: 4px 0; }
.jsdoc {
  background: var(--wzl-bg, #1e1610);
  border: 1px solid var(--wzl-panel-border, #4a3c2e);
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  white-space: pre-wrap;
  margin: 8px 0 0;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/swillustrator/src/dev/sourceLookup.ts \
        apps/swillustrator/src/dev/sourceLookup.test.ts \
        apps/swillustrator/src/dev/RegistryDetail.tsx \
        apps/swillustrator/src/dev/RegistryInspector.module.css
git commit -m "feat(swill): lazy source lookup with JSDoc snippets for inspector"
```

---

## Task 9: Manual dev-server smoke test + final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full project test suite**

Run: `npm test`
Expected: All projects pass. If any pre-existing failure surfaces, capture the output and surface it to the user before continuing.

- [ ] **Step 2: Run the production gate**

Run: `npx tsc --noEmit && npx vitest run && npx tsup build`
Expected: Clean.

- [ ] **Step 3: Boot the dev server and exercise the page**

Run: `npm run dev`
Open the printed URL with `#/dev/registry` appended, e.g. `http://localhost:5173/#/dev/registry`.

Manual checks:
- Heading "Bundle Inspector" appears; document title updates.
- Tree shows seven category nodes with non-zero counts (Tools, Actions, Shape kinds, Bundles, Icons, Op factories, Public exports).
- Clicking each category expands and reveals leaves.
- Bundle dropdown narrows Tools and Actions to the selected bundle.
- Text filter narrows leaves and auto-expands the matching categories.
- Selecting a Tool leaf renders its detail; same for Action, Bundle (members are clickable and navigate), Shape kind, Icon (32 / 64 previews render), Op factory, Public export.
- Selecting a Bundle member navigates to the corresponding tool/action.

- [ ] **Step 4: Stop the dev server and commit any final touch-ups**

If any rendering issues require small fixes, commit them as a follow-up:

```bash
git add -p
git commit -m "fix(swill): registry inspector polish from manual smoke"
```

- [ ] **Step 5: Push the branch**

Confirm with the user before pushing (per project conventions). When approved:

```bash
git push -u origin worktree-bundle-inspector
```

---

## Self-Review

**Spec coverage**

- Bundle filter dropdown — Task 5 ✓
- Categorized tree with text filter — Tasks 4 + 5 ✓
- Top-level categories (Tools, Actions, Shape kinds, Bundles, Icons, Op factories, Public exports) — Task 5 ✓
- Detail pane content per leaf type — Tasks 6 + 7 ✓
- Hybrid data sources (runtime probe + barrel imports) — Tasks 2 + 3 ✓
- Source-file paths + JSDoc snippets via Vite raw glob — Task 8 ✓
- `#/dev/registry` route — Task 1 ✓
- Files added match spec — Tasks 1, 2, 3, 4, 6, 8 ✓
- Out-of-scope items confirmed not implemented (no live sandbox, no conflict cross-references, no persisted URL state, no bundle diffing) ✓
- Kit-barrel-drift follow-up TODO — committed with the spec ✓

**Placeholder scan:** Task 8's lazy loader resolves the temporary `SimpleDetail` placeholder text added in Task 7. No remaining placeholders.

**Type consistency:** `TreeEntry` discriminator (`kind`) and per-entry shapes are pinned in Task 2 and consumed unchanged in subsequent tasks. `RegistrySnapshot` shape (`{ tools, actions }`) is consistent between Tasks 3 and 5.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-bundle-inspector.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
