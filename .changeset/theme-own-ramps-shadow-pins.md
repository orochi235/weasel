---
'@weasel-js/theme': patch
---

A theme that declares a ramp or scale now generates those steps itself: pins held on them by the themes it extends no longer apply, while its own pins still do. Previously a theme extending weasel inherited weasel's pins on every gray, accent and swatch step, so none of its own ramps could show. A theme that redeclares a ramp and relied on the parent's pins must pin those steps itself.
