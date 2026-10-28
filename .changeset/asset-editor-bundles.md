---
'@weasel-js/ui': patch
---

The asset editor has a Bundles asset, for rearranging how feature presets group their actions, tools, and atoms. `bundlesAsset(id, label, describePresets(…))` makes one: a section per package, a group per bundle, a leaf for each action, tool, and atom a bundle names, and a link for each bundle it includes. The asset list files it under a heading of its own, Bundles, after Menus.

Actions, tools, and atoms are dragged in from a Parts list in the shelf, which says which bundles already hold each. An atom is one locked row: it moves, and its attributes only show what it holds. A bundle that includes itself is marked `cycle`, and an id two bundles name where one bundle loads both is marked `twice`; neither is refused. The preview lists what a canvas loading the selected bundle gets.

The export tab shows a `weasel-bundles/1` JSON document in place of a TypeScript literal, and Submit sends it: a hash of the descriptions the editor opened on, every bundle of each package that changed, and the edits (`create`, `remove`, `rename`, `move`, `include`, `exclude`) for an agent to apply to the preset source. `SentAsset.literal` holds that document for a Bundles asset. This adds API.
