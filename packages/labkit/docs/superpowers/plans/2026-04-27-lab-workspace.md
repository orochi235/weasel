# Labkit Plan 3 — Lab/Workspace Runtime

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `<Lab>` and `<Workspace>` compound components, workspace lifecycle operations, slot render props, theme application, and the minimal example. This plan assumes Plan 1 (Foundation) is merged and Plan 2 (state-runtime) is available at `src/state/`.

**Architecture:** `<Lab>` creates a scoped Zustand store via `createLabStore` (Plan 2), provides it through `LabContext`, and renders `<LabShell>` + `<WorkspaceGrid>` (Plan 1). `<Workspace>` composes Plan 1 primitives into a chrome layer around the instrument's render output. Pure workspace operations live in `workspaceOps.ts` (testable without React).

**Design spec:** `docs/superpowers/specs/2026-04-27-lab-workspace-design.md`

**Tech stack (unchanged from Plan 1):** React 19, TypeScript 6, Vitest 4, @testing-library/react, Storybook 8.x, LESS, Biome.

---

## File Structure After This Plan

```
labkit/
  src/
    lab/
      Lab.tsx                 ← new
      Lab.less                ← new
      Lab.test.tsx            ← new
      Lab.stories.tsx         ← new
      LabContext.ts           ← new
      LabContext.test.ts      ← new
      index.ts                ← extend existing
      (existing Plan 1 files unchanged)
    workspace/
      Workspace.tsx           ← new
      WorkspaceChrome.tsx     ← new
      DefaultToolbar.tsx      ← new
      DefaultSidebar.tsx      ← new
      DefaultStatusBar.tsx    ← new
      workspaceOps.ts         ← new
      workspaceOps.test.ts    ← new
      Workspace.less          ← new
      Workspace.test.tsx      ← new
      Workspace.stories.tsx   ← new
      index.ts                ← new
    index.ts                  ← extend existing
  examples/
    minimal/
      index.html              ← new
      main.tsx                ← new
      MinimalLab.tsx          ← new
      StubInstrument.ts       ← new
```

---

## Task 1: `workspaceOps.ts` — pure workspace operations

**Files:**
- Create: `src/workspace/workspaceOps.ts`
- Create: `src/workspace/workspaceOps.test.ts`

**Why first:** these are pure functions with no React dependency; writing tests first validates the operation contract before any component uses it.

- [ ] **Step 1: Write failing tests in `workspaceOps.test.ts`**

Cover:
- `addWorkspace`: appends a new record; id is unique; uses `instrument.defaultConfig()` + `instrument.initialState()`; uses `instrument.canvas.initialView` when present; defaults view to `{ zoom: 1, pan: { x: 0, y: 0 } }` when canvas is absent.
- `cloneWorkspace`: inserts clone immediately after source; clone has a new id; config/state/view are deep copies; original is unchanged.
- `closeWorkspace`: removes the workspace with the given id; returns unchanged array when called on the only remaining workspace (no-op).
- `resetWorkspace`: resets config to `defaultConfig()`, state to `initialState(defaultConfig)`, view to `canvas.initialView ?? default`; does not change `instrumentName`.
- All functions are pure (return new arrays; do not mutate inputs).

Run: `npx vitest run src/workspace/workspaceOps.test.ts`
Expected: all tests fail (not found).

- [ ] **Step 2: Implement `workspaceOps.ts`**

```ts
import type { Instrument, WorkspaceRecord } from '../state';

export function addWorkspace(
  workspaces: WorkspaceRecord[],
  instruments: Instrument[],
  instrumentName: string,
): WorkspaceRecord[];

export function cloneWorkspace(
  workspaces: WorkspaceRecord[],
  id: string,
): WorkspaceRecord[];

export function closeWorkspace(
  workspaces: WorkspaceRecord[],
  id: string,
): WorkspaceRecord[];

export function resetWorkspace(
  workspaces: WorkspaceRecord[],
  id: string,
  instruments: Instrument[],
): WorkspaceRecord[];
```

Use `crypto.randomUUID()` for new ids. Use `structuredClone` for deep copies.

- [ ] **Step 3: Run tests — expect all pass**

