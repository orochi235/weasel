---
'@weasel-js/labkit': patch
---

A trial can be opened on a subject, and `annotations.targets` is told which trial is asking.

`addTrial(name, { config })` writes a seed over the instrument's `defaultConfig()` before `initialState` reads it, so a trial opened on a subject is running that subject from its first frame. The seed is kept on the record, so Reset returns the trial to what it opened on rather than to the bare defaults; a key whose seeded value is `undefined` is left to the default. `addTrial(name)` is unchanged. Without this, `defaultConfig()` was the only hook and takes no arguments, which left a caller smuggling the subject through a module-level slot that `defaultConfig` read and cleared.

`annotations.targets` takes the asking trial as a third argument: `targets(state, config, trial)`, where `trial.id` is the id `useTileId` scopes a surface tile under and `trial.view` is that trial's camera. A declaration is made once per instrument and called once per trial, so a consumer holding per-trial DOM refs previously had to smuggle a trial key through its own instrument state and key a registry by it, and a per-trial camera had to ride in a ref. Both were invisible with one trial open. A two-argument `targets` keeps working.

**`AnnotationTargets` takes a matching required `trial` prop, which breaks any consumer rendering it directly.** Required rather than defaulted from context on purpose: one rule instead of two paths, and a caller that has not thought about which trial it is drawing for gets a type error rather than silently sharing the first trial's targets. Pass the trial the component is drawing for.

`TrialInfo` — `{ id, view }` — is exported, and `RenderContext.trial` is typed from it, so `ctx.trial.id` in `render` and `trial.id` in `targets` are one notion.
