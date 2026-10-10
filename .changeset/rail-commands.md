---
"@weasel-js/labkit": patch
"@weasel-js/forge": patch
---

A command on a tool rail is its own type. `ToolItem` is now only a tool: it has no `onActivate` and no type parameter. A button that runs once when pressed is a `CommandItem`, which `ToolbarItem` now extends, and a `palette` contribution takes a `RailItem`, which is either one.

This is breaking for code that names the type. `ToolItem<TCtx>` becomes `ToolItem` for a tool, `CommandItem<TCtx>` for an item carrying `onActivate`, and `RailItem<TCtx>` where either may arrive. A contribution written as an object literal needs no change. forge's Info button is declared as a `CommandItem`.
