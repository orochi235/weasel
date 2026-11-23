---
"@weasel-js/diagram": patch
---

`clusterStages` and `EffectEditorApi.cluster` leave out ids that name no stage or cluster, and make no group, returning `null` from the editor, when none is left.

<!-- entry: fix -->
