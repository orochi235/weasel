# Handoff: weasel main

For the session picking this up: what is in flight, what is next, and what has no other home.
Open work is `docs/TODO.md`. Calls made without a ruling are `docs/unruled.md`. Decisions and
traps from finished arcs are `docs/retained.md`.

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

## Next

1. Run what has never run: `npm run build:api` with the new per-package reference. Everything
   else on the 2026-10-13 list ran on 2026-10-15 and passes; what it turned up is the pull request
   benchmark entry in `docs/TODO.md` (over its time limit, and a comment that drops half the
   benchmarks). The five edited perf specs ran on keiei but were compared against nothing, so
   the batch's new shader paths still have no before-and-after number. Not exercised: the
   release job's `npm run release` and `gh release create`, which only a real release can run.
2. See the list below in a browser.
3. Rulings: `docs/unruled.md`, and the either/ors left in `docs/TODO.md` entries. Two wait on a
   word from the owner: the new name for the `features` directory, and the second cue for disabled
   controls.
4. "Five leaf packages keep their own listener sets" in `docs/TODO.md` was skipped only because
   its fix adds a dependency, and the agents could not touch `package-lock.json`.
5. astv: the Changes pane's Submit button is built (`onSubmit(changes, literal)` on
   `PrefSchemaEditor`) and astv's session wires the host half. Its prefs adapter can stop resending
   refused writes once it reads a rebuilt `dist`.

## Not seen in a browser

Passed its tests and was never looked at. Delete a line when someone has.

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
- By ear: the music bed's level, and whether each cue in the `score` demo reads as its name.

## Weak evidence

- The animator's frame-cost and churn numbers are single runs on a busy machine.
  `node tests/perf/target-reads/run.mjs` on a quiet one is the check.
- `fseventsd` on orochi sat at 99% CPU through the night of 2026-10-13 and delivered no directory
  events to `fs.watch`, which made forge's dev server serve stale modules. The cause was not
  found. forge warns at startup when its watcher is silent.
