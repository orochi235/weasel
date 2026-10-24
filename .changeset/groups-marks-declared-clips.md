---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
'@weasel-js/diagram-formats': patch
'@weasel-js/svg': patch
'@weasel-js/symmetry': patch
---

A node clips its children only when it declares a clip. Breaking: a group no longer clips its children to its outline by default, and nothing else does either. A node clips to its `clipFromPose` when it has one, or to its own outline when it sets the new `clip: 'outline'` field: a mark's painter silhouette, or for a group the silhouette of its `data.path`. `clip` is saved and loaded, copied, pasted and undone like the node's other fields, and `NodeClip` names its type. Scenes saved at version 1 keep their look: a version 1 container with no clip function loads with `clip: 'outline'`.

- `clipNothing` is no longer needed and stays registered only so saves naming it still load. Diagram bodies and symmetry groups no longer set it, and `@weasel-js/diagram`'s `BodyNodeSpec` drops its `clipFromPose` field. `SYMMETRY_CLIP_KEY` stays in `symmetryRegistry` for the same reason. Baking a symmetry group keeps a copied group's declared clip.
- `@weasel-js/svg`: an imported `<g clip-path>` is a group with `clip: 'outline'` (`SvgSceneDraft` carries `clip` on a group), and the export writes a group's clip only when it declares one; a group holding `data.path` without `clip` exports unclipped. A mark with children now exports as a `<g>` holding its own element and then its children, which were left out before; a mark's declared clip and copies apply to its children only. `SvgKitTreeNode` takes `clip`.
- `@weasel-js/diagram-formats`: a page export writes a diagram box as its outline followed by its rows, with no special case for diagram nodes.
- `specsFromSerialized` is exported from `@weasel-js/core`, with `SpecsFromSerializedOptions`. Its new `unknownKeys: 'skip'` option loads a node whose registry key is unknown without that function instead of throwing.
