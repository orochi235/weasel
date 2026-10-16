---
'@weasel-js/core': patch
---

`<SceneCanvas features>` takes `FeaturePreset` objects beside core's names. A preset carries the standard actions it registers, the tools it mounts (built-in ids or tools of its own), its ambient bindings, the selection chrome it owns, contributions installed beside `ambient`, the presets it `includes`, and the presets it `refines`, whose actions its own register ahead of. Core's names each stand for an exported preset (`viewPreset`, `selectPreset`, `outlinePreset`, `movePreset`, `resizePreset`, `rotatePreset`, `editPreset`, `arrangePreset`, `pathsPreset`, `ingestPreset`), so a package ships behavior the same way core does and an app opts in by import. `<LeanSceneCanvas>` takes preset objects only and resolves no names, so an app's bundle holds only the presets it imports: a canvas with `selectPreset` alone no longer carries the pathfinder, outline, path-command, and ingest actions. `useStandardActions` takes an `actions` list, defaulting to every kit-standard action. Additive.

Changes behavior: standard actions register preset by preset (a preset after the ones it refines) rather than in one fixed list, so `ActionsRegistry.list()` orders them differently; anchor nudging and deleting still go ahead of their node-level twins, since `paths` refines `edit`. `KIT_STANDARD_ACTION_IDS` lists them in the new order.
