# Handoff: weasel main

For the session picking this up: what is in flight, what is next, and what has no other home.
Open work is `docs/TODO.md`. Calls made without a ruling are `docs/unruled.md`. Decisions and
traps from finished arcs are `docs/retained.md`.

## In flight

The sixth TODO pass started on 2026-10-13: one agent per `docs/TODO.md` section, each in a
worktree of its own on a `worktree-agent-*` branch cut from `acfa982bc`. They take every P3 and
four P2s (flat-list adapters, the `GradientEditor` stop row, the batch's remaining run-breakers,
and a docs minisite per package). The branches meet in `todo-pass-6`, which reaches `main` when
`npm run test:fleet` on it is green. The agents ran one test file at a time and nothing else, so
expect the first gate run to find type errors.

## Next

1. Merge the sixth pass, and add its unruled calls to `docs/unruled.md`.
2. Run what has never run: a build of every package since the wildcard `paths` keys went,
   `npm run test:smoke:consumer`, `npm run check:treeshake`, the API reference build, the pull
   request benchmark workflow, and `tests/perf/image-quad.spec.ts`,
   `flush-anatomy`, `clip-cost`, and `flush-noise` since their frames were edited.
3. See the list below in a browser.
4. Rulings: `docs/unruled.md`, and the either/ors left in `docs/TODO.md` entries. Two wait on a
   word from the owner: the new name for the `features` directory, and the second cue for disabled
   controls.
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
- By ear: the music bed's level, and whether each cue in the `score` demo reads as its name.

## Weak evidence

- The animator's frame-cost and churn numbers are single runs on a busy machine.
  `node tests/perf/target-reads/run.mjs` on a quiet one is the check.
- `fseventsd` on orochi sat at 99% CPU through the night of 2026-10-13 and delivered no directory
  events to `fs.watch`, which made forge's dev server serve stale modules. The cause was not
  found. forge warns at startup when its watcher is silent.
