---
'@weasel-js/labkit': patch
---

Export `TrialLayout`

`Workspace` types its `layout` and `onLayoutChange` props as `TrialLayout`, but
the type itself reached no barrel. Persisting a workspace layout and handing it
back meant recovering the type structurally, as
`NonNullable<ComponentProps<typeof Workspace>['layout']>`. It is now a named
type export from the package root.
