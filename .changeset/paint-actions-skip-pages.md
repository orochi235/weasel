---
'@weasel-js/editing': patch
---

The fill, stroke and vertex color actions leave a selected page unpainted, and are disabled when only page structure is selected.

Nudge reports `SelectionRequired` rather than `NotApplicable` with only page structure selected.

<!-- entry: fix -->
