---
"@weasel-js/diagram": patch
---

An effect pipeline can be run, not only drawn. `runPipeline` evaluates it in `runOrder` with an
`EffectEvaluator` per stage type and an `EffectValueKind` per value type, filling each stage's cost,
values, and previews; a stage nothing reaches is skipped, a bypassed stage passes its input through,
a throwing evaluator records its `error`, and stages on a cycle never run. `createEffectRunner` runs
one pipeline whole, a stage at a time (the run's new `at`), or every frame while playing, and closes
the previews of runs that are off screen; `useEffectRunner` plays it through `useVisibleRaf`.
`IMAGE_STAGE_TYPES`, `imageEvaluators`, `imageValueKinds`, and `testCard` run image pipelines on
`OffscreenCanvas`. `paintRun` outlines the stage a run is `at` and writes a stage's `error` where its
cost goes, and `EffectEditor` takes a `run`, fading the port dots of unreached stages as
`EffectChart` does.

weaselchart's pipeline mode has a Run menu (Run, Step, Play, Pause, Reset, and Choose Source
Image…) and View › Show Values and Show Previews; its stage palette is now `IMAGE_STAGE_TYPES`.
