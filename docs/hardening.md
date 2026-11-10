# Hardening

This file records weasel's hardening passes: work that goes looking for bugs in one package at a
time, as opposed to bugs fixed because someone reported them. Read it before picking the next
package to harden. Add a row whenever a pass merges.

## Practices

| Practice | Where it runs | Files |
|---|---|---|
| Property tests (fast-check): round-trips, laws, metamorphic rules | locally; deep runs (10,000+) on the fleet | `*.pbt.test.ts` beside the code |
| Stateful model tests (`fc.commands`): random op sequences checked after every step | same | `*.pbt.test.ts` |
| Unicode conformance files | locally | `packages/bidi`, `packages/text` |
| Audit rounds: agent review lanes, one per area | agents | `node scripts/audit-yield.mjs` counts fix commits per round and lane |

Not yet adopted: mutation testing (Stryker, on the fleet), coverage-guided fuzzing of parsers, and
pairs of blind reviewers per lane, whose overlap estimates how many bugs remain.

Each failure a property finds is fixed in the same pass. Its shrunk counterexample stays beside the
property as a plain example test, and any behavior it raises a question about goes to
`docs/unruled.md`.

## Record

A row is one pass over one package. "Bugs" counts real defects, not the model's or the test's own
mistakes. "Quiet" means properties that found nothing but caught a bug planted to check them.

| Date | Package | Practice | Properties | Bugs found / fixed | Notes |
|---|---|---|---|---|---|
| 2026-11-09 | geom | property | 33 | 2 / 2 | Non-finite translation in 2D `invert` (aaeec8df6). Path booleans threw near a rect corner, found only at 10,000 runs (8c4c266a9). The path `d` property caught a planted T-reflection bug. |
| 2026-11-09 | history | stateful | 1 | 0 / 0 | The engine on its own: push, coalesce, evict, goto, clear, seal, serialize, journals. |
| 2026-11-09 | core | stateful | 1 | 2 / 2 | Scene ops through history, with the real group/ungroup actions. Found Ungroup and Delete throwing over a locked descendant, and Ungroup deleting through a dependency on the group it dissolves. Ruled 2026-11-09: Ungroup, Delete, and Cut are disabled (`ActionDisabledReason.Locked`) while a node they would move, rewrite, or remove is locked; Ungroup drops the dissolved group from every dependent's `dependsOn`, so it removes only the group. Fixed in b80eae401 and 1b0254ddf; examples in `defaults/ungroup.shrunk.test.ts`. |
| 2026-11-10 | svg | property | 8 | 1 / 1 | Transform lists, the importer fuzzed with arbitrary text and attribute values, and what each leaf draws kept through parse and through the kit's drafts. A shape past float32's range was stored with `NaN` coordinates; it is now dropped with a warning (57e12cbbe). |
| 2026-11-10 | path-tools | stateful, property | 3 | 6 / 6 | The reshape actions on a real scene, and the handle locks. Ruled 2026-11-10: an edit action that would change nothing is disabled (`NotApplicable`); selection commands are exempt as a category. Three bugs it named: `deleteAnchors` (core) on a two-anchor line, `constrainAnchors` on one anchor, `unconstrainAnchors` with none to remove. Three more by the same rule: `setCorners` without params, and the nudges (core) and `reversePath` over a selection an undo left naming no anchor. Fixed in e9132915a; examples in `reshape.shrunk.test.ts`. |
| 2026-11-10 | paint | property | 84 | 4 / 4 | CSS color forms read, fuzzed, and written back; OKLab, OKLCh, HSL, and the transfer curve round-tripped (every byte through OKLab returns itself); hue arcs, mixes, contrast, gradient sampling and kind changes, paint and stroke lerps, `paintKey` and `strokeKey` against what draws, palette refs against a plain model, dash phases, pattern transforms, and vertex widths. `hslToSrgb` misread a hue past one turn, and `srgbToHsl` answered an infinite saturation near white (458e1c247, a1444f969). `lerpPaint` and `lerpStroke` missed `b` by an ulp at `t = 1` (6321d2a68). `dashPhase` answered the cycle itself for a phase just below 0 (c2465cd55). Examples sit beside each property. HSL moved to its own `hsl.ts` (d524fe0d4). |
