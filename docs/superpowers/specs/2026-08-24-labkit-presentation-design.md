# labkit presentation pass — design

**What this is:** the design for what a consumer sees when they mount `<Lab>` and pass no
slots. Today that default is unfinished, and labkit is going into enough places that the
default is what most people will ever see.

**Who it's for:** whoever implements the three arcs below. Assumes familiarity with labkit's
trial/instrument runtime and with `@weasel-js/ui`.

**What it decides:** an icon register and its vocabulary, where the visual language lives,
and what the default chrome renders.

---

## The shape of it

The visual language lives in **`@weasel-js/ui`**. labkit inherits it and adds nothing of its
own beyond lab-specific composition. `ui` depends on `core`, so `ui` can re-export core's 14
tool glyphs and give consumers one import site; the reverse direction is impossible and no
future arrangement should attempt it.

Four arcs, each with its own plan:

1. **Icon set** in `@weasel-js/ui` — the register, then the vocabulary.
2. **Default chrome** in labkit, rebuilt on that set.
3. **Chrome regions** — one mechanism placing what a trial declares.
4. **Visual language pass** across labkit's primitives so they read as one system.

---

## Arc 1 — the icon set

### Register

Every glyph obeys all four:

- **20×20 viewBox**, live area 2–18, `fill="none"`, `stroke="currentColor"`,
  `stroke-width="1.5"`, round caps and joins. A `size` prop scales; nothing else varies.
- **Hairline (`stroke-width="1"`) marks structure, never decoration.** A slide's label rules
  and a tray's fill line qualify. A tick added for flavor does not — one added to `reset`
  turned the glyph into the IEC power symbol.
- **Filled regions only where the action has a subject** — clone's front slide, align's axis
  bar, boolean's result shape. This is the convention core and `apps/draw/src/actionIcons.tsx`
  already follow, so nothing already shipped is redrawn.
- **Terminus geometry is computed, not placed by eye.** An arc `M x y A rx ry rot laf sf dx dy`
  ends at `(x+dx, y+dy)` and an arrowhead capping it puts its vertex exactly there. A handle
  meeting a rim solves for the point on the circle.
- **Match optical mass, not bounding box.** A plus drawn to the full live area dwarfs a circle
  drawn to the same extent. Cross-shaped glyphs pull in to roughly ±5.2; discs and squares run
  to the r=8 keyline; open bracket frames may reach 3.2–16.8 because they read smaller than
  they measure. Proof a batch together and correct against its neighbors, never alone.

Arrowheads are open Vs whose barbs are `2·L·sin(spread)` apart. Below roughly
`stroke + 1.6` that gap closes under the round joins and the V renders as a solid triangle —
wrong for an outlined register, and invisible at chrome size. The drawing helper asserts it.

`CLAUDE.md` carries the proofing rule this register was derived under: author and inspect at
240–320px, and render small only afterward as a legibility check.

### Vocabulary

Roughly forty glyphs, drawn and proofed in batches by group:

| Group | Glyphs |
|---|---|
| Transport | play, pause, step, stop |
| History | undo, redo |
| View | pan, zoom-in, zoom-out, fit, actual-size, fullscreen, crosshair |
| Trial lifecycle | add, clone, reset, close, delete, snapshot, export, compare |
| Collection | sort, filter, search, remove, layers |
| State | lock, unlock, visible, hidden, pin, link, collapse, expand |
| Instrument | tune, grid, snap, measure, randomize, refresh |
| Status | info, warning, error, busy |

**`save` splits in two.** labkit's toolbar "Save" means *snapshot this trial's state*, which a
tray-and-down-arrow does not say — that glyph reads as download. Export keeps the tray;
snapshot gets a shutter.

## Arc 2 — the default chrome

`<Lab>` with no slots must be a complete, usable lab. It currently is not.

**The lab cannot grow.** `addTrial` and `setMode` are on `LabContext` with no UI anywhere;
`LabShell`'s header is bare `{children}`, so every consumer rebuilds the same two controls.
The default header gains an add-trial control and a mode toggle.

**A trial has no identity.** The instrument name appears only as the sidebar's heading and
again in the status bar, so four clones of one instrument are indistinguishable. Trials get a
header carrying a name and the drag grip — which today is a 14px rail holding nothing else.

**The sidebar renders the wrong control system.** `DefaultSidebar` renders `ControlPanel`,
which hand-rolls `<input type=range|checkbox|color|text>` and `<select>`; the OS-blue checkbox
and color swatch fight the theme, and readouts float at a ragged right. `ui/properties`
(`PropertyPanel` and its rows) is themed, aligned, and already built. The default routes
through it.

This makes `@weasel-js/labkit/weasel-ui` load-bearing on every lab. That path is a published
export whose runtime dependency `@weasel-js/ui` is declared only as a `devDependency` — a
clean install gets an unresolvable specifier. Promote it to a real dependency and cover the
export path in the consumer smoke test.

**The toolbar is nine undifferentiated text buttons.** `Close` discards work and looks exactly
like `Clone`; `Toolbar.Spacer` sits between every group so they collapse into one gap and
`Save` strands itself at the far left. Icons plus label, grouped by kind, destructive action
separated and reddening on hover.

**Job status is ad-hoc markup** inside `TrialChrome` — a bare `3 / 10`, no progress element,
no indeterminate state, no dismiss on error. It becomes a primitive.

### Defects to fix in passing

- `.lk-trial__content` has no padding; instrument content starts at x=0, y=0.
- `.lk-trial__sidebar` doesn't fill its column and has no border against the content, so the
  layout reads as broken.
- `Trial.less` names `--wsl-color-danger`; the token is `--wzl-`, so job errors always fall
  through to a hardcoded hex.
- `TrialChrome`'s Cmd+Z / Cmd+S handler is on a `<section>` with no `tabIndex`, so it fires
  only when focus is already inside the trial — which clicking a canvas does not do.
- Default snapshot names are `new Date().toLocaleString()`.

## Arc 3 — chrome regions

The two areas labkit does not define at all — a **tool palette** and the **sidebar** as a real
surface — plus the **viewport controls** that have nowhere of their own. All three turn out to
be one problem: labkit has three half-built mechanisms for routing a declaration to chrome and
no single one. Specified in `2026-08-25-labkit-chrome-regions-design.md`.

## Arc 4 — visual language

A density, spacing and type-scale pass over `Toolbar`, `Sidebar`, `StatusBar`, `FpsMeter`,
`ScaleIndicator` and `PropertyPanel` so they read as one system. The status bar sets monospace
against the display font used everywhere else, and the trial border and radius are nearly
invisible against the workspace. It follows arc 3 rather than preceding it: restyling the chrome
before the regions settle means restyling it twice.

---

## Out of scope

The tuning rail (`hint` / `commit` / `inert` / `bounds` on `ConfigFieldBase`, and lens binding)
is its own arc, specified in
`packages/labkit/docs/superpowers/specs/2026-08-22-tuning-rail-design.md`. Arc 2 overlaps it at
exactly one point — moving the default sidebar onto `ui` controls, which that spec lists first
and which this one depends on. Do it once.