Run: `npx vitest run src/workspace/workspaceOps.test.ts`
Expected: all green.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/workspace/workspaceOps.ts src/workspace/workspaceOps.test.ts
git commit -m "Add pure workspace operations (add/clone/close/reset)"
```

---

## Task 2: `LabContext.ts` — React context + `useLabContext` hook

**Files:**
- Create: `src/lab/LabContext.ts`
- Create: `src/lab/LabContext.test.ts`

- [ ] **Step 1: Write failing test**

In `LabContext.test.ts`, test that calling `useLabContext()` outside a `<LabContext.Provider>` throws an error with a message containing "useLabContext must be used inside <Lab>".

Run: `npx vitest run src/lab/LabContext.test.ts`
Expected: test fails (module not found).

- [ ] **Step 2: Implement `LabContext.ts`**

```ts
import { createContext, useContext } from 'react';
import type { Instrument, WorkspaceRecord, SaveSlot } from '../state';

export interface LabContextValue {
  instruments: Instrument[];
  workspaces: WorkspaceRecord[];
  addWorkspace: (instrumentName: string) => void;
  cloneWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  resetWorkspace: (id: string) => void;
  savedSlots: SaveSlot[];
  saveToSlot: (workspaceId: string, label?: string) => void;
  loadFromSlot: (workspaceId: string, slotId: string) => void;
  theme: 'auto' | 'light' | 'dark';
  setTheme: (t: 'auto' | 'light' | 'dark') => void;
}

export const LabContext = createContext<LabContextValue | null>(null);

export function useLabContext(): LabContextValue {
  const ctx = useContext(LabContext);
  if (ctx === null) {
    throw new Error('useLabContext must be used inside <Lab>');
  }
  return ctx;
}
```

- [ ] **Step 3: Run tests — expect pass**

Run: `npx vitest run src/lab/LabContext.test.ts`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/lab/LabContext.ts src/lab/LabContext.test.ts
git commit -m "Add LabContext and useLabContext hook with guard"
```

---

## Task 3: `<Lab>` component

**Files:**
- Create: `src/lab/Lab.tsx`
- Create: `src/lab/Lab.less`
- Create: `src/lab/Lab.test.tsx` (initial test shell — expanded in Task 8)

- [ ] **Step 1: Write failing smoke test in `Lab.test.tsx`**

Test: renders without crashing using `StubInstrument` (import from `../../examples/minimal/StubInstrument` — create a minimal stub inline in the test file for now).

Run: `npx vitest run src/lab/Lab.test.tsx`
Expected: fails (module not found).

- [ ] **Step 2: Implement `Lab.tsx`**

Props (from design spec §4.1):
```ts
interface LabProps {
  instruments: Instrument[];
  defaultInstrument: string;
  storage?: StorageAdapter | null;
  storageKey?: string;
  theme?: 'auto' | 'light' | 'dark';
  title?: string;
  toolbar?: ToolbarSlot;
  sidebar?: SidebarSlot;
  statusBar?: StatusBarSlot;
  children?: ReactNode;
}
```

Mount sequence (design spec §4.2):
1. Validate `instruments` non-empty (throw descriptive error if empty — `process.env.NODE_ENV !== 'production'`).
2. Call `createLabStore(instruments, storage ?? labkit.storage.none, storageKey ?? 'labkit')`.
3. Hydrate: restore persisted workspaces; fall back to one workspace with `defaultInstrument`.
4. Provide `LabContext`.
5. Compute `themeClass`: `''` for `'auto'`, `'lk-theme-light'` for `'light'`, `'lk-theme-dark'` for `'dark'`.
6. Render:
   ```tsx
   <LabContext.Provider value={contextValue}>
     <LabShell className={themeClass}>
       {/* header */}
       {/* WorkspaceGrid + Workspace children */}
     </LabShell>
   </LabContext.Provider>
   ```

Use `React.useMemo` to stabilize the context value object.

- [ ] **Step 3: Write `Lab.less`**

```less
.lk-lab {
  // no additional styles beyond LabShell in Plan 3
  // placeholder for future lab-specific overrides
}
```

- [ ] **Step 4: Run smoke test — expect pass**

Run: `npx vitest run src/lab/Lab.test.tsx`
Expected: green.

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lab/Lab.tsx src/lab/Lab.less src/lab/Lab.test.tsx
git commit -m "Add <Lab> component — provider + LabShell + WorkspaceGrid wiring"
```

---

## Task 4: Workspace slot types

**Files:**
- Create: `src/workspace/slotTypes.ts`

These types are needed by both `<Workspace>` and `<DefaultToolbar>`.

- [ ] **Step 1: Write `slotTypes.ts`**

Define (from design spec §2.3):
- `WorkspaceToolbarContext`
- `WorkspaceSidebarContext`
- `WorkspaceStatusBarContext`
- `ToolbarSlot = (ctx: WorkspaceToolbarContext) => ReactNode`
- `SidebarSlot = (ctx: WorkspaceSidebarContext) => ReactNode`
- `StatusBarSlot = (ctx: WorkspaceStatusBarContext) => ReactNode`

No tests needed for a types-only file. Type-check is sufficient.

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/workspace/slotTypes.ts
git commit -m "Add workspace slot context types"
```

