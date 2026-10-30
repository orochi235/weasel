# weasel canvas-kit

Generic scene-graph engine, published as `@weasel-js/core` and its sibling packages. Core renders
2D; `@weasel-js/kernel3d` hosts 3D scenes on the same scene graph and dispatcher.

**weasel is not 2D-only.** kernel3d puts a `Pose3` in core's `Scene`, drives core's dispatcher with
screen points, and has each dep build its ray from its own camera
(`docs/superpowers/specs/2026-08-22-3d-kernel-design.md`). So a pipeline designed in core —
a dep, an action, a ranking rule — gets designed so a 3D host can use it too, and a type that bakes
in `{x, y}` does so as a stated choice. Before calling anything "2D" in a spec, a TODO entry or a
recommendation, check `packages/kernel3d` and `@weasel-js/geom/3d`.

## Scope: weasel is an engine

weasel is not a utility library, and it is not a depository for features
surgically cut out of an app and cloned in. It is an engine. Features get added
because the engine should have them.

**Do not gate a feature on finding a consumer for it.** "Who is the second
consumer?", "wait until a real app asks", "this doesn't earn a package yet",
"defer until a concrete use case appears" — none of these are arguments here,
and none of them should appear in a spec, a TODO entry, or a recommendation.
Consumer pressure is not the input. Mike decides when a feature goes in.

Nor is release overhead an argument: version churn, package count, bump
blast radius, and maintenance surface are not reasons to scope something down.
weasel has no SLAs.

What *is* fair to argue: that a design is wrong, that a foundation is missing
underneath it, that two things should be one thing, or that the work is bigger
than it looks and should be split into arcs. Argue the engineering, never the
demand.

When a feature does go in, design it as engine surface — general and composable
on its own terms — not as the minimum some demo happened to need.

## What gets its own package

A package either exports functionality that does not need the rest of weasel
(`geom`, `paint`, `stroke`, `renderer`), or is an obviously well-defined
functional area (`minimap`, `parallax`, `diagram`). Code that needs core and is
neither stays in core: `usePoseRun` was kept there on 2026-10-11 for this
reason. The aim is a smaller core, but not at the cost of a cluttered package
list.

A tool lives in the package that owns the action it binds. A tool is a
declarative shell over an action, so it leaves core only with its whole action
family, and only into a package that qualifies above. A package that ships
tools also ships `ToolSet`s naming them (core's `SHAPE_TOOLS`, path-tools'
`RESHAPE_TOOLS`) and a hook that builds them all (`usePathToolsTools`).

## Todo list

Active todos live in `docs/TODO.md`; the ones about a cost (runtime time, frames, allocations and
memory, or how fast the suite and dev servers run) live in `docs/PERF.md`, under the same tags.
Consult both when planning new work or picking up a task.

**Never read `docs/TODO.md` whole** (66 KB). Search it — `grep -n '(P2)'`, `grep -n '\[agent\]'`, a
keyword — and read only the lines around a hit.

When work merges, update `docs/TODO.md` or `docs/PERF.md` in the same change — retire the entry, or
rewrite it around what is actually left. An entry describing work that shipped is
worse than no entry: a reader plans against it. Don't reintroduce a summary index
at the top: the one that used to live there drifted to listing 21 of 41 P2s, three
of them P3s, because nothing recomputes a hand-maintained copy. `grep '(P2)'` is
the index.

**Weight the last open items in a mostly-done section above their P-number.**
When a section is mostly landed work kept as context for a few open entries,
finishing those lets the whole section be deleted, so rank them ahead of
same-priority work elsewhere when recommending what to pick up.

## Plans

A plan is scaffolding for work in flight. **When the work merges, delete the
plan** — `git log` is the archive, and a plan that outlives its branch becomes a
confident description of a codebase that no longer exists. Never leave a merged
plan on disk: its unchecked boxes read as open work, and nothing recomputes them.

Don't write completion notes (`*-done.md`). "What landed" belongs in the commit
message and the changeset.

A lesson worth keeping past the merge goes in this file or a design doc, and only
if it clears the bar in "Comment sparingly" below: not derivable from the code,
still true, and costly to rediscover. Verify it against the tree before writing
it down — most such lessons cite paths that have since moved.

## Releases: always write `patch`

**Every changeset you write is `patch`.** Not `minor`, not `major` — regardless
of how significant the change is, whether it adds API, or what semver would
say. `minor` and `major` are Mike's calls, made explicitly, in the message
where he makes them.

Every package is in one changesets `fixed` group, so **one bump
anywhere moves every package**. weasel is 1.0.0 as of 2026-08-12 — reached by
accident, from two `major` changesets that sat in `.changeset/` for days until
an unrelated release consumed them.

