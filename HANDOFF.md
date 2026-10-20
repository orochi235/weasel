# Handoff: weasel main

For the session picking this up: what is in flight, what is next, and what has no other home.
Open work is `docs/TODO.md`. Calls made without a ruling are `docs/unruled.md`. Decisions and
traps from finished arcs are `docs/retained.md`.

## weaselchart fourth arc: building (2026-10-20)

Spec: `docs/superpowers/specs/2026-10-20-chart-fourth-arc-design.md`; its Pieces table marks what is
built. Label drag, the group layouts, the patchable audio graph and pages in `DiagramData` are
merged. PDF (wave 1) and the live audio runner (wave 2) are each being built by a controller agent
in its own `.claude/worktrees/agent-*` worktree from that piece's plan in `docs/superpowers/plans/`;
each controller deletes its plan when it finishes. Merge each branch to `main` once its fleet run
is green; `docs/TODO.md`'s fourth-arc line and the spec's Pieces rows conflict on every merge.

`main` passed a full fleet run at `befd71b6c` with the first three pieces merged (2026-10-20).

Pages in `DiagramData` are built (2026-10-20).

## Overnight pass, 2026-10-20 (status at 07:20)

For Mike in the morning. Every ruling is in `docs/unruled.md`, dated 2026-10-20 and marked
"overnight pass". Nothing is pushed.

**`main` is green at `d910b2ff2`** (full fleet run on teitou: 27923 passed, 0 failed). Twenty-seven
merges from this pass; the TODO entries it retired are in `git log`.

🔴 **GitHub CI on `main` has been red since 2026-10-19 04:11**, unseen because the fleet runs only
Node 24 on macOS. The Node 22 leg's cause is fixed here (the icon plugin walks its parse tree
itself) and passes on Node 22 on the fleet, but CI has not run it: nothing is pushed. Also open
there, in the P2 "CI tests Node 22 and Linux Chromium": ten Linux-only browser failures last seen
00:45 with no run since, and Visual Regression failing 7 of 87.

🧨 **API changes made on my rulings**, each one commit plus a `patch` changeset saying so:
`useLeafAction`'s `reason` is `disabledReason`; `RunStoryOptions.viewport` is gone; move, resize and
rotate handles drop `previewPose` (read `effectivePose`); `bone` and `weight` left core for a new
`@weasel-js/rig`; `useLoupe` alone no longer aims (it needs `<LoupeGestures>`); a clearable params
leaf holding nothing draws cleared. Revert the merge to undo any one.

⚠️ **`@weasel-js/rig` has never been published.** The next release publishes it for the first
time, and a checkout needs `npm ci` before a dev server there resolves it.

⚠️ **The fleet gate skips every CI step after the build**, both consumer smokes among them; both
had failed on `main` for a day under green fleet runs. Filed as a P2.

✅ **Engine and UI:**
- `ToolPalette` grid arrows (`useRovingTabIndex` `columns`), mirrored under right-to-left.
- `moveNodes` moves ids as a drag commits them; weaselchart's stencil drop is insert-then-move.
- A disabled bar button says why.
- `selectTool.rotate: false` decided once, in preset resolution.
- One node-kind classifier, the routing kind (`routeKind`), for canvas, palette and panel.
- A transform preview carries pose once, in the scene's overrides.
- `hover` takes `held`; the loupe aims through it.
- Grid snapping and length fields read a container's unit scope, inserts included
  (`SnapBegin.parent`). The document stores world units.
- Every params surface reads a leaf's value through `prefLeafValue`.
- A renamed baseline pref keeps its stored key in the schema editor.
- The double-click window is measured from each event's own time.
- The HUD's every-frame text makes about 38% less garbage (8.4 ms a frame at 5,000 glyphs, from
  11.3; the DOM's 6.1 still wins, so its entry stays).
- Five ui subpaths; nothing but labkit's passthrough imports the barrel.

