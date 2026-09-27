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

`Tool.onActivate` now actually fires — it was declared and forwarded by
`defineTool` but nothing called it. A tool is live while it holds the active
slot or is held by its `hotkey`: `onActivate` fires as it becomes live in
either, and `onDeactivate` as it stops being live in both, or when the canvas
unmounts. `onDeactivate` used to fire only when the active tool changed, never
when a held tool was released. Both receive `ToolLifecycleCtx` — just
`{ scratch }`, which is all `onDeactivate` was ever given; the parameter was
typed as a full `ToolCtx`, so a callback annotated that way no longer
typechecks and should close over what else it reads.
