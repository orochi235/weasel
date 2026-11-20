---
"@weasel-js/devtools": patch
---

The devtools State and Frame tabs keep up with overlay flags and probe values that change without a notice, as when the app sets its own `debug` prop or another tab flips a flag.

<!-- entry: fix -->
