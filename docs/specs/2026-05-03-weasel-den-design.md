# weasel-den design

**Date:** 2026-05-03
**Status:** Spec — ready for plan

## Problem

Completed tools (`useDeleteTool`, `useDuplicateTool`, `useHandTool`, the wheel
and keyboard viewport tools, etc.) live inside the core weasel package next to
the primitives still under active design (Tool API, Canvas, gesture hooks).
Two costs:

1. **Test surface bloat.** Every commit reruns tests for stable, finished
   tools. As the den grows this dominates feedback latency and noise.
2. **Mental schema bleed.** `src/tools/builtin/` mixes "this is a finished
   tool" with "this is a finished tool we're still using as a guinea pig for
   the Tool primitive" (`useSelectTool`, `useInsertTool`). New contributors
   reading the directory can't tell which is which.

The fix is to move finished tools into a sibling package, leaving core to
focus on primitives.

## Goal

Stand up `@weasel-js/den` as a peer workspace package that:

- Hosts finished, stable tools.
- Depends on `@weasel-js/core` only through its public exports.
- Runs its own test suite, separable from core.
- Ships a convenience composition layer so consumers don't pay a boilerplate
  tax for the split.
- Provides domain "packs" (e.g. drawing app) that bundle thematically
  appropriate tools with sensible defaults.

## Architecture

### Repo shape

Convert weasel from a single-package repo to an npm workspaces monorepo:

```
weasel/
  package.json                 # workspace root, devDeps + dispatcher scripts
  tsconfig.base.json           # shared compiler opts
  packages/
    weasel/                    # @weasel-js/core — primitives, Canvas, Tool API
      src/
      package.json
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
    weasel-den/                # @weasel-js/den — finished tools + packs
      src/
        tools/                 # one file per tool, mirroring current layout
        packs/                 # useStandardTools, useDrawingAppPack, ...
        index.ts
      package.json             # depends on "@weasel-js/core": "workspace:*"
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
  demo/                        # depends on both packages
  docs/
```

The repo root has no source code; it's a coordinator. `npm test` from root
runs both workspaces' suites; `npm test -w @weasel-js/core` scopes to core.

### Initial migration list

Move these tools out of core in the first pass (stable, single-file, minimal
core-internal coupling):

- `useDeleteTool`
- `useDuplicateTool`
- `useNudgeTool`
- `useUndoRedoTool`
- `useHandTool`
- `useWheelZoomTool`
- `useWheelPanTool`
- `useKeyboardZoomTool`

Stay in core (still under active architectural pressure):

- `useSelectTool`, `useInsertTool`, `useTextTool`, `useUserPenTool` — these
  are the canonical examples driving Tool primitive design and overlay
  channel work. They graduate to the den once stable.

The split criterion is "is this still teaching me something about the core
API?" — yes → core, no → den.

### Public extension API

The symmetry contract: weasel-den consumes only what `@weasel-js/core`
exports through its public entry points. No reaching into `dist/internal/`,
no path aliases that bypass the exports map.

Day-one surface weasel-den needs from weasel:

- **Tool primitive:** `defineTool`, `Tool`, `ToolScratchHandle`,
  `ToolPointerEvent`, `ToolDragEvent`, `ToolKeyEvent`, `useTools`,
  `ToolsApi`.
- **Layer types:** `RenderLayer`, view/transform context.
- **Viewport coords:** `View`, `worldToScreen`, `screenToWorld`, `zoomAt`.
- **Gesture hooks (for tools wrapping `useMove` / `useResize` / etc.):** the
  hooks themselves and their controller types.
- **Adapter types:** `SceneAdapter` and per-hook subsets.
- **Op model:** `Op`, the `create*Op` factories, `createHistory`,
  `applyBatch`. Needed by undo/delete/duplicate/nudge.
- **Keybinding helpers:** `useKeybinding`, `KeyBinding`, `isEditableTarget`.

Most are already exported. The migration audits each tool for backdoor
imports; each backdoor becomes either a deliberate new export or a refactor
to use the public API.

### Convenience composition

The split's biggest risk is consumer boilerplate: registering 8 tools by
hand is a regression versus the current `tool="select"` shorthand. Two
helpers in weasel-den absorb that cost.

#### `useStandardTools` — opt-in / opt-out per tool, returns spreadable chunks

```ts
export function useStandardTools(opts: {
  adapter: SceneAdapter;
  // per-tool: omit (use default), pass false (skip), pass options (configure)
  delete?: boolean | UseDeleteToolOptions;
  duplicate?: boolean | UseDuplicateToolOptions;
  nudge?: boolean | UseNudgeToolOptions;
  undoRedo?: boolean | UseUndoRedoToolOptions;
  hand?: boolean | UseHandToolOptions;
  wheelZoom?: boolean | UseWheelZoomToolOptions;
  wheelPan?: boolean | UseWheelPanToolOptions;
  keyboardZoom?: boolean | UseKeyboardZoomToolOptions;
}): {
  registry: Record<string, Tool<unknown>>;  // palette tools (e.g. hand)
  alwaysOn: Tool<unknown>[];                 // wheel/key zoom/pan, action tools
  keybindings: Record<string, string>;       // default keybindings, mergeable
};
```