`npm run check:bumps` enforces this and runs in CI and in the release workflow.
The root `prepublishOnly` script runs it too, but only when someone types
`npm run prepublishOnly`: the root package is private, so npm never fires it.
Overriding it requires a marker in the changeset body
naming the level it approves:

```
<!-- bump-approved: minor: <who> — <why> -->
<!-- bump-approved: major: <who> — <why> -->
```

The level is part of the marker on purpose: approving a `minor` must not
authorize a later edit to `major`.

**Writing that marker yourself defeats the entire mechanism.** Treat it like
`git push` — it needs Mike's explicit OK in the conversation, every time.

If a change is genuinely breaking or genuinely additive, say so in the
changeset *prose*. The words are what a reader acts on; the number can always
be raised deliberately later. Don't otherwise discuss the number.

Whether a publish really landed, and how to check: `docs/releasing.md` ("Checking a publish").


## Package manager

npm is canonical: `package-lock.json` is the committed lockfile and `workspaces` lives in `package.json`. `pnpm install` is fine locally for speed (`.npmrc` has `link-workspace-packages=true` so it resolves the `*` workspace deps), but **never commit `pnpm-lock.yaml`** — it's gitignored on purpose. Don't introduce `pnpm-workspace.yaml`, `preinstall` hooks blocking npm, or `workspace:*` deps without an explicit decision to migrate.

## Reference implementations

When building new tools, read these first:

- **`packages/core/src/tools/builtin/hand/useHandTool.ts`** — the smallest declarative tool: one binding routing a drag to the `viewport.dragPan` action, with `axis` and `inertia` passed as thunked params. No ops, no adapter. Start here.
- **`packages/core/src/tools/builtin/rect/useRectTool.ts`** — canonical pattern for tools that create scene objects. A tool is a *declarative shell*: it declares `bindings` (`{ kind: 'drag' } → actionId: 'insert'`) and nothing else. The dispatcher owns the gesture, `insertAction` owns the live preview and the commit, and the `insert` dep mints the node. Consumers wanting a custom node factory override the dep (`useDepSource('insert', …)` or `<SceneCanvas insertNodeFactories>`), **not** the tool.
- **`packages/core/src/tools/builtin/polygon/usePolygonTool.tsx`** — the same, plus the two things a tool with its own state needs: thunked binding params (so mid-gesture changes reach both the preview and the commit) and `ToolDef.actions` for actions the tool owns. Declare those on the def; a tool hook must not call `useAction` itself, because it may run above the `<ActionsProvider>` and the registration will silently no-op.

Do **not** write a tool that runs its own gesture (`useDragRect`) and commits with `ctx.applyBatch([createInsertOp(...)])`. That was the previous guidance here, and the code it pointed at had been dead for some time — see the 2026-07-27 layer-audit handoff.

## Module shape

**A helper takes what it reads and returns what it produces. No module takes
another's scratch whole.** A function handed a 28-field bag can be moved to
another file and is no more separate for it. Split an action's state by when it
changes — captured at press and readonly, replaced each frame, or private to one
behavior — and pass each function the part it uses.

`npm run check:size` fails on a source file over 400 lines or a function over
120. Files already over are recorded in `scripts/check-size.allow.json`, and an
entry only comes down: `npm run check:size -- --update` lowers it after a split
and never raises it.

## Frame loops

Every frame loop runs behind `useVisibleRaf` (`@weasel-js/react`), never a bare
`requestAnimationFrame` or `setInterval` — `npm run check:frame-loops` fails the
build on one, and on a second use in a file its allowlist names. A
loop that measures elapsed time also needs `onResume` to rebase its clock, or an
hour in a background tab arrives as one hour-long frame and it reports that as
real. Full rule: `docs/proposals/2026-08-26-loops-stop-when-unseen.md`.

## Drawing icons

Where glyphs live, how code names one, and how a build trims them, and the rules for drawing
one: `docs/icons.md`. Read its "Drawing rules" before drawing or editing any glyph.


## Demo conventions

**A demo is a reference implementation.** Its job is to show the proper way to
build something against this API, so it uses the platform's fundamental pieces —
the scene graph, the gesture system, tools/actions, layers — **wherever they
apply**. A demo that hand-rolls around a kit system is teaching consumers to
hand-roll it too, and that is a defect regardless of how well the demo runs.

Bypassing a system is acceptable in exactly two cases: the example is trivial
enough that the system is genuinely out of scope, or the bypass *is* the point
and the demo's own blurb says so. Anything else gets rebuilt on the system.