---

## Task 5: `<DefaultToolbar>` component

**Files:**
- Create: `src/workspace/DefaultToolbar.tsx`

- [ ] **Step 1: Write failing test (inline in `Workspace.test.tsx` placeholder)**

Create `src/workspace/Workspace.test.tsx` as a shell. Add one test: `<DefaultToolbar>` renders a close button; close button is disabled when `isLastWorkspace` is true; undo/redo buttons are absent when `hasUndo` is false; zoom buttons are absent when `hasCanvas` is false.

Run: `npx vitest run src/workspace/Workspace.test.tsx`
Expected: fails.

- [ ] **Step 2: Implement `DefaultToolbar.tsx`**

Uses `<Toolbar>`, `<Toolbar.Button>`, `<Toolbar.Spacer>` from `src/primitives`.

Structure (from design spec §5.3):
- Undo/Redo buttons: render only when `ctx.hasUndo === true`; disabled when `!ctx.canUndo` / `!ctx.canRedo`.
- Zoom controls: render only when `ctx.hasCanvas === true`.
- Zoom level: `<span className="lk-toolbar__zoom-label">{Math.round(ctx.zoom * 100)}%</span>`.
- Save button: always present; `onClick={() => ctx.saveToSlot()}`.
- Load dropdown: render only when `ctx.savedSlots.length > 0`; Plan 3 uses a native `<select>` element — **CLAUDE'S DEFAULT** (a proper dropdown is a Plan 4+ enhancement).
- Clone button: `onClick={ctx.clone}`.
- Reset button: `onClick={ctx.reset}`.
- Close button: `disabled={ctx.isLastWorkspace}`, `onClick={ctx.close}`.

Keyboard shortcuts: attach `onKeyDown` handlers to each button for the shortcuts listed in design spec §5.3. Note: shortcut scope (focused workspace) is implemented in `WorkspaceChrome` in Task 6.

Export `DefaultToolbar` as a named export (consumers can import it for custom toolbar composition).

- [ ] **Step 3: Run toolbar tests — expect pass**

Run: `npx vitest run src/workspace/Workspace.test.tsx`
Expected: green (toolbar tests only — WorkspaceChrome tests added in Task 6).

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/workspace/DefaultToolbar.tsx src/workspace/Workspace.test.tsx
git commit -m "Add DefaultToolbar with capability-gated buttons"
```

---

## Task 6: `<DefaultSidebar>`, `<DefaultStatusBar>`, `<WorkspaceChrome>`

**Files:**
- Create: `src/workspace/DefaultSidebar.tsx`
- Create: `src/workspace/DefaultStatusBar.tsx`
- Create: `src/workspace/WorkspaceChrome.tsx`

- [ ] **Step 1: Implement `DefaultSidebar.tsx`**

```tsx
// Renders a placeholder div when no ControlPanel is available (Plan 4)
// className="lk-sidebar__placeholder"
// content: instrumentName + " controls (coming in Plan 4)"
```

Uses `<Sidebar>` from `src/primitives` as the outer frame.

- [ ] **Step 2: Implement `DefaultStatusBar.tsx`**

Content: `{ctx.instrumentName} · {Math.round(ctx.zoom * 100)}%`
Uses `<StatusBar>` from `src/primitives` as the outer frame.

- [ ] **Step 3: Implement `WorkspaceChrome.tsx`**

Props:
```ts
interface WorkspaceChromeProps {
  workspaceId: string;
  record: WorkspaceRecord;
  instrument: Instrument;
  isLastWorkspace: boolean;
  toolbar?: ToolbarSlot;
  sidebar?: SidebarSlot;
  statusBar?: StatusBarSlot;
  children: ReactNode;    // instrument.render output
}
```

Structure:
```tsx
<div
  className="lk-workspace"
  tabIndex={0}
  onKeyDown={handleKeyDown}  // keyboard shortcut dispatch
