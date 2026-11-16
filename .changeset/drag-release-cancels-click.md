---
'@weasel-js/ui': patch
'@weasel-js/prefs-editor': patch
---

Dropping a reordered bar item, a toolbar dock, or a pref preview row cancels its release's click, so the label it began on does not act.

<!-- entry: fix -->
