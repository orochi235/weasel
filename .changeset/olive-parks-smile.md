---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`RuleCtx` carries a zoom, not a `View`.

`zoomAtLeast` is the only selector that ever read the viewport, and one number
is all it needs. A host whose viewport is a camera had no `View` to hand over,
so it could not build a rule context at all — and a dispatcher with no
`getRuleCtx` skips every eligibility rule silently rather than failing.

`RuleCtx.view: View` is now `RuleCtx.zoom?: number`, `BuildRuleCtxArgs` the
same, and `zoomAtLeast` declines when no zoom is reported. `viewZoom(view)` is
exported from `@weasel-js/core` for the 2D callers that now pass it; the legacy
`ChromeCtx` shape still carries a `View` and `resolveVisibility` converts.
