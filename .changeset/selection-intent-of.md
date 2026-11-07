---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

The select tool now reads the selection's own keys. `SelectionApi` gains `intentOf(modifiers)`, which says whether a click would replace, toggle or range under the configured `mode`, `extend` and `range`. `select.pick` and `select.deep` ask it instead of assuming Shift extends. Under `useSelection({ mode: 'multi', extend: 'meta', range: 'shift' })`, a Cmd-press on a member of a multi-selection now toggles it on the press, and `extendClickLocked` now holds back the Cmd toggle and the Shift range rather than a Shift press that would only replace.

Breaking for anything that implements `SelectionApi` itself: it must now provide `intentOf`. `intentOf` from `@weasel-js/select` answers it for any policy.
