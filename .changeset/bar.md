---
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
---

A group can be drawn as a bar. `PrefGroupAs` gains `'bar'`, and `Bar` draws one from a schema: `schema`, `values` keyed by dotted path, `onChange`, `mixed`, and `renderers`, as `ToolOptionsBar` takes them, plus `orientation` and `label`. A leaf is a cell in its bar form. A nested `section`, `bar`, or `fragment`, or a group that says nothing, is a run with a divider on each side and no heading. A nested `page`, `tab`, or `panel` opens from a button reading its name, as rows. A vertical bar has no room beside a field, so every leaf but an action opens from a button.

`Bar` has no frame; the host gives it the strip it sits on. `BarLayout` is the line itself, for a surface with its own values and cells, and `groupBarNodes` reads a group into what it lays out.

`ToolOptionsBar` draws its schema with a `Bar`, so a nested group there is now a run between dividers, or a button for a `page`, `tab`, or `panel`, where its leaves used to join the line unmarked.

The icon set gains `formBar`.
