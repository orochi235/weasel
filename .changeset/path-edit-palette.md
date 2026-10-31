---
"@weasel-js/modes": patch
"@weasel-js/routing": patch
"@weasel-js/core": patch
"@weasel-js/path-tools": patch
"@weasel-js/ui": patch
"@weasel-js/icons-plugin": patch
---

Path edit's tools are ordinary tools, and a mode can name the tool it starts on.

**Breaking:** the `pathEditTool.*` toggle actions (`pathEditToolAction`, `exitPathEditToolAction`,
`pathEditToolActive`, `simplifyBrushToolAction`, `lengthenToolAction`, `SIMPLIFY_BRUSH_TOOL`, `LENGTHEN_TOOL`) are
removed, as are the `editAnchors` dep's `tool` and `setTool`, `PathEditHost`'s `tool` and `setTool`, and
`AnchorState.tool`. The `simplifyBrush` and `lengthenPath` actions no longer bind a drag themselves: mount
`useSimplifyBrushTool` and `useLengthenTool` (or `usePathEditTools`, named by `PATH_EDIT_TOOLS`; `usePathToolsTools`
includes them), each carrying `edits-anchors`. Their bindings sit at the active tier, so they outrank anchor
editing's ambient drags; a Lengthen drag on an anchor that is no open end falls through to moving it.

`ModeDefinition.defaultTool` names the tool a mode starts on: entering the mode activates it, leaving restores the
tool active at entry, and Escape with another tool on returns to it before a second Escape leaves: a mode shortcut's
`exit` and `cancel` and core's `exitPathEdit` each call `returnToModeDefault` first, reading the new `modeDefaultTool`
dep `<SceneCanvas>` sources. `PATH_EDIT` names core's new `anchors` tool (key A, glyph `core:anchors`), which the
`pathEdit` preset mounts and `ANCHOR_TOOLS` names; it binds nothing and holds path edit's active slot. The pointer
cursor over an anchor or handle is now `editAnchors`' own `cursor`, so a path-edit tool's cursor shows there.

A `chromeRules` dep, which `<SceneCanvas>` sources, reads and sets chrome-visibility rules at run time. The toggles
`pathEdit.show.direction`, `.comb`, `.balance`, and `.corners` (group `pathOverlays`) use it to flip each overlay
between `always` and `never`, and come with the preset that draws it.

`ToolPalette` takes `ineligible: 'dim' | 'hide'`, default `dim`; `hide` leaves out every tool the current mode does
not allow. The Girth tool's palette group is now `path`, beside Trim, Extend, and the Smudge brush.

In the dev server and under vitest, `weaselIcons` in app mode stops looking for tables at the nearest workspace root
above the app, and reads that workspace's packages' source tables. It used to walk on into an enclosing checkout's
`node_modules` (a git worktree sits inside its main checkout), so a worktree served that checkout's glyphs: a glyph
added on the branch drew as "?", and one redrawn there drew as before.
