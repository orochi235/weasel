# Ideas

Forward-looking ideas not yet planned. Promote to a dated spec in
`docs/superpowers/specs/` when ready to design.

## Promoted, 2026-08-22

Four ideas moved to specs. Implementation order is the order below — the
versioned document has to exist before the rename can migrate onto it, and
the rename settles the vocabulary the other two are written in.

- **One versioned lab document** —
  `superpowers/specs/2026-08-22-versioned-lab-document-design.md`
- **Vocabulary refresh: Lab / Experiment / Workspace / Trial** —
  `superpowers/specs/2026-08-22-vocabulary-refresh-design.md`
- **What a tuning rail needs from `ConfigField`** —
  `superpowers/specs/2026-08-22-tuning-rail-design.md`
- **Panels over one surface** —
  `superpowers/specs/2026-08-22-surface-scheduler-design.md`

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

## `initialView.pan` is in screen pixels an instrument cannot know

With 1.1 applying the camera before `draw`, a layer draws in world coordinates — which is the right
contract, and immediately raises the question of where world origin should sit. `pan` is a screen
offset, so `{ x: 0, y: 0 }` puts world origin at the top-left corner of the trial. Anything that
wants its subject centred has to know the viewport size, and an instrument is written long before
that exists. `RenderContext.workspace` exposes `zoom` and `setZoom` but no pan, so it cannot correct
this after mount either.

The klieg corner lab works around it by translating each layer by half the canvas divided by zoom,
which is the camera's job leaking back into the instrument, and which quietly fights zoom-about-
cursor. What is missing is a way to say "centre on this" — either an `initialView` that accepts
`{ center: Point }` as an alternative to `pan`, or a `fitTo(bounds)` on the render context so an
instrument whose subject changes (a different corner, a different letter) can recentre as it goes.
