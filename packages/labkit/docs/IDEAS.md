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
