# WeaselDraw Menu Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WeaselDraw gets a File / Edit / Arrange / View menu bar, as a strip of its own above the command bar, built as a layout asset over registered actions — with New, Open, Import and Save made into registered actions first.

**Architecture:** Two small kit changes come first: `useCommand` learns `variants` (so a callback can be a parametric action), and `viewport.zoom` declares `in` / `out` / `reset` variants. Draw then registers `file.new` (one variant per paper size), `file.open`, `file.import` and `file.save` (⌘S) through `useCommand`, and the command bar's file buttons become a `Bar` of `action` leaves naming them. The menu bar is a prefs schema (`DRAW_MENU_BAR`) of four menu groups whose leaves name existing action ids, drawn by the kit's `MenuBar` and listed in the asset editor.

**Tech Stack:** React, TypeScript, `@weasel-js/routing` (`useCommand`, `actionItems`), `@weasel-js/core` (`makeViewportZoomAction`, `SceneCanvas`), `@weasel-js/prefs` (`pref.group/action`), `@weasel-js/ui` (`MenuBar`, `Bar`), vitest (jsdom + headless-Chromium `browser` project).

**Spec:** `docs/superpowers/specs/2026-10-16-menus-as-layout-assets-design.md` — "Consumers" (the WeaselDraw paragraphs) and "Order".

## Global Constraints

- Work happens in a worktree of its own, branched from `main` after `menus-arc-2` has merged; run `npm ci` in it before anything builds against siblings (CLAUDE.md, Traps).
- **No local test, typecheck, lint or build runs.** Tests run on the fleet: `onto do --node studio --ref origin/main -- npx vitest run --project=<project> <path>`. Projects: `apps/draw/**` is `draw`; `packages/core/**` is `core`; `packages/routing/**` and `packages/ui/**` are `weasel-ui`; any `*.browser.test.tsx` is `browser`.
- `npm run check:size` runs locally (400 lines per file, 120 per function); split rather than grow a file past it.
- Commit by explicit path (`git add <paths>`), never `git add -A` / `.`. Commit subjects imperative, no session shorthand; end each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every changeset is `patch`. Never write a `bump-approved` marker. Say "Additive." in the prose where it is.
- The menu bar is new surface: nothing moves out of an existing component. The command bar keeps every button it has; its file buttons are re-pointed at the new actions, not removed.
- Access letters are supported, never required: the four titles declare them; no row needs one.
- No `@internal` / `@experimental` API newly exposed to consumers. Draw reaches the new actions through `useCommand`, `Bar`, `MenuBar` and `pref` — public surface.
- An action leaf names an action or `id:variant` and carries no params; the saved format does not grow (spec, "Consumers").
- The app root fills the viewport and never scrolls; jsdom cannot see a layout collapse, so the strip's layout is checked in a real browser (Task 5).
- The arc ends with `npm run test:fleet -- HEAD --node studio` green (its log must show `fleet-tree: N changed path(s) match <sha>` and the gate test passing), then a `--no-ff` merge to `main`, then `npm run test:fleet -- HEAD --node studio` on `main`.
- When it merges: this plan is deleted, `docs/TODO.md`'s "Menus as layout assets" entry and the spec's Status / Landed / Order are updated, naming arcs by content ("WeaselDraw's menu bar"), never by number.

## Review Focus

- **New with no variant** — the palette, a key or `trigger('file.new')` with no params: starts a fresh document at the current paper size, rather than doing nothing or throwing. Pinned in Task 3.
- **⌘S does not open the browser's Save Page dialog** — the keydown that runs `file.save` is `defaultPrevented`. Pinned in Task 3.
- **A disabled action's row reads disabled** — Group with nothing selected shows `aria-disabled="true"` in Arrange, rather than a row that silently does nothing. Pinned in Task 4.
- **Alt+F with the canvas holding keys** — draw's `SceneCanvas` has `claimKeys`; Alt+F still opens File and fires no tool hotkey. Pinned in Task 4.
- **A narrow window** — at 640px wide the strip and the command bar still stack without overlapping and the page does not scroll. Pinned in Task 5.

