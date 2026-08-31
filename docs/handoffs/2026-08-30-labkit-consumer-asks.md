# labkit: what other projects have asked for

For whoever picks up labkit work next. It answers one question — which labkit
changes do consuming projects actually want — and records the evidence so the
survey does not have to be redone.

Everything in "Done" below has shipped. The rest is untouched.

## Done

- **`@weasel-js/labkit/dragdrop`** exported three types and no runtime; its built
  `index.js` was empty. It now exports `Palette`, `DragGhost`, `useDragDrop` and
  `DragOverlay`.
- **An instrument can declare its own coordinate system.**
  `CanvasCapability.worldSpec` takes `origin` (a fraction of the viewport, so
  `{x:0.5,y:0.5}` is "centred" with no size math) and `yAxis: 'up' | 'down'`.
  `resolveFrame` turns it into a `WorldFrame` that `worldToScreen`,
  `screenToWorld`, `applyCamera`, the wheel anchor and the drop position all
  read, so a non-default world no longer drifts under the wheel. klieg's
  `centred()` layer and its seeded pan can come out.
- **`initialView` may be a function of the viewport size.** The trial's view
  stays `null` until the canvas is first measured, then `CanvasStack`'s new
  `onResize` places it. That retires the "have I centred yet" sentinel; Reset
  nulls it again and re-frames.
- **`RenderContext.trial.visibleLayers`** lists the canvas layers currently
  shown, in declaration order. A legend no longer has to infer the set by
  instrumenting every layer's draw.

- **`TrialLayout`** reaches the root barrel, so klieg no longer reads it off
  `ComponentProps<typeof Workspace>`.
- **Hover hints.** A described config leaf renders an ⓘ beside its label,
  following `PrefsForm`'s tooltip shape. Every leaf already carried a
  `description`; `ControlPanel` was reading only `name`.
- **`lk-property-list__span`.** `PropertyRow` takes `span`, and `PropertySpan`
  wraps a non-row child. wod's hand-typed class name has a route now.
- **The property panel and `LayerStack` moved to `@weasel-js/ui`**, styles
  converted from global `lk-` Less to CSS modules. labkit re-exports both, so
  existing imports resolve. Class names are no longer public: reach in through
  the `className` props.
- **The changesets version bug.** `changeset version` computed `2.0.0-pre.0`
  because `assemble-release-plan@6` promoted a peer dependent to major whenever
  the new version left its peer range, and a prerelease satisfies a range only
  if the range carries a prerelease at the same major.minor.patch. Fixed by
  `@changesets/cli@3`, which deletes that promotion. See "Traps" — the upgrade
  moved the on-disk changeset format.

## Delivered by a release, not by code

klieg is pinned to labkit **1.1.0** while newer versions are published, so it is
missing `useTiledSurface`, `useOrbit`, the opaque trial view and the `job`
capability — features built for klieg and precioussss in the first place. Its
caret already admits them; what pins it is klieg's lockfile. `npm update
@weasel-js/labkit` in `~/src/klieg`.

klieg also deferred `FloatingPanel` and `Legend` upstream and grew
`LegendPanel.tsx` with a locally-declared `LegendEntry`. Both exist on `main`
now; that local copy can come out.

## Asked for by two projects

**Config-field vocabulary** — the tuning-rail spec, wanted by klieg's tube lab
and precioussss's gem bench:

- `commit: 'end'` on sliders. klieg bypasses `SliderRow` for weasel-ui's
  `Slider` entirely to get it; `precioussss/apps/lab/src/gemBench.tsx:50` has a
  comment claiming behaviour that does not exist.
- Snap-to-stops, lens binding, inert-with-a-reason, computed bounds — filed in
  `packages/labkit/docs/IDEAS.md`.
- Nested paths. `ResolvedConfig.group` is documented flat, so sherpa cannot
  declare `fire.hold` and it stays uneditable (`sherpa/TODO.md:96`). Already in
  `docs/TODO.md`; sherpa is the second asker.

**List controls.** sherpa needs a recursive tree — `LayerList` is flat, so it
hand-rolled `StepTree.tsx`. wod cannot use `LayerStack` because `kind`,
`paletteKinds` and `onAdd` are required and its segments have no kind
(`wod/docs/superpowers/specs/2026-07-30-wod-editor-design.md:229`). wod also
wants a multi-control grid row and a multi-select row.

## Still open

- `FloatingPanel` is pointer-only — no keyboard move (`windease/TODO.md:349`).
  Deliberately skipped; Mike does not want it yet.
- **Bare mounting has no supported path.** `.lk-root` carries labkit's whole
  style scope — tokens, fonts, the box-sizing reset, every element default under
  `:where(.lk-root)` — and `LabShell` is the only thing that applies it. klieg
  renders `Workspace` bare (`tube-lab/src/App.tsx:562`) and sherpa renders
  `ControlPanel` bare (`apps/studio/src/panes/Inspector.tsx:44,50`), both
  deliberately, both working around the missing token root from their own
  stylesheets. labkit's own Storybook hand-rolls the contract at
  `.storybook/preview.tsx:275` to mount ~28 stories. A `LabkitRoot` mount
  component was designed and rejected; the moves above shrink the problem
  without solving it.
- **wod has three reach-ins to fix in its own repo**, all broken by the class
  names going private: `Editor.css:172` (`.lk-property-panel`) and anything
  styling `.lk-layer-card` become `className` props;
  `BreakpointPanel.tsx:77` becomes `<PropertySpan>`.

## Traps

**`zoomAt` from `@weasel-js/core` cannot drive a y-up canvas.** It looked like
the obvious way to stop labkit reimplementing fixed-point zoom — core's `View`
carries per-axis scale, so y-up is just `scale.y < 0`. But its clamp is
`min(max, max(min, scale * factor))` per axis against positive defaults, so a
y-up view comes back at `+0.1`: axis flipped, zoom collapsed, silently. labkit's
`usePanZoom` keeps its own arithmetic for this reason. Filed against core in
`docs/TODO.md`.

**Changesets 3.x migrates the pre-mode store on read.** A consumed changeset
moves from a name in `pre.json`'s `changesets` array to a file under
`.changeset/pre/`, and `pre.json` shrinks to `{mode, tag}`. Any command triggers
it, including `changeset status`. It looks exactly like something deleted every
changeset. It did not. `check:bumps` scans both directories for this reason.

**The consumer smoke test cannot tell a quoted import from a real one.** It greps
labkit's `dist` for `from "@weasel-js/…"`, so a warning string spelling out an
import statement fails it. That broke CI once and was reintroduced once by a
merge taking a file wholesale.

**labkit bundles its siblings** (`tsup.config.ts`, `noExternal`), so a source
edit in `packages/text` does not reach labkit's bundle until the whole workspace
is rebuilt. A smoke test run before that reports the previous build's result.

**A test file that passes alone and fails in a full run is measuring uptime, not
your change.** `SceneCanvas.animatedZoom.test.tsx` did this; bisecting with one
file in isolation at one end and the full suite at the other produced a clean,
entirely false "both parents green, merge red". Use one probe across the range.

**npm's web auth needs a TTY.** Neither the Bash tool nor a `!`-prefixed command
is one, so `npm login` and a 2FA `npm publish` print their URL and exit non-zero.

**A registry `GET` can 404 for minutes after a `PUT 200`** — and changesets can
report a publish that never happened. 1.3.0-pre.0 reported all sixteen packages
published while `gestures` and `audio` never reached the registry. Check the
registry directly, not the run log.
