---
'@weasel-js/diagram-formats': major
---

Diagram JSON writes version 2, which names a graph page's boxes `clusters` and its grid's per-box columns `clusterColumns`.

Version 1 files still read, with `groups` and `groupColumns` taken as the new names. A reader from before this release refuses a version 2 file.

```json
// before
{ "format": "weasel-diagram", "version": 1, "pages": [{ "kind": "graph", "data": { "groups": [] } }] }
// after
{ "format": "weasel-diagram", "version": 2, "pages": [{ "kind": "graph", "data": { "clusters": [] } }] }
```

<!-- entry: breaking data -->
