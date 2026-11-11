---
'@weasel-js/routing': patch
---

Tool options hold any prefs leaf, not only numbers, and a shared option is one value that every tool naming it reads and writes.

An option names its shared key with `ToolOptions.share`; `shareToolOptions` lays a use site's share over a tool's own, `null` keeping an option per tool. Every read and write resolves its slot through `toolOptionSlot`, with `setToolOption`, `keepToolOptions` and `heldToolOptions` beside `toolOptionParams`. `ToolOptions.actionId` may name several actions. `toolOptionsPrefs` builds the prefs group a host keeps options in, a group per tool and one `shared` group with host-given defaults, and `prefsToolOptionValues` reads and writes them in a prefs store. `withToolOptionDefault` changes one option's default. A tuning marked `under` lies beneath every other tuning of its action. The size and strength step actions are exported as before.

Breaking: `ToolOptionValues.get` returns `Record<string, unknown>`, and `set` takes any value and an owner, a tool's id or `SHARED_TOOL_OPTIONS`.

<!-- entry: rank=10 breaking new api -->
