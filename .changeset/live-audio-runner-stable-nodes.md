---
'@weasel-js/diagram': patch
---

`useLiveAudioRunner` no longer remakes its runner when `nodes` is rebuilt in render with the same entries, so `nodes={{ ...audioStageNodes, mine }}` written inline stops re-rendering forever. Adding, dropping or replacing a stage type's node still remakes it.
