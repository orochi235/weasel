# Handoff: weasel main

For the session picking this up: what is in flight and what has no other home. Open work is
`docs/TODO.md`. Calls made without a ruling are `docs/unruled.md`. Decisions and traps from finished arcs are
`docs/retained.md`.

## State (2026-10-30, evening)

- 1.14.2 is on npm (all 49 packages, checked with `npm run check:published`); `main` and `origin/main` are at
  b6d8ba184. The batch it carries passed the full suite at 106f27060 and 77927c197.
- Nothing in flight. GitHub's visual regression job may flag text-heavy shots after the small-glyph area
  coverage change; regenerate through the `visual-update` workflow if it does.
- The windease fix for a never-shown node is on windease's `main` (24ec47d) and not yet released (npm has
  2.2.0); the weasel TODO entry says what follows its release.
- The main checkout's `npm install` holds back install scripts for esbuild 0.28.2 and fsevents until
  `npm install-scripts approve`; `node_modules/.bin/esbuild` answers 0.27.7.

## Decisions taken in conversation and not visible in the code

- weaselchart's grid and snapping (2026-10-19): pipeline mode's route editing takes the same snap change with
  no opt-out (readout-colored guides, Shift locks a bend's direction, Ctrl turns snapping off); grid and
  snapping are chart mode only, and pipeline mode's Look is a pref; kernel3d honors `SnapBegin.omit` but not
  `sources`, which are 2D-typed on purpose, and a 3D host warns once if handed any.
- Slider's slim face was dropped on Mike's word (2026-10-24), when `density` became `trackHeight`, `thumbSize`
  and a `dot` thumb shape.

## Traps

- Every checkout needs core rebuilt (`npm run build -w @weasel-js/core`) before `dev:forge` loads: the capture
  endpoint imports `@weasel-js/core/json` from core's `dist`.
- Nothing heavy runs on Mike's machine: tests, typecheck, lint and builds go to the fleet through onto.
- onto keeps one tree per repository per node, so parallel arcs want their own nodes, and a full
  `npm run test:fleet` queues behind an arc testing on the same node.
- Run a subagent controller from outside a worktree: a session inside one locks every subagent to it.
- Two commits in agent batch 7 do not build alone (5b7d0acfe, 11e2b7d6f); the merge's tree is the gated one.

## Not seen in a browser

Passed its tests and was never looked at by a person. Delete a line when someone has.

- 2026-10-30: small atlas text (16px and below at DPR 1) under area coverage, against the edit overlay;
  `SelectionPanel` drawing a nested `tab`/`panel` in place; a per-vertex-colored shape drawn in the batch; a
  dev server recovering a missed file event (its `[watch]` log line).
- 2026-10-30: the site's ELK demo (`DiagramElkDemo`) under network-simplex placement, which moves its nodes.
- 2026-10-30: `layered` keeping long edges inside the drawing, and `bezier` legs between facing ports kept
  inside their band, on `CLOUD` (before/after on the wall, zone `weasel`: F356DA5C and 9E878B57 before,
  0B209999 and 46CC661B after, each bezier then orthogonal); seen only as SVG drawn from the routed points,
  not in the site's diagram demos.
- 2026-10-29: grid and guide snaps landing a stroked shape's drawn box (and its center or far edge), equal
  spacing and alignment marks on a turned resize, a multi-node move snapping its union box; `layered`'s new
  group ranking and tight group boxes in the site's diagram demos (before/after on the wall, zone `weasel`,
  A017E84F and 8DBF1F36); nested rect clips in the renderer.
- 2026-10-28: the prefs pane's single scrollbar clearance with a mouse connected; the turned `step` symbol's
  title; draw's `registry-enum` radios; the custom shader demo on a clock; the Export literal drawn plain then
  colored; kernel3d's footprint and aim on the ground plane; the view snapped to whole device pixels while
  panning; forge's Issues panel listing through `gh` and its Report page; the `--wzl-workspace` ground in draw
  and the asset editor, light and dark; the 13 text fields under an input method; Roughen, Zigzag and Pucker & Bloat in draw's
  Path menu, their glyphs (wall, zone `weasel`, CABD0CBC), and their keys (Alt+Shift+G, Z, K).
- Agent batches 2–10: the redrawn path and warp glyphs (wall, zone `weasel`, 5FEDE721) and the boolean-group
  glyph (702ADFE6).
- 2026-10-25 batch: the Tooltip fade, the square lens body's line-track zoom, a squeezed `ToolbarDock` row, a
  torn-off bar keeping its state, the disabled-tab dimming, and draw's effect-node titles.
- 2026-10-24 batch: the forge loupe fixes (Follow holds, wheel scrolling under a lens and into an isolated frame,
  Live readouts, nested-lab top canvas, scrolled isolated stories, Pixels on an index page), popovers and context
  menus in a magnified copy, Live copies painting `--wzl-surface`, and the "Nothing under the reticle" background.
