---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` lets a page nest: dragged over a rail entry in the live preview it drops into that entry's group from the middle and beside it from either end, as a tab, panel, or section does. `prefDropTargetAt` takes no options again; its `railInto` was only ever in an unreleased build.

A new `maxDepth` prop caps how many levels of groups the schema may nest. A drag in the tree or the preview, a palette drop, or Add group that would nest deeper is refused. It defaults to 2.
