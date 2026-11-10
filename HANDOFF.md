# Handoff: weasel main

For the session picking this up: what is in flight and what has no other home. Open work is
`docs/TODO.md`. Calls made without a ruling are `docs/unruled.md`. Decisions and traps from finished arcs are
`docs/retained.md`.

## State (2026-11-07)

- 1.17.3 is on npm (all 54 packages; the release's registry install resolved), after 1.17.0, 1.17.1 and 1.17.2 the
  same day. It carries the face-crossing polish, labkit's live auto rows (an auto row shows its control ghosted and
  any edit pins it) and the `reportAuto` toggle fix, collego's nine fixes (overlay theme, minimap indicator, key
  holding and fallback, text-only `isEditableTarget`, keys stopping at modals, one entered-group store per scene,
  disabled reasons on commands, menus, and buttons), and `@msb235/blits` as a `^1.1.0` peer of core and animator.
  Its batch (`batch/2026-11-07g`) ran `test:fleet --full` at 21180df69 (35395 passed, 1 failed:
  `AnnotationOverlay.clip`, the filed P2 that fails in some full runs) and `test:fleet:postbuild` green at 47cce78f9,
  which fixed the consumer smoke to treat third-party peers as external.
- Three more bug-audit rounds landed on 2026-11-07 evening, each through a green fleet batch: round two (66 fixes,
  pushed), round three (43) and round four (53), with `select`'s `'single'` intent and one shared condition-number rule
  for geom's 2D and 3D `invert`. round four landed through 83b654fef, a batch that ran `test:fleet` (4167 files,
  35672 tests) and postbuild green; pushed.
- Round five (2026-11-07 night, 72 fixes across nine lanes: hud and guides, audio and clock, the type packages, quantity
  and paint, history through cursor, the small packages, the secondary apps and devtools, core's interactions, and a
  sweep folding duplicated helpers into geom, paint and registry) is on `main` at f3b6313ff, through `batch/2026-11-07k`
  (`test:fleet`, a full run since ci.yml changed: 4175 files, 35733 tests; postbuild green). Pushed. Its open
  questions are under "Audit round five" in `docs/unruled.md`. `check:forge-stories` moved after ci.yml's first
  build: the fleet's test tree keeps a stale `dist`, which forge's vite config reads.
- Round six (2026-11-08, 29 fixes in core's leftovers: snap and paths, the remaining domains, animation and
  affordances, and the barrel and debug plumbing) is on `main` at 62133c61f through `batch/2026-11-08` (`test:fleet`
  2541 files, postbuild green). Pushed. Open questions are under "Audit round six" in `docs/unruled.md`.
- Round seven (2026-11-08, a second pass: renderer, diagram, draw, labkit and forge, geom/stroke/path-tools,
  routing/theme/prefs, core's `core/`, and `scripts/`, plus Mike's rulings: empty fits land on Cmd-0's view, no-op
  `update`/`setPose` record nothing, draw's background is undoable and its filename is not, `applyTheme` drops token
  text that could leave its rule, a number field steps by the smallest step its display shows) is on `main` at
  d9c637a1a through `batch/2026-11-08b` (`test:fleet` full: 35819 tests; postbuild green). Pushed. Open questions
  are under "Audit round seven" in `docs/unruled.md`. The scripts lane's stricter checks now fail where they used to
  pass silently.
- Round eight (2026-11-08: ui, core's canvas and interactions, animator/gestures/kernel3d, the type packages,
  hud/guides/menu/history/storage, quantity/paint/audio/clock, and site/chart/theme-editor), the eyedropper (one engine
  sampler in `@weasel-js/loupe`, a `colorAt` dep that redraws document layers, labkit's trial toggle, draw's tool on
  `I`) and labkit's `.meta()` field slot are on `main` at 9720cf0c2 through `batch/2026-11-08c` (`test:fleet` full:
  35916 tests; postbuild green). Pushed. Open questions are under "Audit round eight" in `docs/unruled.md`.
  `check:frame-loops` now covers `apps/` too (Mike, 2026-11-08), and `usePages.add` puts a page after the one shown.
