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

klieg has since moved to 1.3.0 with all four `@weasel-js` packages pinned
together, so `useTiledSurface`, `useOrbit`, the opaque trial view and the `job`
capability all reach it now. Kept as the shape of the problem rather than a live
one: features built for a consumer do not reach it until its lockfile moves, and
a report of "labkit cannot do X" from a pinned consumer is a lockfile question
first.

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
- Collapsible sections. `SectionSpec` groups leaves under a heading but has no
  disclosure, so brick-icons' 38 flags in seven sections is still one long
  scroll. `SidebarSection` already has `defaultCollapsed`; `SectionSpec` wants
  the same, remembering its state per trial. brick-icons is the third asker on
  this family.
- Nested paths. `ResolvedConfig.group` is documented flat, so sherpa cannot
  declare `fire.hold` and it stays uneditable (`sherpa/TODO.md:96`). Already in
  `docs/TODO.md`; sherpa is the second asker.

**List controls.** sherpa needs a recursive tree — `LayerList` is flat, so it
hand-rolled `StepTree.tsx`. wod cannot use `LayerStack` because `kind`,
`paletteKinds` and `onAdd` are required and its segments have no kind
(`wod/docs/superpowers/specs/2026-07-30-wod-editor-design.md:229`). wod also
wants a multi-control grid row and a multi-select row.

## Asked for by brick-icons

A ~1500-line consumer app (a workspace of trials, each rendering one LEGO part
through two engines) built against 1.3.0. Each item is a workaround it is
currently carrying.

- **`addTrial` takes only an instrument name**, so opening a trial _on a given
  subject_ has nowhere to put the subject. The app passes it through a
  module-level one-slot box that `defaultConfig()` reads and clears, which works
  only because `addTrial` calls `defaultConfig()` synchronously. Wants
  `addTrial(name, { config })`.
- **A trial's title is the instrument name, with no way to override it.** Every
  trial reads "part-inspector" where the user needs the part. The app hides
  `.lk-trial__title` with CSS and leads with its own `titlebar` contribution.
  Either `title` on the instrument spec or `setTitle` on `TrialChromeContext`
  retires the hack. Note this got _worse_ on 2026-08-31: clone and reset moved
  into `.lk-trial__titlebar-actions`, so three built-in buttons now share that
  span with any consumer contribution in it.
- **There is no leading slot in the title bar.** The only insertion point is
  `.lk-trial__titlebar-actions`, which is right-aligned (`margin-left: auto`),
  so a consumer contribution meant to _lead_ the bar — brick-icons' part title —
  goes right along with the buttons. The app's `flex: 1` override on that span
  is what pulls it back left, and deleting it snaps the title to the right edge;
  it has been tested both ways. A `title` on the instrument spec solves that
  case outright, and a `start` / `end` distinction, or a leading region, is the
  general form. The clone and reset move of 2026-08-31 puts three built-in
  buttons in that span instead of one, which makes the missing leading slot more
  visible.
- **`end: true` does not reach the far edge in the _toolbar_.** The toolbar
  sizes to its content, so an `end` group lands beside its neighbours and the
  app adds `.lk-trial__toolbar { width: 100% }` plus a `flex: 1` spacer. This
  half is a real bug; the title bar half is the leading-slot item above, not an
  `end` failure.
- **`ControlPanel` drops a `.pair()` annotation silently.** The builder offers
  it, `NodeOptions` carries it, and `ControlPanel` renders its leaves into a
  `PropertyList` at a hardcoded `pack="auto-color"` — which by its own docstring
  pairs colour rows and spans everything else full width. So `.pair()` on any
  non-colour kind is inert whatever the renderer does, with nothing to observe.
  Worse than a missing feature: the API accepts the instruction and discards it.
  Either the panel honours `pack`, or `.pair()` should not be on the builder.
- **`ControlPanel` cannot be told to render compactly.** A 38-flag schema draws
  every row at `PropertyRow`'s default `layout="block"` — stacked label over
  control — and `ControlPanelProps` exposes neither `layout` nor `pack`.
  brick-icons worked around it with a `controls` entry per leaf kind that
  re-declares the row as `layout="inline"`, which roughly halved the panel and
  keys by kind so new flags pick it up unnamed. That escape hatch works and it
  is keeping it; the ask is for a `layout`/`pack` passthrough or a `density` on
  the resolved schema, so a schema-driven panel does not have to re-implement
  four rows to be compact.
- **`ToolbarItem.onActivate` is `() => void` with no context**, so a
  contribution declared through `Lab.chrome` cannot call `ctx.saveSnapshot()`.
  Re-declaring a suppressed built-in in a different group therefore means
  dropping to the `render` escape hatch and hand-rolling the button, losing the
  chrome's layout. Wants `onActivate: (ctx: TrialChromeContext) => void`.
- **The README's Usage example is misleading.** It shows
  `<LabShell><Workspace>…</Workspace></LabShell>`, which reads as how to build a
  lab. `<Lab>` renders its own shell, workspace and one `<Trial>` per record and
  puts `children` in the shell header — following the README inside a `<Lab>`
  lays the whole app out as one header item with every trial rendered twice. One
  line saying `<Lab>` owns the shell would have saved the trace.

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
- **`FloatingPanel` swallows a non-native control's click.** `isInteractive`
  guards the drag by element name — `input, button, a, select, textarea,
[data-no-drag]` — so anything else inside a panel gets `setPointerCapture` on
  pointerdown, which retargets mouseup and means the browser synthesizes no
  `click`. A `div role="button"`, a react-aria control that renders a div, or a
  canvas is therefore dead to a real mouse while a programmatic `.click()`
  still works, which is how it hides. The repo's own rule that a clickable
  thing need not be a `<button>` is exactly what the allowlist assumes away.
  Fix is either a designated drag handle or a few-px movement threshold before
  capturing, not more names in the list.

  brick-icons reported this as native `<button>` and `<select>` being dead,
  which does **not** reproduce: that guard shipped in `bb66fe3c` (2026-08-25),
  before the `@weasel-js/labkit@1.3.0` tag it is running. Its second instance —
  its own pane capturing to pan, under an overlay of clickable boxes — is the
  likelier cause of what it saw, and is not labkit's. Filed on the narrower
  gap, which is real.

- **The styleable surface has two prefixes and nothing says so.** DOM classes
  are `lk-*`, design tokens are `--wzl-*`, and a consumer writing
  `var(--lk-border, <fallback>)` gets the fallback on every one — silently, by
  construction, because that is what a `var()` fallback is for. It cost
  brick-icons dark-on-dark panels in the light theme. One line wherever the
  consumer-facing styling contract is written down would retire it; there is no
  such doc today, which is the actual gap.

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
