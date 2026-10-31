---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Tools can declare options: `ToolDef.options` names the action they are params of, a prefs group of number leaves
(their bounds and defaults), and which one is the tool's size and which its strength. `<SceneCanvas>` tunes the
action from the values the host keeps in the new `toolOptionValues` dep (`ToolOptionValues`, published with
`useToolOptionValues`; `createToolOptionValues` keeps them in memory). `defineTool` adds step actions for the size
and strength, bound to `[` `]` and `Shift+[` `Shift+]` while the tool is the active one, so they win over the same keys'
anchor-selection commands only then.

The Smudge brush (`SMUDGE_BRUSH_OPTIONS`: size, strength) and the Simplify brush (`SIMPLIFY_BRUSH_OPTIONS`: size,
tolerance) declare theirs. Size steps by ×1.25; the Smudge brush's strength by 0.1, the Simplify brush's tolerance by
×1.25.