- Round nine (2026-11-08: pdf/svg/diagram-formats/d3, plot and chart, font/text-shaping/bidi, the small packages,
  editor/storage/loupe/p-touch and the rest, icons and devtools; 42 fixes) is on `main` at d548e497b, through
  `batch/2026-11-08d` (`test:fleet` at 72a4db7fd: 36063 tests; postbuild green). It was merged over another session's
  `effect-list` and `icons-freeze` merges without a run of the combination (Mike, 2026-11-08); the two touch no file
  in common. Open questions are under "Audit round nine" in `docs/unruled.md`.
- Round ten (2026-11-08: ui, routing/cursor/gestures, labkit/prefs/hud/forge, renderer/stroke/paint/text, diagram,
  draw/path-tools, core/geom/select/history, kernel3d/animator/audio/headless, scripts and the secondary apps; 45
  fixes, plus the eyedropper and hand tool reading through chrome claims) is on `main` at 8d36c5e16 through
  `batch/2026-11-08e` (`test:fleet`: 36256 tests; postbuild green), and the hand fix at cd61bfa32 (branch run 15039
  tests, full typecheck). Pushed. `frame-fixes` (paths in groups read and written in world, derived nodes picked
  through their own frame) followed at 7186be511 through `batch/2026-11-09`; pushed. Open questions are under "Audit round ten" in `docs/unruled.md`.
- Round eleven (2026-11-09, the same lanes; about 50 fixes, plus Mike's rulings that the image cache closes what it
  drops and plot's sizes clamp) is on `main` at 5e7c5fabd through `batch/2026-11-09b` (`test:fleet` full at
  194990bac: 34268 passed, 1 failed, fixed; reruns on the tip green; postbuild green after the consumer smoke check
  learned bare imports). Pushed. Open questions are under "Audit round eleven" in `docs/unruled.md`.
- Round twelve (2026-11-09, gestures: schema, dispatch, resolution, consumers; plus Mike's rulings on a throwing
  deferred start and zero-width strokes, and six TODO pickups) is on `main` at 535d4001f through `batch/2026-11-09c`
  (`test:fleet` full: 36477 passed after three test fixes; postbuild green). Not pushed. Six key choices wait on
  Mike under "Audit round twelve" in `docs/unruled.md`.
- Round thirteen (2026-11-09, the nine lanes again, per-view 3D cameras, Mike's key choices and the SVG data-URL
  ruling) is on `main` at 84c3cb6b6 through `batch/2026-11-09d` (`test:fleet` full: 36604 passed after a loupe
  regression, a format fix and a size split; postbuild green), and the discard-key change through
  `batch/2026-11-09e`. Released and pushed with the version commit that follows.
