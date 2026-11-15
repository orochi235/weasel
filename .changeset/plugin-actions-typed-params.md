---
'@weasel-js/diagram': major
'@weasel-js/editor': major
'@weasel-js/forge': major
'@weasel-js/guides': minor
'@weasel-js/hud': major
'@weasel-js/kernel3d': major
'@weasel-js/labkit': major
'@weasel-js/loupe': major
'@weasel-js/minimap': major
'@weasel-js/rig': major
---

Bindings and triggers of the plugin packages' actions that read params are checked against their `ActionParamSchema` entries.

Each package merges its entries into routing's schema from its own `actionParamSchema.ts`: the diagram's label, waypoint, lane, container-title, off-page, rename-group, and sequence actions; `hud.press`, `hud.release`, `hud.doubleClick`, `hud.contextMenu`, `hud.longPress`, and `hud.wheel`; `loupe.aim` and `loupe.magnify`; `minimap.center` and `minimap.zoom`; `bone.pick`, `weight.paint`, and `weight.click`; `lab.zoom`, `camera.tap`, and `loupe.follow`; `loupe.compare.with` and `loupe.compare.dpr`; and `camera.dolly`. New exported types: diagram's `DrawMessageParams` and `WrapFragmentParams`, `HudPointParams`, `HudWheelParams`, `LoupeAimParams`, `MinimapZoomParams`, `WeightBrushParams`, `LabZoomParams`, `DollyParams`, guides' `DistanceReadoutParams`, and forge's `ForgeCompareParams` and `ForgeComparison` from `@weasel-js/forge/shell`.

This is breaking for code that passes one of these ids params its entry does not declare: that is now a type error. `useDocClipboard`'s `commands.paste.keys` takes `clipboard.paste`'s params. The diagram's `*ScratchOf` readers take the hit as `unknown`.

<!-- entry: breaking api -->