---

### Task 1: `useCommand` takes variants

**Files:**
- Modify: `packages/routing/src/interactions/actions/useCommand.ts`
- Test: `packages/routing/src/interactions/actions/useCommand.test.tsx`
- Create: `.changeset/use-command-variants.md`

**Interfaces:**
- Produces: `useCommand(id: string, label: string, run: (params?: Readonly<Record<string, unknown>>) => void, options?: CommandOptions): void`, with `CommandOptions.variants?: readonly ActionVariant[]` (`ActionVariant` from `./action`, already exported by routing and core). The registered action carries `variants` as given; `run` receives the params `trigger` was called with (absent for a plain trigger).

- [ ] **Step 1: Write the failing tests** in `useCommand.test.tsx`, beside the existing ones:

```tsx
it('registers one entry per variant', () => {
  // useCommand('x', 'X', run, { variants: [{ key: 'a', label: 'A', params: { n: 1 } }, { key: 'b', label: 'B', params: { n: 2 } }] })
  expect(actionItems(registry.list().find((a) => a.id === 'x')!).map((i) => [i.key, i.label, i.params]))
    .toEqual([['x:a', 'A', { n: 1 }], ['x:b', 'B', { n: 2 }]]);
});
it('runs with the params it was triggered with', () => {
  registry.trigger('x', { n: 2 });
  expect(run).toHaveBeenLastCalledWith({ n: 2 });
  registry.trigger('x');
  expect(run).toHaveBeenLastCalledWith(undefined);
});
it('does not re-register for variants equal by value', () => {
  // rerender with a fresh but equal variants array; the registered action object is the same one
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `onto do --node studio --ref origin/main -- npx vitest run --project=weasel-ui packages/routing/src/interactions/actions/useCommand.test.tsx`
Expected: the three new tests FAIL (no `variants` on the action; `run` called with no argument).

- [ ] **Step 3: Implement.** Pass the invoker's `params` through to `latest.current.run(params)`; add `variants` to the action when given, held with `useStableByContent(options?.variants, sameValue)` and listed in the memo deps beside `keys` and `tags`. Update the doc comment's "replaced only when…" list to include `variants`.

- [ ] **Step 4: Run them to see them pass** (same command). Expected: PASS, including the existing tests.

- [ ] **Step 5: Changeset and commit.** `.changeset/use-command-variants.md`, `'@weasel-js/routing': patch` and `'@weasel-js/core': patch`: `useCommand` takes `variants`, and its callback receives the params it was triggered with, so a parametric command — one entry per variant in a bar, menu or palette — needs no hand-built `Action`. Additive.

```bash
git add packages/routing/src/interactions/actions/useCommand.ts packages/routing/src/interactions/actions/useCommand.test.tsx .changeset/use-command-variants.md
git commit -m "let useCommand register a parametric command with variants"
```

### Task 2: `viewport.zoom` declares in, out and reset variants

**Files:**
- Modify: `packages/core/src/interactions/actions/defaults/viewportZoom.ts` (`makeViewportZoomAction`)
- Test: `packages/core/src/interactions/actions/defaults/viewportZoom.test.ts`
- Create: `.changeset/viewport-zoom-variants.md`

**Interfaces:**
- Produces: `viewport.zoom` with `variants: [{ key: 'in', label: 'Zoom In', params: { kind: 'in' } }, { key: 'out', label: 'Zoom Out', params: { kind: 'out' } }, { key: 'reset', label: 'Reset Zoom', params: { kind: 'reset' } }]`. Menu ids `viewport.zoom:in`, `viewport.zoom:out`, `viewport.zoom:reset`. Wheel and pinch stay bindings only, not variants.

- [ ] **Step 1: Write the failing tests**

```ts
it('lists in, out and reset as variants, and nothing for wheel or pinch', () => {
  expect(actionItems(makeViewportZoomAction()).map((i) => [i.key, i.label, i.params]))
    .toEqual([['viewport.zoom:in', 'Zoom In', { kind: 'in' }], ['viewport.zoom:out', 'Zoom Out', { kind: 'out' }], ['viewport.zoom:reset', 'Reset Zoom', { kind: 'reset' }]]);
});
it('finds each variant its key binding as a shortcut', () => {
  // actionShortcuts(action, { kind: 'in' })[0] names key '=' with mod; 'out' → '-'; 'reset' → '0'
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `onto do --node studio --ref origin/main -- npx vitest run --project=core packages/core/src/interactions/actions/defaults/viewportZoom.test.ts`
Expected: FAIL — the action has no variants, so `actionItems` returns one `viewport.zoom` entry.

- [ ] **Step 3: Add the `variants` array above** to the descriptor `makeViewportZoomAction` returns. Nothing else changes: the invoker already switches on `params.kind`.

- [ ] **Step 4: Run them to see them pass** (same command). Then grep for tests that count palette or bar entries for `viewport.zoom` (`grep -rn "viewport.zoom" packages/*/src --include=*.test.*`) and run any that list entries; a test expecting one "Zoom" entry now sees three and is updated to the three.

- [ ] **Step 5: Changeset and commit.** `.changeset/viewport-zoom-variants.md`, `'@weasel-js/core': patch`: `viewport.zoom` lists Zoom In, Zoom Out and Reset Zoom as variants, so a menu, bar or palette shows three entries, each with its key, where it showed one "Zoom" that zoomed in.

```bash
git add packages/core/src/interactions/actions/defaults/viewportZoom.ts packages/core/src/interactions/actions/defaults/viewportZoom.test.ts .changeset/viewport-zoom-variants.md
git commit -m "list viewport.zoom's in, out and reset as variants"
```

### Task 3: New, Open, Import and Save as registered actions; the command bar points at them

**Files:**
- Create: `apps/draw/src/fileCommands.ts`
- Create: `apps/draw/src/fileCommands.test.tsx`
- Modify: `apps/draw/src/Toolbar.tsx` (call `useFileCommands`; drop the four inline callbacks)
- Modify: `apps/draw/src/CommandBar.tsx` (file group becomes a `Bar`; drop `onSaveSvg`, `onOpenSvg`, `onImportSvg`, `onNew` props)
- Modify: `apps/draw/src/CommandBar.test.tsx`, `apps/draw/src/CommandBar.stories.tsx` (props removed)

**Interfaces:**
- Consumes: `useCommand` with `variants` (Task 1); `PAPER_SIZES`, `isPaperSize`, `PaperSizeKey` (`paperSizes.ts`); `saveSvgFile` (`saveSvg.ts`); `openSvgFile`, `importSvgFile`, `OpenSvgTarget` (`openSvg.ts`).
- Produces, in `fileCommands.ts`:
  - `export const FILE_ACTIONS = { new: 'file.new', open: 'file.open', import: 'file.import', save: 'file.save' } as const;`
  - `export const FILE_NEW_MENU: PrefGroup` — `pref.group('New', { sizes: pref.action(FILE_ACTIONS.new) }, { as: 'menu' })`, shared by the command bar and the File menu.
  - `export interface FileCommandsTarget extends OpenSvgTarget, SavedDoc {}` (`SavedDoc` from `saveSvg.ts`: `filename`, `paperSize`, `backgroundColor`).
  - `export function useFileCommands(target: FileCommandsTarget): void` registering:
    - `file.new`, label `New`, variants one per `PAPER_SIZES` entry: `{ key, label, params: { size: key } }` (keys `letter`, `a4`, `legal`; labels `US Letter`, `A4`, `Legal`). Run: with a valid `params.size`, `setPaperSize(size)`; with none, keep the paper size. Either way `scene.batch('New document', () => scene.removeMany([...scene.renderOrder()]))` — the body moved from `Toolbar.tsx`.
    - `file.open`, label `Open…` → `openSvgFile(target)`.
    - `file.import`, label `Import…` → `importSvgFile(target.scene)`.
    - `file.save`, label `Save`, `keys: { kind: 'key', key: 's', mods: { mod: true } }` → `saveSvgFile(scene, { filename, paperSize, backgroundColor })` with the latest values.
  - The hook is a `.ts` file; it renders nothing.

- [ ] **Step 1: Write the failing tests** in `fileCommands.test.tsx`. Mock `./saveSvg` and `./openSvg` with `vi.mock`. Mount as `appCommands.test.tsx` does — `renderWithKeys` from `@weasel-js/react/testing/giveKeys`, `DepRegistryProvider` › `ActionsProvider` › a probe calling `useFileCommands` and `useActionsRegistry` (test-only), plus a `<SceneCanvas features={['draw']} … width={64} height={64}/>` for the key test, with `getContext` stubbed. The scene is `createScene` seeded with two nodes.

```tsx
it('offers New once per paper size', () => {
  expect(actionItems(get('file.new')).map((i) => [i.key, i.label]))
    .toEqual([['file.new:letter', 'US Letter'], ['file.new:a4', 'A4'], ['file.new:legal', 'Legal']]);
});
it('New at a size empties the document in one undo entry and sets the size', () => {
  registry.trigger('file.new', { size: 'a4' });
  expect(scene.renderOrder()).toEqual([]);
  expect(target.setPaperSize).toHaveBeenCalledWith('a4');
  scene.undo();
  expect(scene.renderOrder()).toHaveLength(2);
});
it('New with no size empties the document and keeps the paper size', () => {
  registry.trigger('file.new');
  expect(scene.renderOrder()).toEqual([]);
  expect(target.setPaperSize).not.toHaveBeenCalled();
});
it('Open and Import hand the picker the document', () => {
  registry.trigger('file.open');   expect(openSvgFile).toHaveBeenCalledWith(expect.objectContaining({ scene }));
  registry.trigger('file.import'); expect(importSvgFile).toHaveBeenCalledWith(scene);
});
it('Save writes the latest filename, size and background', () => {
  // rerender with filename 'b'; trigger('file.save')
  expect(saveSvgFile).toHaveBeenCalledWith(scene, { filename: 'b', paperSize: 'letter', backgroundColor: '#ffffff' });
});
it('mod+S saves, and keeps the browser from saving the page', () => {
  // jsdom is not an Apple platform, so mod is Ctrl
  const e = new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true });
  act(() => { window.dispatchEvent(e); });
  expect(saveSvgFile).toHaveBeenCalledOnce();
  expect(e.defaultPrevented).toBe(true);
});
```

Rewrite `CommandBar.test.tsx`'s first two tests against registered stubs (a probe calling `useCommand` for the four ids, `file.new` with the same three variants, each `run` a `vi.fn`), inside an `ActionsProvider`:

```tsx
it('starts a new document at the paper size picked from New', () => {
  // click button 'New', then menuitem 'A4'
  expect(newRun).toHaveBeenCalledWith({ size: 'a4' });
});
it('opens, imports and saves from their own buttons', () => {
  // click 'Import…' → importRun once, openRun not called; 'Open…' → openRun; 'Save' → saveRun
});
```

The Debug test stays as it is, minus the removed props.

- [ ] **Step 2: Run them to see them fail**

Run: `onto do --node studio --ref origin/main -- npx vitest run --project=draw apps/draw/src/fileCommands.test.tsx apps/draw/src/CommandBar.test.tsx`
Expected: FAIL — `./fileCommands` does not exist; the command bar still calls its props.

- [ ] **Step 3: Implement `fileCommands.ts`** per the Interfaces block.

- [ ] **Step 4: Re-point the command bar.** In `CommandBar.tsx` replace the `MenuButton` + `ButtonBar` in the first `wd-commandbar-group` with `<Bar schema={FILE_BAR} />` (`Bar` from `@weasel-js/ui`), where `FILE_BAR = pref.group('', { new: FILE_NEW_MENU, open: pref.action(FILE_ACTIONS.open), import: pref.action(FILE_ACTIONS.import), save: pref.action(FILE_ACTIONS.save) }, { as: 'bar' })`. Drop the four `on*` props and their doc comments, and update the file header comment's last sentence (the file buttons are actions now too). In `Toolbar.tsx` call `useFileCommands({ scene, filename, paperSize, backgroundColor, setFilename, setPaperSize, setBackgroundColor })` and drop the four callbacks and the now-unused imports. Fix `CommandBar.stories.tsx` for the removed props.

- [ ] **Step 5: Run the tests to see them pass** (same command, plus `apps/draw/src/appCommands/appCommands.test.tsx`). Expected: PASS. Then `npm run check:size`.

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/fileCommands.ts apps/draw/src/fileCommands.test.tsx apps/draw/src/Toolbar.tsx apps/draw/src/CommandBar.tsx apps/draw/src/CommandBar.test.tsx apps/draw/src/CommandBar.stories.tsx
git commit -m "register New, Open, Import and Save as actions, with mod+S, and point the file buttons at them"
```

### Task 4: The menu bar schema, as a layout asset

**Files:**
- Create: `apps/draw/src/menuBar.ts`
- Create: `apps/draw/src/menuBar.test.tsx`
- Modify: `apps/draw/src/dev/drawWorkspace.ts` (list the asset)
- Modify: `apps/draw/src/dev/AssetsPage.test.tsx`

**Interfaces:**
- Consumes: `FILE_ACTIONS`, `FILE_NEW_MENU` (Task 3); `viewport.zoom:*` (Task 2).
- Produces: `export const DRAW_MENU_BAR: PrefGroup` — `pref.group('Menu bar', { … }, { as: 'bar' })` with four children, each `pref.group(<Title>, { … }, { as: 'menu', access })`. Unnamed inner `pref.group('', …)` are the separated runs. Exact ids:

| Title (access) | Runs, in order |
|---|---|
| File (`f`) | `new: FILE_NEW_MENU` (submenu), `file.open`, `file.import` · `file.save` |
| Edit (`e`) | `undo`, `redo` · `clipboard.cut`, `clipboard.copy`, `clipboard.paste` · `duplicate`, `delete` · `selectAll` |
| Arrange (`a`) | `group`, `ungroup` · `reorder.forward`, `reorder.backward` · `align.left`, `align.centerX`, `align.right`, `align.top`, `align.centerY`, `align.bottom` · `distribute.horizontal`, `distribute.vertical` · `flip` |
| View (`v`) | `view.grid`, `view.snap`, `view.pathDirection`, `view.symmetry` · `viewport.zoom:in`, `viewport.zoom:out`, `viewport.zoom:reset` |

`reorder.forward`, `reorder.backward` and `flip` are named bare, so each lists both its variants.

- [ ] **Step 1: Write the failing tests** in `menuBar.test.tsx`. Mount as `appCommands.test.tsx` does — `DepRegistryProvider` › `ActionsProvider` › `<MenuBar schema={DRAW_MENU_BAR} />`, a probe calling `useFileCommands` with stub setters, and `<SceneCanvas features={['draw', pathTools]} … ambient={[appCommandsContribution(() => commands)]} />` (Workspace's features), `getContext` stubbed. Open each title by click and read the open menu's rows (`[role="menu"] [role="menuitem"]`, `textContent` trimmed of the shortcut — or read rows by accessible name).

```tsx
it('has File, Edit, Arrange and View, each with its access letter', () => {
  expect(screen.getAllByRole('menuitem').filter((el) => el.closest('[role="menubar"]')).map((el) => el.textContent))
    .toEqual(['File', 'Edit', 'Arrange', 'View']);
  // Alt+F (code 'KeyF', altKey) opens File; Alt+V opens View
});
it('lists every row it names, so no id is misspelled or unregistered', () => {
  expect(rowsOf('File')).toEqual(['New', 'Open…', 'Import…', 'Save']);
  expect(rowsOf('Edit')).toEqual(['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Duplicate', 'Delete', 'Select All']);
  expect(rowsOf('Arrange')).toEqual(['Group', 'Ungroup', 'Bring Forward', 'Bring to Front', 'Send Backward', 'Send to Back',
    'Align Left', 'Align Centers Horizontally', 'Align Right', 'Align Top', 'Align Centers Vertically', 'Align Bottom',
    'Distribute Horizontally', 'Distribute Vertically', 'Flip Horizontal', 'Flip Vertical']);
  expect(rowsOf('View')).toEqual(['Show grid', 'Snap to grid', 'Show path direction', 'Symmetry', 'Zoom In', 'Zoom Out', 'Reset Zoom']);
});
it("opens New's paper sizes as a submenu", () => {
  // File → hover/ArrowRight on 'New' → rows 'US Letter', 'A4', 'Legal'; choosing 'A4' calls setPaperSize('a4')
});
it('runs the action a row names', () => {
  // View → 'Show grid' calls commands.toggleGrid once; File → 'Save' calls saveSvgFile (mocked) once
});
it('marks a row disabled while its action is', () => {
  // nothing selected: Arrange's 'Group' row has aria-disabled="true"
});
it('opens File on Alt+F while the canvas holds keys, and fires nothing else', () => {
  // window keydown { key: 'f', code: 'KeyF', altKey: true } → File's menu open; no tool switched, no command called
});
```

Add to `AssetsPage.test.tsx`'s list test: `'Menu bar'` is listed, and picking it shows `File` in the structure tree.

- [ ] **Step 2: Run them to see them fail**

Run: `onto do --node studio --ref origin/main -- npx vitest run --project=draw apps/draw/src/menuBar.test.tsx apps/draw/src/dev/AssetsPage.test.tsx`
Expected: FAIL — `./menuBar` does not exist; the asset list has no "Menu bar".

- [ ] **Step 3: Write `DRAW_MENU_BAR`** per the table, and add `{ id: 'menubar', label: 'Menu bar', kind: 'layout', over: PREFS_ID, root: DRAW_MENU_BAR }` to `DRAW_WORKSPACE.assets` after `surfaces`. A row label the test expects that differs from the registry's (e.g. distribute's order, a variant's label) is fixed in the schema's order, never by renaming a kit action.

- [ ] **Step 4: Run them to see them pass** (same command). Expected: PASS. Note: `AssetsPage`'s `RegistryProbe` registers the kit's actions but not `file.*`, so the asset editor's preview of File shows fewer rows than the app. If that holds, add a P3 entry to `docs/TODO.md` saying so in this commit.

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/menuBar.ts apps/draw/src/menuBar.test.tsx apps/draw/src/dev/drawWorkspace.ts apps/draw/src/dev/AssetsPage.test.tsx
git commit -m "declare WeaselDraw's File, Edit, Arrange and View menu bar as a layout asset"
```

### Task 5: Mount the menu bar as its own strip above the command bar

**Files:**
- Modify: `apps/draw/src/Editor.tsx` (render the bar first inside `.wd-app`, before `<Toolbar>`)
- Modify: `apps/draw/src/app.css` (`.wd-menubar`)
- Test: `apps/draw/src/App.browser.test.tsx`

**Interfaces:**
- Consumes: `DRAW_MENU_BAR` (Task 4); `MenuBar` from `@weasel-js/ui`.
- Produces: `<MenuBar schema={DRAW_MENU_BAR} label="Menu bar" className="wd-menubar" />` as the first child of `.wd-app`.

- [ ] **Step 1: Write the failing browser tests** in `App.browser.test.tsx`'s `describe('WeaselDraw')`, using its `mountApp()`:

```tsx
it('draws the menu bar as a strip of its own above the command bar, and the page does not scroll', async () => {
  await mountApp();
  const strip = screen.getByRole('menubar').closest('.wd-menubar')!.getBoundingClientRect();
  const commands = document.querySelector('.wd-commandbar')!.getBoundingClientRect();
  expect(strip.top).toBe(0);
  expect(strip.height).toBeGreaterThan(0);
  expect(strip.bottom).toBeLessThanOrEqual(commands.top + 0.5);
  expect(document.querySelector('.wd-app')!.getBoundingClientRect().height).toBe(window.innerHeight);
  expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
  window.scrollTo(0, 5000);
  expect(window.scrollY).toBe(0);
});
it('keeps the strip above the command bar at 640px wide', async () => {
  await page.viewport(640, 800);
  // same strip / command bar / scrollHeight / scrollY assertions
});
it('opens File from its title, with Save showing its shortcut', async () => {
  await mountApp();
  await userEvent.click(page.getByRole('menuitem', { name: 'File' }));
  // the open menu's rows read New, Open…, Import…, Save; the Save row's text ends in 'S'
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `onto do --node studio --ref origin/main -- npx vitest run --project=browser apps/draw/src/App.browser.test.tsx`
Expected: FAIL — no `menubar` role in the page.

- [ ] **Step 3: Mount the bar and style the strip.** `.wd-menubar` in `app.css`, beside `.wd-commandbar`: `flex-shrink: 0`, the command bar's `background: var(--wzl-surface)` and `border-bottom: 1px solid var(--wzl-border)`, horizontal padding `var(--wzl-space-2)`, `font-size` matching the command bar's. No inline styles, no `!important`.

- [ ] **Step 4: Run them to see them pass** (same command). Expected: PASS, and the file's existing tests still pass (`starterCenter` reads the host's rect, so a shorter workspace needs no change). `npm run check:size`.

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/Editor.tsx apps/draw/src/app.css apps/draw/src/App.browser.test.tsx
git commit -m "draw WeaselDraw's menu bar as its own strip above the command bar"
```

### Task 6: Docs, fleet run, merge

**Files:**
- Modify: `docs/TODO.md` ("Menus as layout assets" entry)
- Modify: `docs/superpowers/specs/2026-10-16-menus-as-layout-assets-design.md`
- Delete: `docs/superpowers/plans/2026-10-17-draw-menu-bar.md`

- [ ] **Step 1: Update `docs/TODO.md`.** Rewrite the "(P2) Menus as layout assets" entry around what is left: labkit's menu bar, a lab-wide registry first. Keep its spec pointer.

- [ ] **Step 2: Update the spec.** Status: the menu bar and WeaselDraw's menu bar are built; labkit's is not. Landed: one bullet for WeaselDraw — `file.new` (a variant per paper size), `file.open`, `file.import`, `file.save` (⌘S) registered by `useFileCommands` in `apps/draw/src/fileCommands.ts`; the command bar's file group a `Bar` naming them; `DRAW_MENU_BAR` in `apps/draw/src/menuBar.ts` drawn above the command bar and listed in the asset editor; `useCommand` takes `variants`; `viewport.zoom` lists in, out and reset. Consumers: cut the WeaselDraw paragraphs down to what still holds (the command bar stays until it is empty). Order: drop "WeaselDraw: file actions, then its menu bar."

- [ ] **Step 3: Delete this plan and commit**

```bash
git rm docs/superpowers/plans/2026-10-17-draw-menu-bar.md
git add docs/TODO.md docs/superpowers/specs/2026-10-16-menus-as-layout-assets-design.md
git commit -m "delete the merged WeaselDraw menu bar plan, update the spec and TODO"
```

- [ ] **Step 4: Fleet run on the branch**

Run: `npm run test:fleet -- HEAD --node studio`
Expected: exit 0; the log shows `fleet-tree: N changed path(s) match <sha>` and the gate test passed rather than skipped. A failure in a file this arc did not touch is checked against `main` before it is treated as a regression.

- [ ] **Step 5: Merge and run main**

```bash
git -C <main checkout> merge --no-ff <branch> -m "merge WeaselDraw's menu bar"
```

Then, from `main`: `npm run test:fleet -- HEAD --node studio` in the background; a failure becomes the next thing to fix. Delete the branch and remove its worktree.
