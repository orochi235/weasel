# labkit Menu Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every `<Lab>` one lab-wide actions registry, register the header's commands in it, draw a menu bar of those commands (plus menus a lab declares) across the top of the lab, and give labs context menus.

**Architecture:** A new `<LabActions>` wraps the lab's shell in one `ActionsProvider` with one keyboard-`'first'` dispatcher; `LabZoom`'s own provider and dispatcher fold into it. Every trial's camera scope (`InputScope`) now nests under that registry, which is what lets one `ContextMenuHost` serve every trial — and also why the lab's dispatcher must hear only the actions registered at its own node, a new routing option. Header commands register through `useCommand`; a pure function builds the bar's schema from them and from `<Lab menus>`, and `MenuBar` draws it above the header.

**Tech Stack:** React 19, TypeScript, `@weasel-js/core` / `routing` (actions, dispatcher, `useCommand`, `useMenus`), `@weasel-js/prefs` (`pref.*` schemas), `@weasel-js/ui` (`MenuBar`, `ContextMenuHost`), vitest (jsdom projects + `browser`), biome (labkit).

**Spec:** `docs/superpowers/specs/2026-10-16-menus-as-layout-assets-design.md` — "Consumers" (labkit paragraphs), "Landed" (`MenuBar`, `useCommand`, access letters), "Order".

## Global Constraints

- Work in a new worktree off `main` (after `menus-arc-2` has merged): `git worktree add .claude/worktrees/labkit-menu-bar -b labkit-menu-bar main`, then `EnterWorktree` on it, then `npm ci` in it (a worktree without its own `node_modules` builds against the main checkout's).
- **No local test, typecheck, lint or build runs.** Tests run on the fleet node:
  `onto do --node teitou --ref origin/main -- npx vitest run --project=<project> <path>`.
  Projects: labkit → `labkit`; forge → `forge` (a test starting a vite server → `forge-node`); routing and ui → `weasel-ui`; any `*.browser.test.tsx` → `browser`. Running vitest from inside a package finds zero files and looks like a pass.
- Typecheck on the node: `onto do --node teitou --ref origin/main -- npm run typecheck`. labkit lint (biome, class-prefix, design tokens): `onto do --node teitou --ref origin/main -- npm run lint -w @weasel-js/labkit`. `npm run check:imports` on the node after any import of a new package.
- `npm run check:size` runs locally; no source file over 400 lines or function over 120. `lab/Lab.tsx` is 325 lines — new code goes in new files, not into it.
- Commit by explicit path (`git add <paths>`), never `git add -A`/`.`. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every changeset is `patch`. Never write a `bump-approved` marker.
- New CSS classes in labkit start `lk-` (the class-prefix check fails otherwise); colors and sizes come from `--wzl-*` tokens.
- Mount labs in tests with `renderSettled` (`@weasel-js/react/testing/renderSettled`) and make store-changing `act`s async: windease stores notify on a microtask.
- From the owner: the menu bar is **new surface**. Nothing moves out of an existing component — the header keeps add-trial, zoom, its contributions and the theme switcher; the bar holds them *as well*. Per-trial commands stay on the trial windows, and `useTrialKeys` keeps routing trial keys, untouched. Access letters are supported, never required (built-in menus declare none). No `@internal`/`@experimental` API reaches a consumer: labkit may use `ActionsProvider`, `useActionsRegistry`, `contextMenuAction` internally, but its public props and types name only `useCommand`/`CommandOptions`, `MenuDef`, `PrefGroup`.
- Command ids, exactly: `lab.add.<instrument name>`, `lab.mode.auto` / `lab.mode.light` / `lab.mode.dark`, `lab.zoom` (variants `in`, `out`, `reset`), `lab.<contribution id>` for a header item contribution, and in forge `fg.global.<key>.<value>`.
- The arc ends with: `npm run test:fleet -- HEAD --node teitou` green on the branch (its log shows `fleet-tree: N changed path(s) match <sha>` and the gate test passed), a `--no-ff` merge to `main`, the fleet run again on `main` in the background, this plan deleted, the worktree removed and the branch deleted.

## Review Focus

- **A key bound inside a trial's scope** (an in-document story's `SceneCanvas`, now nested under the lab registry) must not be run by the lab's `'first'` dispatcher; it fires only through its own canvas, as today. Test in Task 2.
- **A lab command's key typed into a text field** (⌘I in a story's search box) must type, not run the command — the old forge listener skipped editable targets. Test in Task 3.
- **`<LabZoom>` mounted outside `<Lab>`** — it is a public export — keeps working with its keys. Test in Task 2.
- **A right-click on a trial in a lab that declares no context menu** keeps the browser's native menu (the `contextMenu` channel `preventDefault`s unconditionally once attached). Test in Task 5.
- **An embedded or presenting lab** (`header={false}`, `present`) shows no menu bar and binds no F10. Test in Task 4.

