---
'@weasel-js/ui': patch
---

`ToolOptionsBar` draws a tool's options from a schema.

Pass `schema` (a `ToolPrefGroup`), `values` keyed by dotted path, and
`onChange(path, value)`, and the bar draws each visible leaf on one line; a run
of paired toggles collapses into one segmented bar, and `mixed` marks paths
whose sources disagree. `renderers` overrides a control by path or by kind, and
`children` still render beside the schema for tenants that are not a tool's
options.

The leaf → control mapping moved out of `SelectionPanel` into a shared module
that both call, so a leaf kind gets its control decided once. `SelectionPanel`'s
public surface is unchanged.
