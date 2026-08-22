# Ideas

Forward-looking ideas not yet planned. Promote to a dated spec in
`docs/superpowers/specs/` when ready to design.

## Vocabulary refresh: Lab / Experiment / Workspace / Trial

The current naming conflates levels. Proposed model:

- **Lab** — class. The codebase definition of a lab (e.g. Drag Lab, Weasel
  Lab). Lives in the repo.
- **Experiment** — instance. One user's persisted session of a Lab — what
  lives under a `storageKey`. Analogous to a file in Illustrator: open it,
  edit it, save it.
- **Workspace** — the area inside an experiment in which trials are laid
  out (today's `WorkspaceGrid`). One workspace per experiment.
- **Trial** — one tile/window inside the workspace: an instance of the
  instrument with its own state, config, view, undo stack. Today this is
  what the code calls "Workspace" — confusing, since the *area* and the
  *tile* share a name.

Naming consequences if we adopt this:

- `useExperimentState` is currently per-workspace-tile, not per-experiment.
  Rename to `useTrialState`.
- Existing `Workspace`/`WorkspaceRecord`/`WorkspaceGrid` types either get
  renamed (`Trial`/`TrialRecord` + `Workspace` for the grid container) or
  the grid container gets a new name like `TrialGrid` and `Workspace`
  becomes the experiment-area concept.
- Side-by-side tiling reads naturally: "two trials of the same experiment."

Related concept worth naming later if it ships: a **Sweep** (or Sequence)
— a structured set of trials produced from a parameter range or recipe.

## Permanent and temporary controls

Labs should support two layers of controls in the sidebar:

- **Permanent (base) controls** declared by the instrument's `configSchema`
  (or composed PropertyPanel/Row tree) — always present, persisted across
  sessions, part of the instrument's identity.
- **Temporary (scratch) controls** added at runtime for a specific
  trial or debugging session. Can be added and removed freely without
  touching the instrument definition. Useful for "I want a slider for this
  one constant while I tune it" without having to commit the slider to the
  instrument permanently.

Open questions:

- How do temporary controls bind state? A scratch namespace next to
  `config`, or a generic `useScratchValue('name', default)` hook the lab
  body can call?
- Do temporary controls survive page reload? Probably opt-in per scratch
  key — most should be ephemeral.
- UX: visually distinct (dotted border? scratch section header?) so it's
  obvious which ones are real vs throwaway.
- Promotion path: once a scratch slider proves its worth, is there a
  one-action "promote to permanent" that emits the diff to add it to the
  instrument's schema?

## Panels over one GPU context

`WorkspaceGrid` gives every tile its own DOM subtree, and `CanvasStack` gives
one container a stack of 2D canvases. Neither shape fits a lab whose tiles are
GPU-rendered: klieg's tube lab draws sixteen panels from a *single*
`WebGLRenderer`, one scissor rect per panel, because sixteen canvases would
exhaust the browser's WebGL context budget. It also sets
`preserveDrawingBuffer` — a redraw there is usually one dirty panel, and the
default framebuffer's contents are undefined after the page composites, so the
other fifteen would go black on every partial draw.

What labkit would need to host that:

- Tiles publish their screen rects to one host surface behind the grid, rather
  than owning a canvas each.
- Per-tile dirty marking, with a scheduler that coalesces a burst of
  invalidations into one frame. `useLayerScheduler` is the right shape; it
  needs a surface concept rather than a canvas per layer.
- Rect and DPR changes delivered to the surface owner, so it resizes once.

Open questions:

- Does DOM chrome (labels, badges, hover hints) compose over the shared
  surface, or does the surface own its own overlay layer?
- Pointer events land on the DOM tile but the pixels belong to the surface —
  does the tile hit-test and forward, or does the surface read the tile's rect?
- Is this one primitive with a 2D and a WebGL backend, or does labkit stay
  backend-agnostic and only own rects, dirtiness and scheduling?

## What a tuning rail needs from ConfigField

`ConfigField` covers a settings form. A rail you tune a renderer with wants six
things it doesn't have, each of which klieg's tube lab hand-rolled in a
653-line `Rail.tsx`:

- **`hint` per field.** Every control in that rail carries hover text saying
  what it does *and what it interacts with badly*. It is the fastest way back
  into a model you left a week ago.
- **`onCommit` separate from `onChange`.** A spec change there rebuilds all
  sixteen panels: 1.45 s front-only, 2.85 s with back, wall and connectors.
  Sliders commit on release so a drag costs one rebuild rather than twenty.
  `debounceMs` is the wrong shape for this — the need is "fire at drag end",
  not "fire less often".
- **`stops`.** Detents the drag catches where a value marks a real boundary.
- **Lens binding.** Keys are flat `keyof TC`, but a real spec is nested
  (`select.amount`, `corners.break`) and one control can map to two model
  values — that rail's corner slider writes a break/connect *ratio*. Fields
  want `get(model)` and `set(model, value)`.
- **Inert with a reason.** Two of that rail's controls do nothing under either
  shipped look, both being front-only, and one gradient domain is inert for the
  same reason. Today that is prose in a hint; it should be a state the panel
  renders.
- **Computed bounds.** One field there is pinned between a count below and a
  minimum above — at one setting it is pinned across its whole range. A field
  should be able to declare a derived min/max and show when it has no room.

The first two are what make a rail usable at all; the rest are what stop it
lying about what it controls. See also "Permanent and temporary controls"
above — a scratch slider wants `hint` and `onCommit` exactly as much.

## One snapshot for layout and experiment state

The tube lab persists `{layout, letters, spec, look}` under a single
`localStorage` key, where `layout` is a serialized window-manager store and the
rest is experiment state. It already carries an unversioned back-compat branch
("absent in saves written before the rail had a look picker") — a migration
waiting to be formalized.

So: one snapshot spanning layout and experiment state, with a version and a
migration hook, composed into the existing adapters. Through `urlHashAdapter`
that also makes a lab state a link you can paste at someone, which is the
cheapest possible bug report for a visual tool.
