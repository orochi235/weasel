# Ideas

Forward-looking ideas not yet planned. Promote to a dated spec in
`docs/superpowers/specs/` when ready to design.

## Promoted, 2026-08-22

Five ideas moved to specs. Implementation order is the order below — the
versioned document has to exist before the rename can migrate onto it, and
the rename settles the vocabulary the rest are written in.

- **One versioned lab document** —
  `superpowers/specs/2026-08-22-versioned-lab-document-design.md`
- **Vocabulary refresh: Lab / Experiment / Workspace / Trial** —
  `superpowers/specs/2026-08-22-vocabulary-refresh-design.md`
- **What a tuning rail needs from `ConfigField`** —
  `superpowers/specs/2026-08-22-tuning-rail-design.md`
- **Panels over one surface** —
  `superpowers/specs/2026-08-22-surface-scheduler-design.md`
- **labkit's canvas on SceneCanvas** —
  `superpowers/specs/2026-08-22-canvas-on-scenecanvas-design.md`

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

A scratch slider wants `hint` and commit-at-drag-end exactly as much as a
permanent one, so this sits on the tuning-rail spec rather than beside it.

## Sweep

A structured set of trials produced from a parameter range or a recipe.
Named here so the word stays reserved; nothing designed yet.
