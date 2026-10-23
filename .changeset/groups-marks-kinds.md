---
'@weasel-js/core': patch
'@weasel-js/d3': patch
'@weasel-js/devtools': patch
'@weasel-js/diagram': patch
'@weasel-js/diagram-formats': patch
'@weasel-js/guides': patch
'@weasel-js/kernel3d': patch
'@weasel-js/labkit': patch
'@weasel-js/minimap': patch
'@weasel-js/path-tools': patch
'@weasel-js/quantity': patch
'@weasel-js/rig': patch
'@weasel-js/svg': patch
'@weasel-js/symmetry': patch
'@weasel-js/ui': patch
---

Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `specsFromSerialized` says otherwise.
