---
'@weasel-js/forge': patch
---

forge's dependency graph reads a meta `component` such as `Tabs.Panel` as the `Panel` that `Tabs`'s file declares. When that file declares none, the component has no source, rather than `Tabs`'s.

<!-- entry: fix -->