- Appearance axes (2026-10-24): every color change: grade and emphasis on panels, dialogs, callouts, badges,
  code and buttons; dot thumbs; `stance="confirm"`; the Callout's accent wash; info badges and toasts on
  `--wzl-info`; Badge `warn` on `--wzl-warning`. `tests/visual/panel-stances.spec.ts` was migrated but not run.
- Forge loupe (2026-10-21): the three CanvasStack lens fixes (zoom reaching the Live copy, the reticle's pose,
  the chrome strip below the handles).
- Menus: the menu bar's pointer and keyboard behavior in real Chrome and Safari, Option+letter on macOS,
  `MenuButton` in `LabSwitcher` and `CommandBar`, the `.frame:focus-visible` ring, and a link row released with
  Cmd held after a long press-drag (`window.open` from a pointerup may be blocked as a popup).
- Renderer: the `u_origin` shader path for large translations, the `a_position` pin, skewed text and images,
  the glyph atlas reclaim, an emoji at any size, and the split SVG export.
- Canvas: the size a kit canvas takes from core's stylesheet, in `apps/draw` and the site's demos; a pre-built
  slot layer.
- Chrome: the rotate ring, a live resize, and gradient handles on a skewed node; the rotate snap; the selection
  chrome on a dragged diagram group; the new layouts under a drag; `MultiSelectDemo`'s corner resize.
- ui: flat buttons; the bevels under `win9xTheme` and `platinumTheme`; "None" on a nested paint; the bar
  overflow menu; `QuantityText`; a label row in `PrefsForm`; the theme editor's dead-draft screen; `Split`'s
  sidebar as a size container; the toast hover and held stepper fixes; the Trim and Merge icons.
- draw: the grid and snap buttons, the path-edit entry, toasts, the Import button, and its two split dev pages.
- Site and demos: the site without its own palette, the source tabs, `AnimationDemo` on the kit's adapter, the
  rig tools demo's live weight stroke, and the `pretty` output in `SvgDemo`.
- forge and labkit: forge's two hot-update fixes (server side; needs `WAKE_PATH=/nonexistent`), and labkit's
  surface ghost and wheel-over-mark fixes.
- Pass 6, renderer: the batch's sampler tree, its per-vertex color matrices, synthetic bold in the run, and a
  gradient measured from its own start.
- Pass 6, canvas and scene: the adopted canvas size rule on a high-density screen, a container's label over its
  children, the text edit overlay under a framed container, draw's page through `pagesLayer`, and a panel slider
  drag with the canvas following.
- Pass 6, ui: `ToggleBar`'s `minimal`, minimal bars at `md`, `ActionBar` on `Bar`, a bar's `menu` overflow, a
  heading leaf in `PrefsForm`, dimmed units in `BandEditor` and `Transport`, the bare `MenuButton` trigger, badge
  padding under scallops and spikes, the slice icon at 16px, and `GradientEditor`'s focus ring and the editor
  inside `PaintField`.
- Pass 6, labkit and forge: `LabSwitcher` on `MenuButton`, the viewport controls as `Button`s, the
  unreadable-records strip, the stage re-fit, a kept story frame through a viewport change, and the twelve
  stories rewritten to render from args.
- Pass 6, site: every package page, the root that no longer scrolls, the color mode control, the demos in light
  mode, and the plasma panel's hover.
- Pass 6, SVG: the `<tspan x dy>` lines and the split marker paths in a viewer.
- Split values in `PrefsForm`: the marks in a heading and in a bar cell.
- Path editing (2026-10-14): Retract and Symmetric in draw's bar, Shift on a handle drag, the Simplify and
  Offset sliders' previews, Cut at Crossings, Join and Average, Cmd+D after a move, rotate, resize, and a
  duplicate-and-move, Space during a shape drag, and a star's Points and Inner rows in the inspector.
- Menus (2026-10-16): a bar's menu flipping above its button near the viewport bottom, the WebGL menu placed
  under a rect, and a menu asset previewing open in the asset editor without taking focus during a rename.
- weaselchart (2026-10-20): the grid, snap to grid, alignment and spacing marks on a move, a route bend snapping
  with Shift and Ctrl, a stencil dropped beside a shape, and the Preferences dialog.
- Overnight pass (2026-10-20): a `ToolPalette` grid's arrow keys, a disabled bar button's tooltip, a cleared
  clearable field in labkit, the corner panel's shape row with no shape, the loupe through a real drag, and a
  scoped container's length fields (no app passes `units` yet).
- By ear: the music bed's level, and whether each cue in the `score` demo reads as its name.

## Weak evidence

- The animator's frame-cost and churn numbers are single runs on a busy machine.
  `node tests/perf/target-reads/run.mjs` on a quiet one is the check.
- `fseventsd` on orochi sat at 99% CPU through the night of 2026-10-13 and delivered no directory events to
  `fs.watch`, which made forge's dev server serve stale modules. The cause was not found; forge warns at startup
  when its watcher is silent.
