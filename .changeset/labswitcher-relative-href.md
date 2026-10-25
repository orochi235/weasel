---
'@weasel-js/labkit': patch
---

`LabSwitcher` marks the open page when its `href` is relative. Each `href` now resolves against the location the way its link does, so `./effects` and `../bench` match the page they lead to, and a full URL on another origin matches nothing.
