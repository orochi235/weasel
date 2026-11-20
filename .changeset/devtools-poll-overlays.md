---
"@weasel-js/devtools": patch
---

The devtools State and Frame tabs show overlay flags and probes that change without a notice.

The tabs re-read them while open, so a flag the app sets through its own `debug` prop, or another tab flips, shows.

<!-- entry: fix -->
