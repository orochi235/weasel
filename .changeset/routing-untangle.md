---
'@weasel-js/core': patch
'@weasel-js/gestures': patch
---

The routing layer's types now state where the dispatch boundary runs, instead of leaving it implicit inside two large interfaces.

`Action` splits into `ActionDispatch` — bindings, deps, invoker, scope, gates, cursors — and `ActionPresentation`: label, icon, group, shortcut. `Contribution` splits the same way into `ContributionRouting` and `ContributionChrome`. Both composed types keep every field they had, so nothing that authors an action or a contribution changes.

New alongside them: `BindingSource`, the id-plus-`defaultBinding` shape `actionBindings` reads; and `ActionSource`, the single `list()` method the gesture dispatcher consults a registry through. `actionBindings`, `BoundGesture`, `evaluateEnabled`, `ActionEnabledResult`, `SliceDep`, `ClipboardDep` and `TextEditDep` are re-exported from the same barrel entries as before, from new homes. `ClaimableGesture` now lives in `@weasel-js/gestures` beside `GestureName`, and is still exported from `@weasel-js/core`.

`_resetEnabledWarnsForTests` is removed. It had no callers and was never on the public barrel.

Under this, core's import graph loses a 15-file strongly connected component spanning contributions, tools, actions, the dep schema and the dispatcher. Nothing in routing, tools or contributions is in an import cycle now.

The consumer smoke test gained a check that a consumer's own `declare module '@weasel-js/core'` dep merges into `DepSchema` against the published declarations, and stopped reading a subpath import such as `@weasel-js/geom/booleans` as an undeclared package.
