---
'@weasel-js/diagram-formats': patch
---

DOT detection no longer claims text whose first word only starts with `graph` or `digraph`, such as `graphite { }`, so another format can read it.

<!-- entry: fix -->
