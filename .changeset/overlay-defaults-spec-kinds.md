---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`routeGestureForSpecKind` and its inverse `specKindForRouteGesture` now live in `@weasel-js/gestures`, read from one table; `routeToSpec` and routing's route registry both use it. `@weasel-js/routing` and `@weasel-js/core/routing` re-export both.

Every routing type with an overlay parameter — `Tool`, `ToolDef`, `ViewportToolDef`, `Contribution`, `ContributionChrome`, `useTools` and `useContributions` with their option and result types — now defaults it to the kernel's overlay type (`KernelOverlay`), as `defineTool` already did. Under core that is `RenderLayer`, so a routing `Tool<S>` fits `<SceneCanvas tools>` without naming the overlay. Functions that read tools without reading overlays (`buildRouteRegistry`, `findConflicts`, `reportRouteConflicts`, the dispatcher's `toolsById`) take any overlay explicitly.
