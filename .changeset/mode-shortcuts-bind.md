---
"@weasel-js/routing": patch
"@weasel-js/modes": patch
"@weasel-js/core": patch
---

A mode's declared shortcuts now reach the dispatcher. `modeShortcuts(registry, handlers)` returns an always-on contribution with one action per `entry` / `exit` / `discard` / `commit` / `cancel` chord, gated on the mode it acts on and riding the hotkey tier, so leaving a mode outranks Escape clearing the selection while a gesture in flight still cancels first. Pass it in `<SceneCanvas ambient>`; a role with no handler binds nothing. `ModeDefinition` gains `discard` (the soft presets declare Meta+Escape), and `ModeRegistry` gains `list()` — a hand-written registry has to add it.

`useTextEdit` / `useSceneTextEdit` take `escape: 'commit'` to keep the text on Escape instead of dropping it.