✅ **Tests that failed only under load, each fixed at its cause:** Rail Filterable (a 6–13 s
Chromium page resize per story viewport), weaselchart's line jumps (a pixel reader opened the
canvas's context first, without a stencil; now one shared reader, `CANVAS_CONTEXT_ATTRIBUTES`, and
a lint rule), the diagram containers double-click (a frame's wait between clicks), and forge's
"ResizeObserver loop" error on every page (a stale observer in labkit's sidebar). Both consumer
smokes pass again, and `check:imports` now counts a `testing/` module a manifest exports.

❓ **Should a swapping node take full fleet runs?** forge's timeline file took 88–102 s in the keiei
runs that failed, 42 s in a keiei full run with 16 GB free, and 20–44 s on the other nodes; that the
failures coincided with keiei's swap is inferred from `onto status`, not measured inside them. Keeping
a swapping node out would be an onto setting; nothing was changed. The tests' own faults are fixed:
the site routing test rendered all 46,000 elements of the real release history to find one heading
(now a mocked changelog, 1.9–3 s to 0.32 s), and a timed-out timeline test's body leaked a mount into
the next test (now tied to the test's abort signal). The entry is rewritten in `docs/TODO.md`.

ℹ️ **Weak evidence:** the params absent-value tests were never seen failing (the red run synced the
fixed tree); the unit-scope grid tests likewise. Nothing tonight was looked at in a browser by a
person; the list is under "Not seen in a browser". keiei is short on memory and fails two files in
most full runs (filed P3).

🎫 *Filed: CI's Node 22 and Linux gap (P2), the gate's post-build gap (P2), keiei-only timeouts,
the drawn grid per unit scope, a rekeyed-then-renamed pref reading as new (all P3).*

🧹 *`main` is far ahead of `origin/main`; nothing pushed. One agent pushed its branch against its
brief and deleted it at once; it is not on origin and started no CI run. An untracked
`scripts/time-overlap.sh` in the main checkout is not from this pass.*

## State

The sixth TODO pass merged on 2026-10-13: fifteen agents, one per `docs/TODO.md` section, took the
P3s and four P2s (every adapter carries the tree, `GradientEditor` edits one selected stop, four
run-breakers joined the batch, and every package has a page on the site). Its calls are in
`docs/unruled.md` under "pass 6". The agents ran one test file at a time; the merge was
typechecked and run on the fleet afterward.

Split values in prefs landed the same day (`packages/prefs/README.md`, "Split values"): a leaf's
value held once per option of an enum leaf, folded by weight when read, and edited in `PrefsForm`.
`prefsCss` writes such a store as CSS custom properties, and `pref` builds a schema in short
form. The arc after them is a P2 entry in `docs/TODO.md`: a theme's tokens as a prefs schema.

weaselchart's grid and snapping merged on 2026-10-20. It brings a page grid, snap to grid,
alignment and spacing snaps, and a prefs schema with a Preferences dialog. Underneath, core's
`SnapBegin` gained per-gesture `sources` and `omit`, and diagram's route handles now snap through
core's snap session rather than their own (`docs/snapping.md`). Decisions taken in conversation and
not visible in the code (2026-10-19):
- Pipeline mode's route editing takes the same snap change, with no opt-out. That means
  readout-colored guides, Shift to lock a bend's direction, and Ctrl to turn snapping off.
- Grid and snapping are chart mode only. Pipeline mode's Look is a pref.
- kernel3d honors `SnapBegin.omit` but not `sources`. Gesture sources are 2D-typed on purpose, and
  a 3D host warns once if it is handed any.

## Menus: done

All of the menus design has landed: `MenuBar` with access letters, `MenuButton` on the menu
renderer, WeaselDraw's menu bar and file actions, and labkit's lab-wide registry, menu bar and
context menus. The decisions that are not visible in the code are in
`packages/menu/README.md` ("Decisions"); what is left is filed in `docs/TODO.md` (search
"menu bar", "parametric", "labkit context menus"). Nothing here is pushed.

How subagent work ran, for the next arc run this way:

- Run the controller from outside a worktree (`ExitWorktree` first). A session inside one locks
  every subagent to it, and the SDD skill's helper scripts are refused there; outside, each
  implementer works in its arc's worktree by absolute path.
- Targeted tests run on a node, never here: `onto do --node <name> --ref origin/main -- npx
  vitest run --project=<p> <path>`. `npm run check:test-projects` maps directories to projects.
- `onto` keeps one tree per repository per node, so give each parallel arc its own node (teitou,
  studio, msb-uai, keiei; orochi is this Mac), and keep a full `npm run test:fleet` off a node an
  arc is testing on: they queue behind each other, and a timing-budget test run alongside fails.

## Next

1. Everything on the 2026-10-13 never-run list ran on 2026-10-15 and passes, `npm run build:api`
   included (the package pages entry in `docs/TODO.md` holds what is left); what it turned up is the pull request
   benchmark entry in `docs/TODO.md` (over its time limit, and a comment that drops half the
   benchmarks). The five edited perf specs ran on keiei but were compared against nothing, so
   the batch's new shader paths still have no before-and-after number. Not exercised: the
   release job's `npm run release` and `gh release create`, which only a real release can run.
2. See the list below in a browser.
3. Rulings: `docs/unruled.md`, and the either/ors left in `docs/TODO.md` entries. Two wait on a
   word from the owner: the new name for the `features` directory, and the second cue for disabled
   controls.
4. astv: the Changes pane's Submit button is built (`onSubmit(changes, literal)` on
   `PrefSchemaEditor`) and astv's session wires the host half. Its prefs adapter can stop resending
   refused writes once it reads a rebuilt `dist`.

## Not seen in a browser

Passed its tests and was never looked at. Delete a line when someone has.

- Menus: the menu bar's pointer and keyboard behavior in real Chrome and Safari, Option+letter on macOS, `MenuButton` on the new renderer in `LabSwitcher` (link rows) and `CommandBar` (with a tooltip), the `.frame:focus-visible` ring on button frames, and a link row released with Cmd held after a long press-drag (it calls `window.open` from a pointerup, which a browser may block as a popup).
- Renderer: the `u_origin` shader path for large translations, the `a_position` pin, skewed text
  and images, the glyph atlas reclaim, an emoji at any size, and the split SVG export.
- Canvas: the size a kit canvas takes from core's stylesheet, in `apps/draw` and the site's demos;
  a pre-built slot layer.
- Chrome: the rotate ring, a live resize, and gradient handles on a skewed node; the rotate snap;
  the selection chrome on a dragged diagram group; the new layouts under a drag;
  `MultiSelectDemo`'s corner resize.
- ui: flat buttons; the bevels under `win9xTheme` and `platinumTheme`; "None" on a nested paint;
  the bar overflow menu; `QuantityText`; a label row in `PrefsForm`; the theme editor's dead-draft
  screen; `Split`'s sidebar as a size container, with popovers and drags inside it; the toast
  hover and held stepper fixes; the Trim and Merge icons.
- draw: the grid and snap buttons, the path-edit entry, toasts, the Import button, and its two
  split dev pages.
- Site and demos: the site without its own palette, the source tabs, `AnimationDemo` on the kit's
  adapter, the rig tools demo's live weight stroke, and the `pretty` output in `SvgDemo`.
- forge and labkit: forge's two hot-update fixes (server side only; needs
  `WAKE_PATH=/nonexistent`), and labkit's surface ghost and wheel-over-mark fixes.
- Pass 6, renderer: the batch's sampler tree, its per-vertex color matrices, synthetic bold in
  the run, and a gradient measured from its own start. Their browser tests pass in headless
  Chromium; nobody has looked at a frame.
- Pass 6, canvas and scene: the adopted canvas size rule on a high-density screen, a container's
  label over its children, the text edit overlay under a framed container, draw's page through
  `pagesLayer`, and a panel slider drag with the canvas following.
- Pass 6, ui: `ToggleBar`'s `minimal`, minimal bars at `md`, `ActionBar` on `Bar`, a bar's
  `menu` overflow, a heading leaf in `PrefsForm`, dimmed units in `BandEditor` and `Transport`,
  the bare `MenuButton` trigger, badge padding under scallops and spikes, the slice icon at 16px
  (its handle closes up), and `GradientEditor`'s focus ring, and the editor inside `PaintField`.
- Pass 6, labkit and forge: `LabSwitcher` on `MenuButton`, the viewport controls as `Button`s,
  the unreadable-records strip, the stage re-fit, a kept story frame through a viewport change,
  and the twelve stories rewritten to render from args.
- Pass 6, site: every package page, the root that no longer scrolls on every existing page, the
  color mode control, the demos in light mode, and the plasma panel's hover.
- Pass 6, SVG: the `<tspan x dy>` lines and the split marker paths in a viewer.
- Split values in `PrefsForm`: seen in headless Chromium in six stories, light and dark; the
  marks in a heading and in a bar cell were not.
- Path editing, 2026-10-14: Retract and Symmetric in draw's bar, Shift on a handle drag, the
  Simplify and Offset sliders' previews, Cut at Crossings, Join and Average, Cmd+D after a move,
  rotate, resize, and a duplicate-and-move, Space during a shape drag, and a star's Points and
  Inner rows in the inspector.
- Menus, 2026-10-16: a bar's menu flipping above its button near the viewport bottom, the WebGL
  menu placed under a rect, and a menu asset previewing open in the asset editor without taking
  focus while a row is renamed.
- weaselchart, 2026-10-20: the grid, snap to grid, alignment and spacing marks on a move, a route
  bend snapping to the grid with Shift and Ctrl, a stencil dropped beside a shape, and the
  Preferences dialog (headless browser tests only; the grid screenshot is the one frame seen).
- Overnight pass, 2026-10-20: a `ToolPalette` grid's arrow keys, a disabled bar button's tooltip,
  a cleared clearable field in labkit drawing empty, the corner panel's shape row with no shape,
  the loupe through a real drag, and a scoped container's length fields (no app passes `units` yet).
- By ear: the music bed's level, and whether each cue in the `score` demo reads as its name.

## Weak evidence

- The animator's frame-cost and churn numbers are single runs on a busy machine.
  `node tests/perf/target-reads/run.mjs` on a quiet one is the check.
- `fseventsd` on orochi sat at 99% CPU through the night of 2026-10-13 and delivered no directory
  events to `fs.watch`, which made forge's dev server serve stale modules. The cause was not
  found. forge warns at startup when its watcher is silent.
