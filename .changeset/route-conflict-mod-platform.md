---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Fixes: the route-conflict check never compared `mod` with the key it resolves to, so `mods: { mod: true }` on one binding and `mods: { ctrl: true }` on another went unreported though both match Ctrl off a Mac, and likewise `mod` against `meta` on one. The check now buckets bindings once per platform, reading `mod` as `meta` on a Mac and `ctrl` elsewhere.

Changes behavior: a consumer whose bindings tie this way will see a new `[weasel] route conflict` warning in development. Two bindings of one action with equal `params` that tie on one platform only are not reported, since whichever fires does the same thing; `viewport.zoom` binds its wheel to both `mod` and `ctrl` that way. The same pair tying on both platforms is still reported as a duplicate. That exemption was chosen on an agent's judgment.

Adds API: `RegistryEntry.params`, the binding's `opts.params` as declared.
