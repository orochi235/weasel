---
'@weasel-js/theme': patch
---

List the panel-label and Select hooks in the token manifest.

`--wzl-params-label-case`, `-tracking`, `-align` and `-width`, and
`--wzl-select-border` and `--wzl-select-fg`, were already read by the kit with
fallbacks but missing from `TOKEN_HOOKS`, so the manifest did not list them as
override points.
