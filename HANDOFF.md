# Handoff: weasel main

For the session picking this up: what is in flight, what is next, and what has no other home.
Open work is `docs/TODO.md`. Calls made without a ruling are `docs/unruled.md`. Decisions and
traps from finished arcs are `docs/retained.md`.

## Overnight pass, 2026-10-20 (status at 05:20)

For Mike in the morning. Every ruling below is also in `docs/unruled.md`, dated 2026-10-20 and
marked "overnight pass". Nothing is pushed.

**`main` is green at `48ac2d533`** (full fleet run on teitou: 27836 passed, 0 failed).

Merged:
- `ToolPalette` with `columns` moves a row on Up and Down: `useRovingTabIndex` gained `columns`
  and `groupSelector`. Rulings: Up and Down stop at the edges, Home and End span the whole
  palette, `rovingTarget` and `rovingGridTarget` are exported. Filed: no right-to-left handling.
- `moveNodes` and `moveNodesOps` in core move ids the way a drag commits them; weaselchart's
  stencil drop inserts then moves in one undo step, with no probe insert. Rulings: not 2D-only, a
  zero delta commits nothing, `ingest` and paste declare three more deps, the undo entry reads "Drop".
- A disabled bar button says why: `useLeafAction`'s `reason` is now `disabledReason`, and a bar
  button disabled with a reason is `aria-disabled` and focusable. guides builds node gates only on
  a point gesture's path (no bug there: `siblingIds` already skipped hidden nodes).
- `selectTool.rotate: false` is decided once, in preset resolution. Ruling: it is about the select
  tool only; the rotate action stays registered, the handle is hidden, and a re-shown handle is
  inert and silent.
- The HUD's every-frame text makes about 38% less garbage: 11.3 ms a frame at 5,000 glyphs on
  msb-uai became 8.4, against the DOM's 6.1, so the DOM still wins and the TODO entry stays, rewritten
  around the layout's own per-glyph output (`tests/perf/README.md`, "What the HUD allocates").
- Prefs' Rail Filterable timed out on the fleet because each story test resized the browser page
  for a story's viewport, and Chromium took 6–13 s per resize on a loaded node (measured). A story's
  viewport now sizes its box instead; `RunStoryOptions.viewport` is gone.
- Nothing outside labkit's passthrough imports the `@weasel-js/ui` barrel: five new subpaths
  (`stance`, `portal-host`, `color`, `paint-gradient-track`, `kit-settings`), names ruled.
- A node's kind has one classifier, the routing kind, read by the canvas, the selection label (so
  the command palette names it) and `SelectionPanel` (new core export `routeKind`).
- A move, resize or rotate preview carries pose once, in the scene's overrides; the ghost and the
  selection chrome read `effectivePose`, and the three handles drop `previewPose`.
- forge's "ResizeObserver loop" error, raised on every forge page: labkit's `SidebarPanes` kept
  observing a section bar after windease removed its panel. It now observes each bar from mount
  to removal (a browser test mounts a whole `Lab`).
- The bone and weight tools moved out of core into a new `@weasel-js/rig` (breaking for core's
  barrel; the changeset says so). It has never been published: the next release publishes it for
  the first time. A checkout needs `npm ci` before a dev server there resolves `@weasel-js/rig`.
- GitHub CI's Node 22 leg, red on every push since 2026-10-19 (the fleet runs only Node 24): the
  icon plugin now walks its parse tree itself, and the leg's failing files pass on Node 22 on the
  fleet. CI has not run it, since nothing is pushed. Still open there, filed as a P2 under
  "Release-gate & build hygiene": the fleet runs neither Node 22 nor Linux Chromium; ten Linux
  browser failures last seen 2026-10-20 00:45 with unknown status; Visual Regression's 7 of 87.
- weaselchart's line-jumps browser test failed in full runs because its pixel reader opened the
  canvas's WebGL context before the app did, with no stencil buffer, and the renderer refused the
  canvas for good (both failing logs carry the error). Every pixel reader that made a bare
  `getContext('webgl2')` now asks for the renderer's settings, and CLAUDE.md's trap says so. Filed:
  one shared reader (`@weasel-js/core/testing/canvasPixels`), the settings in one public constant
  (`CANVAS_CONTEXT_ATTRIBUTES`), and a lint rule against the bare call, all merged.

In flight (each in `.claude/worktrees/agent-*`, branch `worktree-agent-*`):

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
- By ear: the music bed's level, and whether each cue in the `score` demo reads as its name.

## Weak evidence

- The animator's frame-cost and churn numbers are single runs on a busy machine.
  `node tests/perf/target-reads/run.mjs` on a quiet one is the check.
- `fseventsd` on orochi sat at 99% CPU through the night of 2026-10-13 and delivered no directory
  events to `fs.watch`, which made forge's dev server serve stale modules. The cause was not
  found. forge warns at startup when its watcher is silent.