Usage:

```ts
const std = useStandardTools({ adapter });

const tools = useTools({
  active: 'select',
  registry: { ...std.registry, select, insert },
  alwaysOn: std.alwaysOn,
});
useKeybindings(tools, { overrides: std.keybindings });
```

Four lines for "give me everything sensible," same order of magnitude as
`tool="select"`. Each tool is opt-out (`{ adapter, hand: false }`) or
configurable (`{ adapter, wheelZoom: { speed: 1.05 } }`).

Implementation note: every inner tool hook always runs (rules of hooks).
`hand: false` means the tool runs but isn't included in the returned
registry. The cost is minor — unused tool scratch refs and a no-op registry
entry — and predictable.

#### `useStandardCanvasSetup` — fully wired one-call setup

For the dead-common case ("select + insert + everything stock"), one more
layer:

```ts
export function useStandardCanvasSetup(opts: {
  adapter: SceneAdapter;
  hitBody: SelectToolOptions['hitBody'];
  boundsOf: SelectToolOptions['boundsOf'];
  // optional: override anything from useStandardTools, plus core-tool configs
  select?: UseSelectToolOptions;
  insert?: UseInsertToolOptions;
  // ... mirrors useStandardTools opts
}): { tools: ToolsApi };
```

Smallest possible consumer:

```ts
const { tools } = useStandardCanvasSetup({ adapter, hitBody, boundsOf });
return <Canvas tools={tools} ... />;
```

Three lines. Equivalent to the old `tool="select"` ergonomics.

### Packs

A pack is a thematically curated bundle hook that returns the same
`{ registry, alwaysOn, keybindings }` shape. Packs compose by spreading.

#### `useDrawingAppPack`

```ts
export function useDrawingAppPack(opts: {
  adapter: SceneAdapter;
  hitBody: SelectToolOptions['hitBody'];
  boundsOf: SelectToolOptions['boundsOf'];
  // pen, text, insert, select configs
  pen?: UseUserPenToolOptions;
  text?: UseTextToolOptions;
  insert?: UseInsertToolOptions;
  select?: UseSelectToolOptions;
  // standard-tool overrides (passed through to useStandardTools)
  ...
}): {
  registry: { select; insert; text; pen; hand; ...other registry tools };
  alwaysOn: Tool<unknown>[];   // wheel/key viewport, undo/redo, delete, etc.
  keybindings: Record<string, string>;
};
```

Usage:

```ts
const pack = useDrawingAppPack({ adapter, hitBody, boundsOf });
const tools = useTools({ active: 'select', ...pack });
useKeybindings(tools, { overrides: pack.keybindings });
```

Internally, the pack calls `useStandardTools` for the generic surface, then
adds the drawing-specific palette tools (select, insert, text, pen) on top.
Consumers can override or omit anything.

#### Future packs (deferred — see TODO)

- `useDiagramPack` — connector tools, snap-to-grid defaults
- `useWhiteboardPack` — sticky notes, freeform pen, text
- `usePresentationPack` — frame tools, slide navigation

Add when there's a real consumer. Don't anticipate.

### Build / test wiring

- **vitest:** each workspace ships its own `vitest.config.ts`. Root
  `npm test` runs both via `vitest --workspace` (or a small dispatcher
  script). `npm test -w @weasel-js/core` scopes to core.
- **tsup:** each package builds independently. weasel-den marks
  `@weasel-js/core` as external — consumers install both packages. Sub-path
  exports (`weasel-den/packs/drawing-app`) ship as separate entries to keep
  bundle size predictable.
- **TS resolution:** workspaces symlink. weasel-den imports
  `@weasel-js/core`; TypeScript resolves through the workspace package's
  `exports` field, which during dev points at `src/index.ts` (we drop the
  current root `paths` aliasing). On publish, `exports` points at `dist/`.
- **demo:** drops the current vite alias regex. Adds workspace deps on both
  `@weasel-js/core` and `@weasel-js/den`. Resolution flows through
  workspace symlinks.
- **pre-commit:** scope test runs to the workspace whose files changed
  (lint-staged + a small dispatcher). Today's pre-commit hook reruns the
  full suite; the split makes it cheap to narrow.

### Default keybindings as API surface

The keybindings returned by `useStandardTools` and packs become public API.
Changing them is a breaking change for consumers. Lock the v1 set; treat
later changes as semver-major. (Versioned-defaults via
`useStandardTools({ keybindings: 'v1' })` deferred until weasel-den hits 1.0.)

## What this is NOT

