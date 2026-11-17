# Audit round 29

Blind pairs at `f10daafb87` (2026-11-16), run by hand from one session before `scripts/audit-night` existed.
Each area's two reviewers read the frozen tree alone and reported without fixing (`<area>-A.md`,
`<area>-B.md`, under `reviewer-brief.md`); one fixer per area then reproduced each distinct finding with a
failing test and fixed it (`fixer-brief.md`). The method is `docs/hardening.md`, "Blind pairs".

**Not a baseline.** The reviewers were given an area, not a fixed file list, and read different files, so
these estimates are rough guesses and nothing tests them later.

| Area | Packages | A | B | Shared | Distinct | Est. | Fixed | Fixer branch |
|---|---|---:|---:|---:|---:|---:|---:|---|
| core | core, history, registry, react, storage, kernel3d | 7 | 7 | 1 | 13 | 31 | 13 | `audit29-core` |
| output | renderer, paint, paint-kinds, svg, pdf, export, font | 5 | 7 | 2 | 10 | 15 | 10 | `audit29-output` |
| text | text, text-shaping, text-dom, text-tools, bidi, quantity | 7 | 5 | 2 | 10 | 15 | 10 | `audit29-text` |
| lab | labkit, forge, apps/forge | 8 | 13 | 4 | 17 | 24 | 16 | `audit29-lab` |

Shared findings, as the controller matched them:

- core: `addPage` with an id the document already has.
- output: the paint-kind loader cache keyed by id; the `mesh-gradient` loader not pushed as a fallback.
- text: a shaper or bidi engine registered twice; shrink-to-fit keeping a scale across an engine change.
- lab: camera and mark-store registries warning on stacking; lab chords matching by physical key; Copy
  settings as JSON copying stale values; forge's frame scroll table never pruned.

Counts in "Fixed" include fixes for the same mistake found elsewhere in the area. The lab fixer counted 16
distinct where the controller counted 17, folding two owner-lookup findings into one fix. Extra defects
found while fixing: core's `dependsOn` and layer `parallax` shared by reference; paint's `parsesAsColor`
accepting `}` and `;`.
