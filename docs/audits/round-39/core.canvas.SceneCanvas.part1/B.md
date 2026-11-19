# Audit round 39 — core.canvas.SceneCanvas.part1

## isAtom ignores the node-kind roles, so a preset carrying only routing, shapes, properties or insert factories is described as a bundle
- where: packages/core/src/canvas/SceneCanvas/describePresets.ts:6 (ATOM_ROLES / isAtom)
- scenario: a preset `{ id: 'k', shapes: [...], routing: [...], properties: [...] }` (the node-kind roles added in 68d5da4a1e), or one with `insertNodeFactories`/`insertKinds`/`toolActions` only, gets `atom: false` from `describePresets`. features.ts defines an atom as a preset holding "any other role" than actions, tools and includes, and these roles only work together. The prefs-editor bundle checks (`bundleChecks`, `BundlePreview`) then treat it as pure grouping, e.g. flagging/flattening it like a bundle. `satisfies readonly (keyof FeaturePreset)[]` does not enforce completeness, so each new role silently drops out.
- evidence: read
- severity: low