- Round fourteen (2026-11-10: ui, routing, core, render, the text stack, diagram, labkit, motion, the small packages;
  about 38 fixes, plus a sweep replacing `Math.min/max(...xs)` over unbounded lists with geom's new `minOf`/`maxOf`)
  is on `main` at d66392e69 through `batch/2026-11-10-audit14` (`test:fleet` 36952 passed, postbuild green, merged
  with the svg/path-tools property passes). It fixes today's tool-options regression: a polygon's sides or a star's
  points set after one shape didn't reach the next. Not pushed. Open questions are under "Audit round fourteen" in
  `docs/unruled.md`.
- astv waits on the next weasel release for `.meta()`: its TODO "Prefs-only fields marked on the field" (astv
  1d4a53c9) swaps its `PREFS_ONLY` set for `leaf.meta?.prefsOnly`.
- The site deploy of 1.17.2's version merge timed out in GitHub Pages' `syncing_files`; 1.17.3's deploy succeeded.
- Two sibling worktrees (`fix-keys`, `fix-overlay-theme`) ended up holding each other's uncommitted tracked edits,
  new files excluded, while both ran `onto do` jobs. onto-ad ruled onto out; the cause is unknown. Agents committed
  by path, and the stray copies matched what merged. Until it is understood, give parallel agents in sibling
  worktrees a brief that forbids `git stash`, and diff any leftover files against the merge before removing a tree.
- Release no longer repeats `check:manifests`, `check:treeshake` and `check:react-free`: postbuild runs them.
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

- 2026-11-09, round thirteen: two 3D views on one surface picking through their own cameras; View › Snapping and
  Mod+Shift+;; MenuBar's Alt+letter only with focus on a title; a press on a selected lens taking focus back;
  a job's Cancel staying put as its count climbs.
- 2026-11-09, round twelve: Cmd/Shift-click selection and the range box; a curved slider's values along its arc;
  an empty prefs fragment's drop slot; the API panel's typedoc links and overloads; Path Edit's Enter yielding to
  slice, pen and spiro.
- 2026-11-09, audit round eleven: right-to-left arrows in `PageTabs`, `TokenField`, `ItemList`, the icon picker,
  `PrefsRail` and `Tree`, and a right-to-left `Tree` drag; a long letter-spaced underline on a retained surface;
  Undo order between marks and settings in a lab; packet and radar editors clamping a typed size.
- 2026-11-08, audit round ten: a thick hatch fill's tile corners (no notches past a 2.8-unit line); an ELK self-loop
  naming one port drawn round a corner; the eyedropper picking and the hand panning over a measurement in draw;
  draw's page clip after a reload; arrow keys then Tab leaving a `SwatchGrid` from the swatch reached.
- 2026-11-08, sweep and tiling: a drag across `ToggleBar` (`sweep`, multiple mode) or `OptionsBar` setting each
  segment it crosses, in a real browser; a wrapped bar (`columns`) drawn as one well rounded only at its outer
  corners, and `lastRow: 'fill'` stretching the short row (ToggleBar stories `Sweep` and `Wrapped`).
- 2026-11-08, eyedropper arc: labkit's Eyedropper toggle and picked-color readout in a trial's toolbar
  (and that a click on the stage picks while it is on); draw's eyedropper on `I` in the tool palette, its
  cursor, and that a pick sets the focused fill or stroke.

- 2026-11-07 night, audit round five: theme-editor's palette lab anchor rows (kit `ColorField`/`NumberField`) and
  preset buttons (kit glyphs); guides drawn with `dash`; devtools rows keeping their place as the buffer drops entries.
- 2026-11-07 night, audit rounds three and four: draw's rulers reading CSS px at 96 to the inch with point and inch
  steps; the Timeline shading a nested timeline's lanes past its declared duration and dimming the keys there; text
  typed through an input method taking an armed style; a line of mixed faces clearing the deepest descent, against the
  edit overlay's CSS; a paste ending in a line break keeping it; draw's Paper select showing Custom.
- 2026-11-07, rulers: draw's View > Show rulers and the site's Rulers demo (`#rulers`). Ticks following pan
  and zoom, labels switching to millimeters over the demo's half-size part, the pointer marker, and dragging
  a guide off a ruler, moving it, dropping it back on a ruler, and undoing each. The look is provisional.
- 2026-11-03, dither demo: the Marks toggle (snapped to dots / as drawn), "By mask" now built from the id
  buffer, and an insert's drag preview fitted to where a size-snapping rule lands it.
- 2026-11-03, draw: a shape hanging off its page, saved as SVG and opened in another viewer (clipped at the page)
  and back in draw (still on its own page).
- 2026-11-03, 3D lab (`npm run dev:3d` in `packages/labkit`): its tool palette and the `ui:cube` box tool, undo
  after a press in the 3D surface, the menu bar in a lab's header after the title, and a narrow lab's header
  wrapping.
- 2026-11-02, measure: a measurement inside a frame declaring `units.drawnAt` reads that frame's true length
  (30 world units in a 0.4× drawer read 75); ends in frames that disagree read in the scope they share.
- 2026-11-02, stroke trim: the site's Stroke trim lab (`#lab-stroke-trim`) holds every case beside its exported
  SVG, with Write PDF. Seen there headless: rounded and stretched rounded paths, inner/center/outer squares, and
  canvas, SVG, and PDF agreeing (wall, zone `weasel`: 190854B0, FED374F8). Not yet looked at: zooming in on a cut
  (it should not move), dashes and Pace set to Anchor on a trimmed run, a start past the end wrapping a closed
  path, and draw's Trim row (Start, End, Pace under the stroke's markers) on a drawn shape.
- 2026-10-30 evening: rows along an arc following the arc's direction (`Bar`, tabs, radio groups, swatch rings);
  the trial status strip's scale readout about 1.5 px higher; `ListEditor` entries holding a draft until blur;
  pattern and simple even-odd fills drawn in the batch; `CurvedLabel` with no bidi engine registered.
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