Demos under `apps/site/demos/` are **terse and single-purpose** — each one exists to show a specific kit feature in the smallest plausible form. If a demo accumulates code that isn't directly pertinent to the feature it's demonstrating (custom hit-testers when defaults exist, hand-rolled adapter wiring, per-consumer index inversions), treat that as a signal that the kit's defaults / helpers should absorb the boilerplate. Being able to trim a demo or a simple consumer use-case is a legitimate driver for kit changes — there's limited value in showing consumers how to reimplement parts of the kit they could just find in source.

## Worktrees and the fleet

**Work that takes more than one commit, and anything handed to agents, happens in a worktree of
its own and merges to `main` when its fleet run is green.** The main checkout's working tree
stays clean. A one-commit side request can still go straight to `main`, committed by path. On
2026-10-11 several sessions made 729 commits to `main` from the one checkout, each having run
only its own test files; nothing checked the combination, and a fleet run of `main` failed on
another session's uncommitted stylesheet.

**Small low-risk fixes share one merge gate.** Deciding when this applies is the agent's job, not
Mike's: on a `docs/TODO.md` pass, or whenever several quick fixes line up, group the ones that
qualify without being asked, and say which went in the batch. Commit each to a `batch/<date>` branch in a
worktree of its own, one commit per fix, and run `test:fleet` (which includes the `gate` project)
and `test:fleet:postbuild` once on the tip before merging. Never run `npm run test:gate` itself:
it runs typecheck, lint and every check on this machine. The branch run covers the whole batch,
since it selects tests from the diff against the merge-base. When it fails, fix the commit at fault
or drop it from the batch, then rerun. A fix that touches a `triggers` path, dependencies or build
tooling goes through the normal path instead, because it forces a full run anyway.

**A fleet run tests a commit: `npm run test:fleet`, never a bare `onto test`.** `onto test` ships
the working tree, so from a checkout someone else is editing it tests their half-finished files
and blames the commit. `test:fleet` checks the commit out into a throwaway worktree first. Run
it on the branch before merging and on `main` after. `onto` keeps one tree per repository on a
node and every worktree syncs into it, so a run counts only if its log has `fleet-tree: N changed
path(s) match <sha>` and that gate test passed rather than skipped. The sha comes with the job,
never from the tree (`armTree` in `scripts/lib/fleet-tree.mjs`), so two branches can run on one node
at once: the later sync fails the earlier run, naming both commits. Give each run a log file of its
own, named for its branch: subagents of one session share its scratchpad, and on 2026-10-21 two of
them wrote `fleet2.log` over each other and each read the other's run as its own. `scripts/fleet-tree.setup.ts`
checks each node's tree, so a sharded run (`npm run test:fleet -- HEAD --spread 0`) prints that
line once per shard. A run whose tree another sync moved before it finished ends with `fleet-tree:
the tree changed during the run (…); this run is void`, after the summary: none of its failures are real. Sharding is not a way to make a run faster: each of its slices starts vitest
afresh, and on 2026-10-20, with only teitou free, it took 11.4 min and 132 core-minutes where an
unsharded run took 4.5 and 35. A run starts the `browser` project beside the rest whenever the node's idle
cores, less 3 kept for it, leave jsdom at least 4 workers (`scripts/vitest-overlap.mjs` prints its
reading); that saved 16–23% on 10-, 14- and 18-core nodes on 2026-10-21. The reserve came from
`scripts/bench-overlap-reserve.mjs`, whose runs are in `scripts/bench-overlap-reserve.runs.jsonl`.

What a branch run selects, the gate, `test:fleet:postbuild`, the Node matrix, the draw view
checkout and `dev:fleet`: `docs/fleet.md`.


## Test and typecheck commands

Core's tests run under the root vitest config, not the package: `npx vitest run --project=core`.
The `core` workspace has no `test` script at all. `npm test` runs every project.
`packages/text` and `packages/bidi` run under the `weasel-ui` project, not `core` — and running
vitest from inside a package finds zero files and looks like a pass. `npm run check:test-projects`
prints which project owns each directory, and fails on a test file no project collects.
A check that needs a real browser — layout, real IndexedDB, CSS jsdom can't resolve — is a
`*.browser.test.{ts,tsx}` file, not a story `play`: the `browser` project runs it in headless
Chromium (`npm run test:browser`, part of `npm test` and CI).

Typecheck is `npm run typecheck`. It runs two programs: the root `tsconfig.json`, and
`packages/tsconfig.json` for every `*.browser.test.*` file, which the root one excludes because
those use `@vitest/browser`'s matchers and the rest use jest-dom's — the two declare
`toHaveTextContent` incompatibly, and in one program load order picks the winner. A bare
`npx tsc --noEmit` checks only the first. `npm run typecheck:packages`
typechecks each package alone under its own `tsconfig.json`, every sibling read from source: the
program an editor shows for a file in that package. Name packages after `--` to check only those.

