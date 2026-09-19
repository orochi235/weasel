---
'@weasel-js/forge': patch
---

forge's CSS Vars panel follows a change to any attribute in the frame, not only
`style` and `class`. A theme switched by an attribute such as `data-wzl-mode` —
say, by following the OS color scheme with no globals change behind it — now
shows the new mode's values.
