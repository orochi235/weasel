---
'@weasel-js/theme': patch
---

A pin's `scope` now survives `bake` and a `toDTCG` / `loadDTCG` round trip, as it already did `defineTheme`: a theme file that asks for a token's pref to be scoped by an axis gets that scope in `themePrefsSchema`. DTCG output carries it as a `com.weasel.scope` extension.
