---
'@weasel-js/path-tools': major
'@weasel-js/text-tools': major
'@weasel-js/rig': major
'@weasel-js/diagram': major
'@weasel-js/measure': major
---

The path, text, rig, diagram and measure actions act on the `operands` dep, the selection by default.

This is breaking for code that runs these actions with deps it builds by hand: each now declares `operands` in `requires` and reads it where it read `selection`, as core's editing actions do. On a `<SceneCanvas>` nothing changes, since `operands` answers with the selection unless a host sources its own. Selecting actions (diagram's edge pick and sequence-part pick, following an off-page tag) still read `selection`.

```ts
// before
snipAtCrossingsAction.invoker.run({ scene, selection, applyOps });
// after
snipAtCrossingsAction.invoker.run({ scene, operands: selection, applyOps });
```

<!-- entry: rank=0 breaking api -->