>
  <div className="lk-workspace__toolbar">
    {toolbar ? toolbar(toolbarCtx) : <DefaultToolbar ctx={toolbarCtx} />}
  </div>
  <div className="lk-workspace__body">
    <div className="lk-workspace__sidebar">
      {sidebar ? sidebar(sidebarCtx) : <DefaultSidebar ctx={sidebarCtx} />}
    </div>
    <div className="lk-workspace__content">
      {children}
    </div>
  </div>
  <div className="lk-workspace__status">
    {statusBar ? statusBar(statusCtx) : <DefaultStatusBar ctx={statusCtx} />}
  </div>
</div>
```

`handleKeyDown` dispatches Cmd/Ctrl+Z → `toolbarCtx.undo`, Cmd/Ctrl+Shift+Z → `toolbarCtx.redo`, Cmd/Ctrl+S → `toolbarCtx.saveToSlot()`, etc.

Build `toolbarCtx: WorkspaceToolbarContext` from `record`, `instrument`, and Lab store actions sourced from `useLabContext()`.

- [ ] **Step 4: Add `WorkspaceChrome` tests to `Workspace.test.tsx`**

Tests:
- Renders children.
- Renders default toolbar when no `toolbar` prop.
- Renders custom toolbar when `toolbar` prop provided.
- Keyboard shortcut Cmd+S calls `saveToSlot`.

- [ ] **Step 5: Run all workspace tests**

Run: `npx vitest run src/workspace/`
Expected: all green.

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/workspace/DefaultSidebar.tsx src/workspace/DefaultStatusBar.tsx src/workspace/WorkspaceChrome.tsx src/workspace/Workspace.test.tsx
git commit -m "Add DefaultSidebar, DefaultStatusBar, WorkspaceChrome with slot dispatch"
```

---

## Task 7: `<Workspace>` component + LESS + barrel exports

**Files:**
- Create: `src/workspace/Workspace.tsx`
- Create: `src/workspace/Workspace.less`
- Create: `src/workspace/index.ts`

- [ ] **Step 1: Implement `Workspace.tsx`**

`<Workspace>` is a thin wrapper: it reads its `WorkspaceRecord` from `useLabContext()` by id and renders `<WorkspaceChrome>` with the instrument resolved from `instruments`.

```ts
interface WorkspaceProps {
  id: string;
}
```

Instrument is looked up by `record.instrumentName`. If not found, render a fallback `<div className="lk-workspace lk-workspace--unknown">Unknown instrument: {record.instrumentName}</div>`. **CLAUDE'S DEFAULT.**

Call `instrument.render(renderCtx)` where `renderCtx` is the minimal RenderContext (design spec §3 note):
```ts
const renderCtx: RenderContext<unknown, unknown> = {
  state: record.state,
  config: record.config,
  setState: (next) => store.setState(record.id, next),
  setConfig: (key, value) => store.setConfig(record.id, key, value),
  workspace: {
    id: record.id,
    zoom: record.view.zoom,
    setZoom: (z) => store.setZoom(record.id, z),
  },
  emit: (_event) => { /* no-op stub; Plan 5 implements */ },
};
```

- [ ] **Step 2: Write `Workspace.less`**

```less
.lk-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lk-bg);
  border: 1px solid var(--lk-border);
  border-radius: var(--lk-radius);
  overflow: hidden;

  &__body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  &__sidebar {
    flex-shrink: 0;
  }

  &__content {
    flex: 1;
    overflow: auto;
  }

  &__toolbar {
    flex-shrink: 0;
    border-bottom: 1px solid var(--lk-divider);
  }

  &__status {
    flex-shrink: 0;
    border-top: 1px solid var(--lk-divider);
  }

  &--unknown {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--lk-text-muted);
    font-size: var(--lk-font-size-sm);
  }
}
```

- [ ] **Step 3: Write `src/workspace/index.ts`**

Export: `Workspace`, `DefaultToolbar`, `WorkspaceChrome`, `workspaceOps`, and all slot types from `slotTypes.ts`.

- [ ] **Step 4: Run full workspace test suite**

