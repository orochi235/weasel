---
'@weasel-js/labkit': patch
---

Give every trial a trial-id scope, and mount a shared drawing surface.

`useTrialState()` threw inside any instrument hosted by a `<Lab>`:
`<TrialIdProvider>` had one production mount, in `SingletonExperiment`, so the
documented trial-scoped hook pattern was unreachable from an instrument's
`render`. `<Trial>` now provides it, outside `<TrialChrome>`, so contributions
can read trial state too.

`useTiledSurface` had no production provider, so `useSurfaceOptional()` always
answered null and a registered tile reached nothing — including `Workspace`'s
own rect invalidation on grid moves, which was written against a surface
nothing supplied. `<Lab>` mounts one, anchored to `.lk-lab__body`, and defers
to a surface its host already owns rather than opening a second GL tenancy.
