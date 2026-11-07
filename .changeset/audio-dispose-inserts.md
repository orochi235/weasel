---
'@weasel-js/audio': patch
---

Disposing an engine, or a `createBusGraph`, left every bus insert wired and never called its `dispose`, so a delay insert's feedback loop outlived an engine running on a context you own. The same effect added to `engine.graph()` was already torn down. Every insert now leaves at once and has its `dispose` called, and each bus's input is left wired straight to its fader.