Run: `npx vitest run src/workspace/`
Expected: all green.

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/workspace/Workspace.tsx src/workspace/Workspace.less src/workspace/index.ts
git commit -m "Add <Workspace> component and workspace barrel exports"
```

---

## Task 8: Full `<Lab>` integration tests + theme application

**Files:**
- Extend: `src/lab/Lab.test.tsx`

- [ ] **Step 1: Add integration test cases**

New tests (each ≤ 10 lines using `@testing-library/react`):

1. **Renders one workspace by default** — `queryAllByRole('region')` finds 1 workspace.
2. **addWorkspace adds a second workspace** — call `addWorkspace('Stub')` via `useLabContext()`; expect 2 workspaces.
3. **closeWorkspace removes it** — two workspaces → close one → one remains.
4. **closeWorkspace no-op on last** — one workspace → close → still one.
5. **cloneWorkspace inserts after source** — clone ws[0]; expect order [ws0, clone, ws1] when there were two.
6. **resetWorkspace restores defaults** — mutate state, then reset; state equals `initialState(defaultConfig)`.
7. **theme="light" applies lk-theme-light class** — `container.firstChild` has class `lk-theme-light`.
8. **theme="dark" applies lk-theme-dark class**.
9. **theme="auto" applies no theme class** (neither `lk-theme-light` nor `lk-theme-dark`).
10. **setTheme updates class at runtime** — mount with `theme="auto"`, call `setTheme('light')`, expect class update.
11. **throws when instruments is empty array** — `expect(() => render(<Lab instruments={[]} .../>)).toThrow()`.
12. **unknown defaultInstrument on fresh mount** — if storage is none and `defaultInstrument` doesn't match any instrument name, should throw (dev) or fall back (prod). Test the dev path.

- [ ] **Step 2: Run all Lab tests**

Run: `npx vitest run src/lab/`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/lab/Lab.test.tsx
git commit -m "Add Lab integration tests: lifecycle, theme, error paths"
```

---

## Task 9: Update `src/lab/index.ts` and `src/index.ts`

**Files:**
- Extend: `src/lab/index.ts`
- Extend: `src/index.ts`

- [ ] **Step 1: Extend `src/lab/index.ts`**

Add exports for `Lab`, `LabContext`, `useLabContext`, `LabContextValue`.

- [ ] **Step 2: Extend `src/index.ts`**

Add re-exports from `./workspace` and new `./lab` exports. Ensure `Instrument`, `WorkspaceRecord`, `SaveSlot`, `RenderContext` are re-exported from `./state` so consumers get them from the main entry point.

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Verify no class-prefix violations**

Run: `npx tsx scripts/check-class-prefix.ts`
Expected: no violations.

- [ ] **Step 5: Commit**

```bash
git add src/lab/index.ts src/index.ts
git commit -m "Wire Lab and Workspace into main package barrel exports"
```

---

## Task 10: Storybook stories

**Files:**
- Create: `src/lab/Lab.stories.tsx`
- Create: `src/workspace/Workspace.stories.tsx`

- [ ] **Step 1: Write `Lab.stories.tsx`**

Two stories:
- `Default`: single `StubInstrument`, `theme="auto"`, no header children.
- `TwoWorkspaces`: `StubInstrument`, initial state has two workspaces (mount then call `addWorkspace` in a `play` function).

Both stories import `StubInstrument` from a local stub defined at the top of the story file (do not import from `examples/`).

- [ ] **Step 2: Write `Workspace.stories.tsx`**

One story using a mock `LabContext.Provider` to render `<WorkspaceChrome>` in isolation with a `StubInstrument` record. Show: default toolbar, no undo buttons, no zoom controls.

- [ ] **Step 3: Verify Storybook builds**

Run: `npx storybook build --quiet`
Expected: exits 0; no component import errors.

- [ ] **Step 4: Commit**

```bash
git add src/lab/Lab.stories.tsx src/workspace/Workspace.stories.tsx
git commit -m "Add Lab and Workspace Storybook stories"
```

---

## Task 11: `examples/minimal/` — Vite dev entry

**Files:**
- Create: `examples/minimal/StubInstrument.ts`
- Create: `examples/minimal/MinimalLab.tsx`
- Create: `examples/minimal/main.tsx`
- Create: `examples/minimal/index.html`
- Extend: `vite.config.ts`

- [ ] **Step 1: Write `StubInstrument.ts`**

Per design spec §9:
```ts
import { defineInstrument } from '@labkit/react';

export const StubInstrument = defineInstrument<
  { doubled: number },
  { value: number }
>({
  name: 'Stub',
  configSchema: () => [
    { key: 'value', label: 'Value', type: 'slider', min: 0, max: 100, default: 50 },
  ],
  defaultConfig: () => ({ value: 50 }),
  initialState: (config) => ({ doubled: config.value * 2 }),
  render: ({ state }) => (
    <div className="lk-stub-display">
      doubled: {state.doubled}
    </div>
  ),
});
```

Note: `lk-stub-display` is a valid `lk-` prefixed class but lives in `examples/`; the class-prefix script only scans `src/`. No `.less` file needed.

- [ ] **Step 2: Write `MinimalLab.tsx`**

