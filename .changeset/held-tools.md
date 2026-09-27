---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

A tool's `hotkey` can be any key. Besides `'space'` and the modifier names, a
tool may declare an ordinary key such as `hotkey: 'o'` and it engages while
that key is held, matched case-insensitively as every key spec is and never
while typing in a text field. A held key now releases even when its keyup
reports it differently from its keydown — Shift pressed mid-hold makes an `o`
press come up as `O`, which used to leave the tool stuck on.

Held-key engagement also works in a `<SceneCanvas>` with no `ActionsProvider`
of the consumer's own. Before, nothing registered `tool.offhand` there and
Space-for-hand did nothing. The registration is exported as
`useOffhandAction` for hosts that assemble their tools above their provider.