---

### Task 1: A dispatcher that hears only its own node's actions

Every `InputScope` nests under the registry in scope, and an `ActionsProvider` root reads down its active scope (`ScopeNode.start()`), so a no-canvas dispatcher on the lab's root would match every key bound in whichever trial is active, ahead of that trial's own dispatcher. This adds the option the lab needs.

**Files:**
- Modify: `packages/routing/src/interactions/dispatcher/gestureDispatcherOptions.ts` (add `hears`)
- Modify: `packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx`, `packages/routing/src/interactions/dispatcher/walk.ts` (both `list()` reads), and the `DispatcherContext` type they share
- Modify: `packages/routing/src/interactions/actions/ActionsProvider.tsx` (`ActionsNode.ownActions()`)
- Test: `packages/routing/src/interactions/dispatcher/dispatcher.hears.test.tsx`
- Create: `.changeset/dispatcher-hears-own.md`

**Interfaces:**
- Produces: `UseGestureDispatcherOptions.hears?: 'scope' | 'own'` — doc: "Which actions this dispatcher matches. `'scope'` (default): every action a read from `actions` reaches, down its active scope. `'own'`: only those registered at `actions`' own node — for chrome on a root that canvases nest under." `ActionsNode.ownActions(): readonly Action[]` (this node's live, unmuted, tuned registrations; not exported from the package). A registry that is not an `ActionsNode` (a test fake) falls back to `list()`.

- [ ] **Step 1: Write the failing tests** — each mounts `DepRegistryProvider > ActionsProvider > ActiveToolContextProvider`, a no-canvas dispatcher on the root (`canvasRef: { current: null }`, `channels: { contextMenu: false, ingest: false }`, `keyboard: 'first'`), and an `<InputScope>` child that registers an action:

```tsx
it("with hears 'own', does not run a key bound in a scope below its registry", ...)
  // child scope registers { id: 'child.x', defaultBinding: { kind: 'key', key: 'x' } }
  // fireEvent.keyDown(window, { key: 'x' }) → expect(childRun).not.toHaveBeenCalled()
it("with hears 'own', runs a key bound at its own node", ...)
  // root registers 'root.y' bound to 'y' → keyDown 'y' → expect(rootRun).toHaveBeenCalledTimes(1)
it("by default still runs a key bound in the active scope below it", ...)
  // same as the first, no `hears` → expect(childRun).toHaveBeenCalledTimes(1)
```

- [ ] **Step 2: Run, expect the first to fail** — `onto do --node teitou --ref origin/main -- npx vitest run --project=weasel-ui packages/routing/src/interactions/dispatcher/dispatcher.hears.test.tsx`. Expected: test 1 FAILS (`childRun` called once); 2 and 3 pass. If test 3 fails, the premise is wrong — stop and report.
- [ ] **Step 3: Implement** `hears` as above: `useGestureDispatcher` hands the context a `listActions: () => readonly Action[]` and both `list()` reads in `walk.ts` go through it.
- [ ] **Step 4: Run, expect all three to pass**, then the existing dispatcher suite: `... --project=weasel-ui packages/routing/src/interactions/dispatcher/`.
- [ ] **Step 5: Changeset** (`'@weasel-js/routing': patch`): "`useGestureDispatcher` takes `hears: 'own'`, which matches only the actions registered at its registry's own node and not those of the canvases nested under it."
- [ ] **Step 6: Commit** — `git add` the four source files, the test and the changeset; message `add a dispatcher option that hears only its own node's actions`.

---

### Task 2: One lab-wide registry, with `LabZoom` folded into it

**Files:**
- Create: `packages/labkit/src/lab/LabActions.tsx`
- Modify: `packages/labkit/src/lab/LabZoom.tsx` (drop its providers and dispatcher; register `lab.zoom`)
- Modify: `packages/labkit/src/lab/Lab.tsx` (wrap the `<LabShell>` inside `ThemeProvider` in `<LabActions>`)
- Test: `packages/labkit/src/lab/LabActions.test.tsx`; `packages/labkit/src/lab/LabZoom.test.tsx` must pass unchanged
- Create: `.changeset/labkit-lab-actions.md`

**Interfaces:**
- Consumes: `hears: 'own'` (Task 1).
- Produces (labkit-internal, not exported from the package):
  - `function LabActions({ children }: { children: ReactNode }): JSX.Element` — `DepRegistryProvider > ActionsProvider > ActiveToolContextProvider`, one `useGestureDispatcher({ canvasRef: { current: null }, actions, entriesById: NO_TOOLS, channels: { contextMenu: false, ingest: false }, keyboard: 'first', hears: 'own' })`, and `LabActionsContext` set to `true`.
  - `const LabActionsContext: Context<boolean>` (default `false`), and `useInLabActions(): boolean`.
  - `LabZoom` registers one action `lab.zoom` built from core's zoom: `{ ...BASE, id: 'lab.zoom', defaultBinding: KEY_BINDINGS, variants: [{ key: 'in', label: 'Zoom in', params: { kind: 'in' } }, { key: 'out', label: 'Zoom out', params: { kind: 'out' } }, { key: 'reset', label: 'Actual size', params: { kind: 'reset' } }], enabled: live ? true : NotApplicable }`, whose invoker runs `BASE`'s with `view` replaced by `forZoom(camera)` read from its ref — **not** through a `view` dep. Both changes are forced by nesting: a trial's camera scope registers its own `viewport.zoom` (wheel only) and its own `view` dep, and a read from the lab root resolves through the active trial first, so the old id would lose its keys and the old dep would lose "reset means actual size about the middle". Buttons call `registry.trigger('lab.zoom', { kind })`.
  - Outside a `<Lab>` (`useInLabActions()` false), `LabZoom` wraps itself in `<LabActions>`, as it wrapped itself in its own providers before.

- [ ] **Step 1: Write the failing tests** in `LabActions.test.tsx`:

```tsx
it("does not run a key an instrument binds in its trial's scope", ...)
  // stage instrument whose render registers (useActionsRegistry) { id: 'story.x', key 'x' } and mounts no dispatcher
  // await renderSettled(<Lab instruments={[thatInstrument]} defaultInstrument=…/>); keyDown(window,{key:'x'})
  // expect(run).not.toHaveBeenCalled()
it('runs a command a lab registers with useCommand from its children, before any trial is pressed', ...)
  // <Lab …><Cmd/></Lab>, Cmd: useCommand('lab.test', 'Test', run, { keys: { kind: 'key', key: 'k', mods: { mod: true } } })
  // keyDown(window, { key: 'k', ...MOD }) → expect(run).toHaveBeenCalledTimes(1)
it('zooms with Mod+= from a <LabZoom> mounted outside <Lab>', ...)
  // <LabStoreProvider> + LabCommandsContext + CameraRegistryContext with one camera, <LabZoom/>; Mod+= → camera.set called with a larger zoom
it('one zoom action, lab.zoom, lists in, out and actual size with their shortcuts', ...)
  // read the registry from a child: list().find(a => a.id === 'lab.zoom').variants.map(v => v.key) → ['in','out','reset']
```

- [ ] **Step 2: Run, expect failures** — `onto do --node teitou --ref origin/main -- npx vitest run --project=labkit packages/labkit/src/lab/LabActions.test.tsx`. Expected: the useCommand test fails (no registry in scope; dev warning), the `lab.zoom` test fails (no such id). The first test may pass before the change (trials are roots today) — it is a guard for Step 3; confirm it fails if `hears: 'own'` is removed.
- [ ] **Step 3: Implement** `LabActions`, the `LabZoom` changes and the `Lab.tsx` wrap.
- [ ] **Step 4: Run** `LabActions.test.tsx`, `LabZoom.test.tsx` (unchanged, including the story-zoom-key case) and `Lab.test.tsx`: all pass.
- [ ] **Step 5: Changeset** (`'@weasel-js/labkit': patch`): "A lab has one actions registry: the header's zoom runs in it as `lab.zoom`, every trial's input sits under it, and a command a lab registers with `useCommand` from `<Lab>`'s children runs from its keys."
- [ ] **Step 6: Commit** — explicit paths; `run the lab on one actions registry and fold the zoom's into it`.

---

### Task 3: The header's commands, registered

**Files:**
- Create: `packages/labkit/src/lab/LabCommands.tsx`
- Modify: `packages/labkit/src/chrome/labTypes.ts` (header items take `keys`), `packages/labkit/src/chrome/index.ts` and `packages/labkit/src/index.ts` (export `LabHeaderItem`)
- Modify: `packages/labkit/src/lab/Lab.tsx` (mount `<LabCommands>` inside `<LabActions>`)
- Modify: `packages/forge/src/shell/Workshop.tsx` (Info gets `keys`; delete `useInfoShortcut`)
- Test: `packages/labkit/src/lab/LabCommands.test.tsx`, `packages/forge/src/shell/info/StoryInfo.test.tsx`
- Create: `.changeset/labkit-lab-commands.md`, `.changeset/forge-info-command.md`

**Interfaces:**
- Consumes: `LabActions` (Task 2), `useCommand(id, label, run, options?)` from `@weasel-js/core`.
- Produces:
  - `export interface LabHeaderItem<TCtx = LabChromeContext> extends ToolbarItem<TCtx> { /** The keys that run it, wherever focus is in the lab. */ keys?: CommandOptions['keys'] }`; the `region: 'header'` arm of `LabContribution` takes `item: LabHeaderItem<TCtx>`.
  - `function LabCommands({ contributions, addTrial }: { contributions: readonly LabContribution[]; addTrial: boolean }): JSX.Element` — one child component per command, each calling `useCommand`:
    - per instrument, unless `addTrial` is false: `lab.add.<name>`, label `'Add trial'` when there is one instrument, else `instrument.title ?? name`; run `lab.addTrial(name)`.
    - `lab.mode.auto` / `.light` / `.dark`, labels `Auto` / `Light` / `Dark`, run `lab.setMode(m)`, `active: () => mode === m`.
    - per header contribution carrying an `item` (not a `render`): `lab.<id>`, label `item.label`, run `item.onActivate(ctx)` with `useLabChromeContext()`, `enabled` → `NotApplicable` while `item.disabled`, `active` from `item.pressed` when given, `keys: item.keys`.
  - forge's `fg-info` item gains `keys: { kind: 'key', key: 'i', mods: { mod: true } }`; `useInfoShortcut` and its `window` listener are deleted, so ⌘I is the command `lab.fg-info`.

- [ ] **Step 1: Write the failing tests** in `LabCommands.test.tsx` (read the registry from a child of `<Lab>` via `useActionsRegistry()`):

```tsx
it('registers lab.add.<name> per instrument, and running one adds that trial', ...)
  // two instruments → ids include 'lab.add.Staged','lab.add.Plain'; trigger('lab.add.Plain') → lab.trials.length +1, last is Plain
it('labels the add command "Add trial" when the lab has one instrument', ...)
it('registers no add command with addTrial={false}', ...)
it('registers an add command for an instrument added after mount', ...)
  // rerender with a third instrument → 'lab.add.Third' present
it('registers lab.mode.* and marks the current mode active', ...)
  // trigger('lab.mode.dark') → lab.mode === 'dark'; evaluateActive on lab.mode.dark → true, lab.mode.light → false
it("registers a header item contribution as lab.<id>, run with the lab's chrome context", ...)
  // labChrome=[{ id: 'x-hello', region: 'header', item: { icon, label: 'Hello', onActivate } }] → trigger('lab.x-hello') → onActivate called with an object having addTrial
it('runs a header item from its keys, and not while typing in a text field', ...)
  // item.keys = Mod+J; keyDown(window, Mod+J) → called once; keyDown(<input> inside the lab, Mod+J) → still once
it('registers nothing for a header render contribution', ...)
```

In `StoryInfo.test.tsx`: `it('opens Get Info on Mod+I', ...)` and `it('leaves Mod+I to a focused text field', ...)` — the second focuses an `<input>` the test renders into a lab child and asserts no dialog.

- [ ] **Step 2: Run, expect failures** — `... --project=labkit packages/labkit/src/lab/LabCommands.test.tsx` and `... --project=forge packages/forge/src/shell/info/StoryInfo.test.tsx`. Expected: labkit tests fail (no such ids); forge's Mod+I tests pass on the old listener — they guard the swap.
- [ ] **Step 3: Implement** `LabCommands`, the `LabHeaderItem` type, the `Lab.tsx` mount (pass `labChromeAll` and `addTrial ?? true`), and the forge change.
- [ ] **Step 4: Run** both files plus `packages/labkit/src/lab/LabHeader.test.tsx` and `packages/labkit/src/chrome/labRegions.test.tsx`: all pass. If "not while typing" fails, the dispatcher does not skip editable targets for keys with a modifier: report it rather than adding a listener.
- [ ] **Step 5: Changesets** — labkit: "The lab's header commands — add trial, the color mode, and each header item contribution — are registered actions, `lab.add.<instrument>`, `lab.mode.<mode>` and `lab.<id>`; a header item's new `keys` binds it lab-wide." forge: "Get Info's ⌘I is the Info command's own key rather than a window listener."
- [ ] **Step 6: Commit** — explicit paths; `register the lab header's commands as actions`.

---

### Task 4: The menu bar

**Files:**
- Create: `packages/labkit/src/lab/labMenus.ts` (pure schema builder)
- Create: `packages/labkit/src/lab/LabMenuBar.tsx`
- Modify: `packages/labkit/src/lab/LabShell.tsx` (`menuBar` slot above the header) and `LabShell.less` (`.lk-shell-menubar`)
- Modify: `packages/labkit/src/lab/labProps.ts` (`menus`, `menuBar`), `packages/labkit/src/lab/Lab.tsx` (pass the slot), `packages/labkit/src/lab/index.ts` and `packages/labkit/src/index.ts` (export `LabMenus`)
- Test: `packages/labkit/src/lab/labMenus.test.ts`, `packages/labkit/src/lab/LabMenuBar.test.tsx`, `packages/labkit/src/lab/LabFit.browser.test.tsx` (extend)
- Create: `.changeset/labkit-menu-bar.md`

**Interfaces:**
- Consumes: the command ids from Tasks 2–3; `MenuBar` (`@weasel-js/ui`), `mergeMenuDefs` (`@weasel-js/core`), `pref` (`@weasel-js/prefs`).
- Produces:
  - `export interface LabMenus { /** A bar of groups drawn `as: 'menu'`, each a title on the lab's menu bar. Action leaves name commands registered in the lab, as `useCommand` from `<Lab>`'s children registers them. */ schema: PrefGroup; /** Values behind the schema's boolean and enum leaves, by dotted path. */ values?: Readonly<Record<string, unknown>>; onChange?: (path: string, value: unknown) => void }`
  - `LabBaseProps.menus?: LabMenus`; `LabBaseProps.menuBar?: boolean` — "Draw the lab's menu bar above its header. Default `true`. Dropped with the header (`header={false}`) and while presenting."
  - `LabShellProps.menuBar?: ReactNode` — rendered in a `<div className="lk-shell-menubar">` before `<header>`, only when `bar` is true.
  - `function labMenuBar(opts: { instruments: InstrumentList; addTrial: boolean; zoom: boolean; header: readonly LabContribution[]; declared?: PrefGroup }): PrefGroup` — root `''` with, in order:
    - `lab` — `pref.group('Lab', …, { as: 'menu' })`: `add` (one instrument: `pref.action('lab.add.<name>')`; several: `pref.group('Add trial', { t0: …, t1: … }, { as: 'menu' })`, keyed by index because names may hold dots); then one plain section per header-item `group` in first-appearance order (ungrouped items share one), each child `c-<id>: pref.action('lab.<id>')`.
    - each `declared` top-level child, in declared order;
    - `view` — `pref.group('View', …, { as: 'menu' })`: a `zoom` section `{ zoom: pref.action('lab.zoom') }` when `zoom` (one row per variant), then `theme: pref.group('Theme', { auto, light, dark → pref.action('lab.mode.*') }, { as: 'menu' })`.
    - A declared `as: 'menu'` group whose key is `lab` or `view` merges into the built-in through `mergeMenuDefs` (children appended after a separator, a taken key gets `~n`); there is one merge rule, routing's.
  - `function LabMenuBar({ menus, contributions, addTrial, zoom }: …): JSX.Element` — `<MenuBar schema={labMenuBar(…)} values={menus?.values} onChange={menus?.onChange} label="Lab menu bar" />`, schema memoized on its inputs.

- [ ] **Step 1: Write the failing tests.** `labMenus.test.ts` (pure):

```ts
it('puts Lab first and View last, with declared menus between', ...)
  // declared { tools: menu 'Tools' } → Object.keys(root.children) → ['lab', 'tools', 'view']
it('offers one add row for one instrument and a submenu for several', ...)
it('leaves out add rows with addTrial false and the zoom section with zoom false', ...)
it('lists header item contributions by group, and no render contribution', ...)
it("appends a declared 'view' menu's children to the built-in View after a separator", ...)
```

`LabMenuBar.test.tsx` (full `<Lab>` under `renderSettled`):

```tsx
it('draws a menubar with Lab and View above the header', ...)
  // getByRole('menubar', { name: 'Lab menu bar' }); titles 'Lab','View'; it precedes .lk-shell-header in document order
it('runs Add trial from the Lab menu', ...)        // click 'Lab', click 'Add trial' → trials +1
it("checks the current mode under View › Theme", ...)
it("shows forge-style header items and runs them", ...)   // labChrome header item 'Hello' → row in Lab menu; click → onActivate
it('opens a declared menu by its access letter', ...)      // menus={{ schema: bar with { ...pref.group('Tools', …, { as: 'menu' }), access: 't' } }} → Alt+T opens it
it("binds a declared menu's enum to values and onChange", ...)
it('draws no menu bar, and F10 does nothing, with header={false}, with present, or with menuBar={false}', ...)
it('keeps every header control in the header', ...)        // 'Add trial' button, Zoom toolbar, theme switcher still in .lk-shell-header
```

`LabFit.browser.test.tsx` — extend the existing viewport cases (`wide`, `medium`, `narrow` × hosts) so the lab renders its menu bar (the default), and add: `window.scrollTo(0, 5000)` leaves `window.scrollY === 0`, `.lk-shell`'s height equals the host's, and the menubar's box is above the header's.

- [ ] **Step 2: Run, expect failures** — `... --project=labkit packages/labkit/src/lab/labMenus.test.ts packages/labkit/src/lab/LabMenuBar.test.tsx`. Expected: missing module / no `menubar` role.
- [ ] **Step 3: Implement** `labMenus.ts`, `LabMenuBar.tsx`, the props, the shell slot and `.lk-shell-menubar` (`flex: none`, `--wzl-*` tokens only; the ui `MenuBar` draws its own strip).
- [ ] **Step 4: Run** the two jsdom files, then `Lab.test.tsx`, `LabShell.test.tsx`, `Lab.chrome.test.tsx`: pass. Then the browser case: `onto do --node teitou --ref origin/main -- npx vitest run --project=browser packages/labkit/src/lab/LabFit.browser.test.tsx` — pass. Have the browser test save a screenshot of the `wide` lab and `transom post` it (zone `weasel`).
- [ ] **Step 5: Size and lint** — `npm run check:size` locally; labkit lint on the node.
- [ ] **Step 6: Changeset** (labkit patch): "A lab draws a menu bar above its header: Lab (add trial and the header's item contributions) and View (zoom and color mode), with the menus a lab declares through the new `menus` prop between them. `menuBar={false}` leaves it out; the header keeps every control it had."
- [ ] **Step 7: Commit** — explicit paths; `draw a menu bar across the top of the lab`.

---

### Task 5: Context menus in labs

**Files:**
- Modify: `packages/labkit/src/lab/labProps.ts` (`contextMenus`), `packages/labkit/src/lab/LabActions.tsx` (declare them; mount `ContextMenuHost`; provide `LabContextMenusContext`)
- Modify: `packages/labkit/src/canvas/CameraInput.tsx` (channel and action, behind the context)
- Test: `packages/labkit/src/lab/Lab.contextMenu.test.tsx`
- Create: `.changeset/labkit-context-menus.md`

**Interfaces:**
- Consumes: `LabActions` (Task 2), the `lab.*` commands (Task 3).
- Produces:
  - `LabBaseProps.contextMenus?: readonly MenuDef[]` — "Menus a right-click over a trial's camera opens, picked by each def's `when` (a camera reports no body, so `when: {}` matches anywhere on it). Rows name commands registered in the lab. Memoize or hoist." `LabActions` takes `contextMenus` and calls `useMenus(contextMenus ?? NONE)`.
  - `LabContextMenusContext: Context<boolean>` — true when the lab declares at least one. `CameraInput` reads it: when true, its dispatcher's channels omit `contextMenu: false` and it registers core's `contextMenuAction` beside its other actions; when false, nothing changes. `LoupeGestures` and `TrialOverview` keep `contextMenu: false` — the loupe and the thumbnail grid are not where a trial's menu belongs.
  - One `<ContextMenuHost />` inside `<LabActions>`; every trial's scope shares the lab root's menu host (`InputScope` takes the host in scope), so it draws a menu opened from any trial.

- [ ] **Step 1: Write the failing tests:**

```tsx
it("opens a lab's context menu on a right-click over a trial's camera and runs a row", ...)
  // contextMenus=[{ id: 'lab', when: {}, menu: pref.group('', { dark: pref.action('lab.mode.dark') }) }]
  // fireEvent.contextMenu(stage host el, { clientX: 10, clientY: 10 }) → getByRole('menu') has 'Dark'; click → lab.mode === 'dark'
it("keeps the browser's own menu in a lab that declares none", ...)
  // no contextMenus → expect(fireEvent.contextMenu(stage host el)).toBe(true)   // not prevented
it('mounts one menu host for the lab, whatever the number of trials', ...)
  // two stage trials, right-click the second → one role=menu in the document
```

- [ ] **Step 2: Run, expect failures** — `... --project=labkit packages/labkit/src/lab/Lab.contextMenu.test.tsx`. Expected: test 1 fails (no menu); test 2 passes as a guard.
- [ ] **Step 3: Implement** as above.
- [ ] **Step 4: Run** the file plus `packages/labkit/src/canvas/` and `LabZoom.test.tsx`: pass.
- [ ] **Step 5: Changeset** (labkit patch): "`<Lab contextMenus>` opens declared menus on a right-click over a trial's camera, drawn by one menu host for the lab; a lab declaring none keeps the browser's menu."
- [ ] **Step 6: Commit** — explicit paths; `give labs context menus over their trials' cameras`.

---

### Task 6: forge's globals on the menu bar

**Files:**
- Create: `packages/forge/src/shell/globalsMenu.tsx`
- Modify: `packages/forge/src/shell/GlobalsToolbar.tsx` (export `useLabGlobals`), `packages/forge/src/shell/Workshop.tsx` (pass `menus`, mount `<GlobalsCommands>` as a `<Lab>` child)
- Modify: `packages/forge/package.json` only if `pref` is not reachable through a package forge already depends on
- Test: `packages/forge/src/shell/globalsMenu.test.tsx`
- Create: `.changeset/forge-globals-menu.md`

**Interfaces:**
- Consumes: `LabMenus` (Task 4), `useCommand`.
- Produces:
  - `function globalsMenu(declarations: GlobalDeclarations): PrefGroup` — a bar holding one group `globals: pref.group('Globals', …, { as: 'menu' })`, with one submenu per declaration (`pref.group(declaration.label, …, { as: 'menu' })`, keyed `d<index>`) listing a `pref.action('fg.global.<key>.<value>')` per option, `App` first for a declaration with `follows`. Empty declarations → `undefined`, and `Workshop` passes no `menus`.
  - `function GlobalsCommands({ declarations }: { declarations: GlobalDeclarations }): null` — per declaration and option, `useCommand('fg.global.<key>.<value>', option.label, () => set(key, value), { active: () => values[key] === value, enabled: () => shown ? true : NotApplicable })`, where `shown` is membership in `labOptions(declaration, values)`. The toolbar in the header stays.

- [ ] **Step 1: Write the failing tests:**

```tsx
it('builds a Globals menu with a submenu per declaration and App first where it follows', ...)
it('sets a global from its menu row and checks the current value', ...)
  // full Workshop harness (labHarness.ts) with a 'theme' global → open Globals › Theme, click 'Dark' → GlobalsToolbar's select reads Dark; row checked
it("disables an option its declaration's shows leaves out", ...)
it('adds no Globals menu when no globals are declared', ...)
```

- [ ] **Step 2: Run, expect failures** — `... --project=forge packages/forge/src/shell/globalsMenu.test.tsx`.
- [ ] **Step 3: Implement**; run `npm run check:imports` on the node if an import changed packages.
- [ ] **Step 4: Run** the file plus `GlobalsToolbar.test.tsx` and `globals.test.ts`: pass.
- [ ] **Step 5: Changeset** (forge patch): "The workshop's globals are also a Globals menu on the lab's menu bar; the header toolbar keeps its selects."
- [ ] **Step 6: Commit** — explicit paths; `put forge's globals on the lab's menu bar`.

---

### Task 7: Docs, fleet, merge

**Files:**
- Modify: `packages/labkit/README.md` ("Chrome": one paragraph on the menu bar, `menus`, `menuBar`, `contextMenus` and header items' `keys`; extend the `header={false}` sentence to say the bar goes too)
- Modify: `docs/TODO.md` ("Menus as layout assets" entry), `docs/superpowers/specs/2026-10-16-menus-as-layout-assets-design.md` (Status, Landed, Order)
- Delete: `docs/superpowers/plans/2026-10-17-labkit-menu-bar.md`

- [ ] **Step 1: README** — with an example `<Lab menus={{ schema }}>` and a child registering its command with `useCommand`.
- [ ] **Step 2: Spec and TODO.** Name arcs by content ("labkit's menu bar", "WeaselDraw's menu bar"), never by number. If WeaselDraw's menu bar has not merged: Status says labkit's menu bar is built and WeaselDraw's is not; move labkit's paragraphs from "Consumers" into "Landed" as what was built (the lab registry, `hears: 'own'`, `lab.*` ids, `menus`/`menuBar`/`contextMenus`); Order lists only WeaselDraw; the TODO entry names only WeaselDraw. If it has merged: nothing remains, so delete the spec and the TODO entry (move anything worth keeping into `packages/labkit/README.md` or `docs/TODO.md` first).
- [ ] **Step 3: Commit** — explicit paths, plan deletion included; `document the lab's menu bar and retire its plan`.
- [ ] **Step 4: Gate on the node** — typecheck and labkit lint (commands in Global Constraints); `npm run check:size` locally.
- [ ] **Step 5: Fleet** — `npm run test:fleet -- HEAD --node teitou`. Green, with the `fleet-tree` line matching HEAD and the gate test passed, not skipped. A failure in a file this branch did not touch under load is contention, not a regression: say so and move on.
- [ ] **Step 6: Merge** — `git -C /Users/mike/src/weasel merge --no-ff labkit-menu-bar`. The WeaselDraw menu-bar arc runs in parallel and edits the same spec Status/Order passages and the same TODO entry: expect a conflict there. Resolve it by reading both sides — the result states what both arcs leave, by content (Step 2's rule: if both have landed, the spec and the entry go). Any conflict in `LabZoom.tsx` against a `variants` change to `makeViewportZoomAction`: keep labkit's own `variants` on `lab.zoom`.
- [ ] **Step 7: After the merge** — start `npm run test:fleet -- HEAD --node teitou` on `main` in the background; `ExitWorktree`, `git worktree remove .claude/worktrees/labkit-menu-bar`, `git branch -d labkit-menu-bar`.