```tsx
import { Lab } from '@labkit/react';
import { StubInstrument } from './StubInstrument';

export function MinimalLab() {
  return (
    <Lab
      instruments={[StubInstrument]}
      defaultInstrument="Stub"
      storageKey="minimal-lab"
      title="Minimal Lab"
    />
  );
}
```

- [ ] **Step 3: Write `main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@labkit/react/styles.css';
import { MinimalLab } from './MinimalLab';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(<StrictMode><MinimalLab /></StrictMode>);
```

- [ ] **Step 4: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Minimal Lab</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/examples/minimal/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Update `vite.config.ts` to use `examples/minimal/index.html` as the dev entry**

The root `vite.config.ts` should have `root: 'examples/minimal'` (or equivalent) so `npm run dev` serves the minimal example. Verify the existing config doesn't break Storybook (Storybook uses its own Vite config via `@storybook/react-vite`).

- [ ] **Step 6: Verify dev server starts**

Run: `npx vite --root examples/minimal build` (build-only check; avoids needing an interactive server).
Expected: exits 0 or exits with a known "no output dir" warning; no import errors.

- [ ] **Step 7: Commit**

```bash
git add examples/minimal/ vite.config.ts
git commit -m "Add examples/minimal with StubInstrument and MinimalLab"
```

---

## Task 12: LESS stylesheet integration

**Files:**
- Extend: `src/styles.less`

- [ ] **Step 1: Import new LESS files**

Add to `src/styles.less`:
```less
@import './lab/Lab.less';
@import './workspace/Workspace.less';
```

- [ ] **Step 2: Verify build compiles LESS**

Run: `npm run build:css`
Expected: `dist/styles.css` updated; no LESS compile errors.

- [ ] **Step 3: Lint and class-prefix check**

Run: `npx biome check src/lab/Lab.tsx src/workspace/`
Run: `npx tsx scripts/check-class-prefix.ts`
Expected: no violations.

- [ ] **Step 4: Commit**

```bash
git add src/styles.less dist/styles.css
git commit -m "Add Lab and Workspace LESS to stylesheet bundle"
```

---

## Task 13: Smoke test — full run

**Goal:** All tests pass, Storybook builds, dev server builds, type-check clean, lint clean.

- [ ] **Step 1: Full test run**

Run: `npx vitest run`
Expected: all tests pass. Coverage output shown (no minimum enforced yet; visual confirmation only).

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: exits 0.

- [ ] **Step 3: Lint**

Run: `npx biome check . && npx tsx scripts/check-class-prefix.ts`
Expected: no errors.

- [ ] **Step 4: Storybook build**

Run: `npx storybook build --quiet`
Expected: exits 0.

- [ ] **Step 5: Minimal example build**

Run: `npx vite build --root examples/minimal --outDir ../../dist-examples/minimal`
Expected: exits 0.

- [ ] **Step 6: Library build**

Run: `npm run build`
Expected: `dist/` updated; no errors.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "Plan 3 complete: Lab/Workspace runtime + minimal example"
```

---

## Summary

**Total tasks:** 13
**Total steps:** ~52

**Key dependencies between tasks:**
- Task 1 (workspaceOps) has no React deps — do it first.
- Task 2 (LabContext) has no component deps — can be done in parallel with Task 1.
- Task 3 (Lab) depends on Tasks 1 + 2.
- Tasks 4–7 (Workspace layer) depend on Tasks 1–2; can proceed in parallel with Task 3.
- Task 8 (Lab integration tests) depends on Tasks 3 + 5–7.
- Tasks 9–12 can be done in any order after Tasks 3–8.
- Task 13 (smoke test) is always last.

**CLAUDE'S DEFAULT decisions flagged in this plan (see spec §11 for full list):**
1. Empty `instruments` array → throw in dev
2. `storage: null` → `labkit.storage.none`
3. Zoom controls hidden (not disabled) when no canvas capability
4. Close button disabled (no-op) when only one workspace remains
5. Persisted workspaces override `defaultInstrument` on hydration
6. Keyboard shortcuts scoped to focused workspace div
7. Lab-level slot props are uniform across all workspaces (no per-workspace overrides in Plan 3)
8. `setTheme` exposed on `useLabContext()` for runtime toggle
9. Workspace view (zoom/pan) preserved on clone
10. Native `<select>` for load slot dropdown (proper dropdown deferred to Plan 4+)
11. `ControlPanel` sidebar is a placeholder div until Plan 4
12. Unknown instrument on hydration → skip + console warning (not crash)