- **Not a runtime plugin loader.** Tools still register statically via
  `useTools({ registry })`. The split is a packaging boundary, not a
  discovery mechanism.
- **Not a public extension SDK marketed to third parties.** weasel-den's
  exports become deliberate, but we're not committing to a stable plugin API
  for external authors yet.
- **Not solving overlay/layer extension.** Overlay-channel work in flight
  (`docs/specs/2026-05-03-tool-overlay-channel-design.md`) addresses runtime
  composition; this spec addresses source organization.

## Migration sequencing

High-level (impl plan will detail each step):

1. Stand up workspaces scaffold; move core into `packages/weasel/`
   unchanged. Verify all tests pass and dist build is byte-equivalent.
2. Create empty `packages/den/` with package.json, tsup, vitest.
3. Move tools one at a time, smallest first (`useDeleteTool` → ...).
   Per move: shift files, fix imports to `@weasel-js/core`, run tests,
   commit.
4. Implement `useStandardTools` and `useStandardCanvasSetup` in weasel-den.
   Tests verify each opt-out and override path.
5. Implement `useDrawingAppPack`. Tests verify it composes correctly.
6. Update `demo/` to import standard tools and the drawing pack from
   weasel-den. Demos previously composing tools by hand can switch to the
   pack helpers where appropriate.
7. Tighten core's `src/tools/builtin/` to only the unmigrated tools; update
   core's `src/index.ts` re-exports accordingly.

## Files to create / modify

**Create:**

- `packages/den/package.json`
- `packages/den/tsconfig.json`
- `packages/den/tsup.config.ts`
- `packages/den/vitest.config.ts`
- `packages/den/src/index.ts`
- `packages/den/src/tools/{useDeleteTool,useDuplicateTool,...}.ts`
  (moved from core)
- `packages/den/src/packs/useStandardTools.ts`
- `packages/den/src/packs/useStandardCanvasSetup.ts`
- `packages/den/src/packs/useDrawingAppPack.ts`
- Tests for each of the above.
- `tsconfig.base.json` at root
- New root `package.json` with workspaces config + dispatcher scripts.

**Modify:**

- Root `package.json` → workspace root (no `main`, `exports`, etc.; just
  scripts and devDeps).
- `tsconfig.json` → moves into `packages/weasel/`; root keeps base.
- `tsup.config.ts` → moves into `packages/weasel/`.
- `vitest.config.ts` → moves into `packages/weasel/`.
- `vite.config.ts` (demo) → drops aliasing regex; relies on workspaces.
- `demo/package.json` (create if absent) → workspace deps on both
  packages.
- `src/` → moves wholesale into `packages/weasel/src/`.
- `src/tools/builtin/index.ts` (in new core location) → drops re-exports
  of migrated tools.
- `src/index.ts` (in new core location) → drops re-exports of migrated
  tools.

**Delete (after migration):**

- Old top-level `src/`, `tsconfig.json`, `tsup.config.ts`,
  `vitest.config.ts` (their content moves into `packages/weasel/`).

## Tests required

- Each migrated tool's existing test file moves with it; should pass
  unchanged in weasel-den's vitest.
- `useStandardTools.test.ts` — verifies registry / alwaysOn / keybindings
  shape, opt-out per key, options passthrough.
- `useStandardCanvasSetup.test.ts` — verifies the wired-up `tools` object
  returns expected active/registry/keybindings.
- `useDrawingAppPack.test.ts` — verifies pack composes
  `useStandardTools` + drawing palette correctly; verifies overrides.
- A workspace integration smoke test (in `demo/` or root): `npm test`
  succeeds in both packages; demo builds against published surfaces only.

## Deferred / out of scope

Tracked in `docs/TODO.md`:

- **Versioned default keybindings** — `useStandardTools({ keybindings: 'v1' })`
  for non-breaking default changes post-1.0.
- **Additional packs** — `useDiagramPack`, `useWhiteboardPack`,
  `usePresentationPack`. Add per real consumer demand.
- **Migration of `useSelectTool` / `useInsertTool` / `useTextTool` /
  `useUserPenTool`** to weasel-den. Defer until each is stable
  post-overlay-channel work and any further Tool API iteration.
- **Runtime plugin discovery** — explicit non-goal in v1.
- **Public third-party extension SDK** — deliberate exports happen, but no
  marketing or stability guarantees yet.
- **Per-workspace pre-commit narrowing** — desirable, but the dispatcher
  script can land after the initial split.

## Migration notes

- This is a wide-blast-radius change at the file-system level (almost
  everything moves) but small at the diff-content level (mostly path
  changes in imports). Plan in two phases: scaffold + move (keeps green),
  then helper introduction (additive).
- Project policy: breaking changes are free; no compat shim. The plan
  enumerates every demo touched.
- Once landed, the convention "if it's done, it goes to the den" is
  enforced socially, not mechanically.
