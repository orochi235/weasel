---
"@weasel-js/core": minor
---

Extract the typography layer into `@weasel-js/text`, and the paint vocabulary
into `@weasel-js/paint` — two new Tier A leaves.

`@weasel-js/text` owns the run model, style resolution, `layoutRuns`, wrap and
measurement. It depends on `@weasel-js/font`, `@weasel-js/geom` and
`@weasel-js/paint`, and on nothing else: a consumer with its own renderer can
lay out text without taking the scene graph or a React peer dependency.
`layoutRuns` is now public — it was previously reachable only from inside core.

`@weasel-js/paint` holds `FillStyle`, `Stroke`, gradients, dashes and
`TextureHandle`. It was the blocker named in the 2026-07-28 font split: the
layout could not move while its fill type lived in the renderer's graph.

`@weasel-js/core` re-exports both surfaces, so its own API is unchanged.
`Rect` moves to `@weasel-js/geom`, beside `Box`.

Breaking for anyone importing these through core's internal paths rather than
its public entry (`core/paint-types`, `features/text/*`); those paths are gone.

Advances and kerning still come from a baked MSDF atlas — laying out from font
bytes alone needs the metrics seam in
`docs/superpowers/specs/2026-08-28-text-package-extraction-design.md`.

<!-- bump-approved: minor: Mike — two new published packages (@weasel-js/text, @weasel-js/paint) and layoutRuns promoted to public API, on top of ~50 patch changesets carrying new public surface across core, ui and labkit; called explicitly in conversation on 2026-08-29: "tag a minor release and push" -->
