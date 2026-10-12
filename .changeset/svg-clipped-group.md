---
'@weasel-js/svg': patch
---

Fixes: a `<g clip-path>` unpacked into the scene unclipped. A scene container clips to what its painter draws, so `svgNodesToKitDrafts` now gives a clipped group's container the clip as an unpainted path, `data: { path, fill: null }`, and the clip's box as its pose where an unclipped one takes its children's. `unpackSvgFiles` inserts the container with that data, and `svgNodesFromKit` writes a container holding a path back as a group with that `clip`.

Breaking: a container `SvgSceneDraft` now has a `data` field, `{}` when the group is not clipped. A caller building scene nodes from drafts adds each container with `draft.data` where it wrote `{}`.

Carrying the clip as the container's own path, and boxing a clipped container by its clip, were an agent's judgment.