## Traps

Things that pass every test and are still wrong.

**The git stash stack is shared by every worktree of this repo.** A `stash`/`pop` pair run in one
worktree can pop another session's work into it. Use a throwaway worktree for a baseline instead;
if you must stash, `push -u -m <tag>`, `apply` by SHA, and drop your own entry by tag.

**A worktree with no `node_modules` of its own builds against the main checkout's.** Node resolves
`@weasel-js/*` up the tree, so a package build there reads main's stale `dist` for its siblings, and
`test:smoke:consumer` calls `<repo>/node_modules/.bin/tsc` and fails with an empty error. Run
`npm ci` in the worktree before building or smoke-testing anything in it.

Read the file for the area before changing anything in it:

| Touching | Read |
|---|---|
| the renderer, shaders, paints, the batch, GL tests | `docs/traps/rendering.md` |
| jsdom or browser tests, test helpers, perf loops | `docs/traps/testing.md` |
| tokens, themes, stylesheets, `:where()` defaults | `docs/traps/css-theme.md` |
| package exports, `.d.ts`, vite config, dev servers | `docs/traps/build-dev.md` |


## Terminology

UI words have specific referents — don't conflate them:

- **workspace** — the striped/gray area surrounding the rendered page. In WeaselDraw this is `.wd-canvas-host`; in ToolkitBuilder there's no separate host so the `<canvas>` element itself plays this role.
- **canvas** — the HTML `<canvas>` element. In WeaselDraw it fills the workspace, and the page is one layer drawn on it; in ToolkitBuilder the canvas spans the visible area.
- **document** / **page** — the white paper drawn on the canvas, at world (0, 0) and the paper size (`paper.width × paper.height`). When the user says "document" they mean the page, not the canvas element.
- **scene** — the kit-owned tree (`Scene<TData, TLayer, TPose>`). Logical, not visual. Don't say "scene" when you mean "document" or "canvas".
- **group** — a structural `GroupNode` (`kind: 'group'`). The real Cmd+G group; `group`/`ungroup` create/dissolve a group and reparent the selection under it; round-trips to SVG `<g>`. Persistent and id-bearing. **Not** a membership list — there is no membership "group" type (the old `Group`/`GroupAdapter` was removed in 2026-06).
- **selection** — the transient, immutable set of active ids (`SelectionApi.get()`/`set()`). "Operate on these N as a unit" with no persistence and no id; not a scene entity. Don't reintroduce a persistent membership-list "group" — a saved selection is just a consumer-held `string[]` passed to `selection.set`. See `docs/taxonomy.md` ("Group vs Selection — not the same axis").
- **params** — the settings-editing surfaces as a family: `PropertyPanel`, `Prefs` and labkit's `ControlPanel`. Not a component. The `--wzl-params-label-*` properties are named for it; see `docs/conventions.md` ("Panel labels").

When positioning HUDs / overlays, pick the right anchor: "inside the workspace" means `.wd-canvas-host`'s rect, and "on the page" means the paper's rect on the canvas, which moves with the view.

## Gesture / action / interaction taxonomy

Before making API changes (renames, new fields, new exports) touching anything named `gesture`, `action`, `interaction`, `binding`, or the dispatcher/routing layer, **read `docs/taxonomy.md` first**. The terms have specific referents that are easy to conflate:

- **Gesture** = form of input (click, drag, wheel, keystroke, drag-rect, drag-radial) — *how* input arrives.
- **Action** = user-intent operation (move, marquee, lasso, resize, rotate, insert, delete) — *what to do*.
- **Interaction** = a gesture composed with an action (the binding).

Don't name a field `gesture` if its values are action-shaped (`'move'`/`'marquee'`/etc.), or vice versa.

## Key concepts

- **Tools** declare bindings from a gesture to an action and handle nothing themselves. The action reads its `InvocationCtx` (world and screen point, modifiers, deps) and either moves the viewport or writes to the scene with ops.
- **Ops** are the scene-mutation primitive (`createInsertOp`, `createDeleteOp`, `createSetPoseOp`, etc.). Always prefer ops over direct adapter calls so changes are undoable.
- **`useDragRect`** is a spatial input primitive (user draws a rectangle). It is not an insert mechanism — tools decide what to do with the bounds.
- **Scene vs adapter**: `Scene<TData, TLayer, TPose>` is the kit-owned tree. `adapter` is the low-level contract actions use for mutation. `SceneCanvas` synthesizes an adapter from the scene so you rarely touch the adapter directly.
