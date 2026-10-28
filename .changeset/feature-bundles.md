---
'@weasel-js/core': patch
---

Core's feature presets are split into small ones, and every name `<SceneCanvas features>` takes is now a preset of its own. `edit` includes `escape`, `contextMenu`, `selectAll`, `duplicate`, `delete`, `group`, `nudge`, `style`, and `clipboard`; `arrange` includes `flip`, `reorder`, `align`, and `distribute`; `paths` includes `anchorKeys`, `pathfinder`, `outlines`, `pathEdit`, and `pathCommands`. Each tool set has a preset (`tools:select`, `tools:view`, `tools:shape`, `tools:draw`, `tools:type`, `tools:page`), and `pick`, `transform`, and `draw` are presets that include others. Any of these names can be passed on its own, so `features={['nudge', 'tools:shape']}` turns on just the arrow keys and the shape tools.

This breaks: `COMPOSITE_FEATURES`, `BaseFeature`, and `CompositeFeature` are removed, `NamedPresets` is a plain map of id to preset, and `FEATURE_ACTION_IDS` lists each preset's own actions without those of the presets it includes. `select` now mounts the lasso tool beside the select tool, through `tools:select`.

`FeaturePreset` takes an optional `label`, and `describePresets` describes presets as data: each one's own action and tool ids, the presets it includes, the package that ships it, and whether it is an atom, one with a role beyond actions, tools, and includes. This adds API.
