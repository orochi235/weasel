---
"@weasel-js/forge": patch
---

A story link keeps a knob keyed `__proto__`: the knob params written for a trial, the knobs read back from a URL, and `storyHref`'s params set it as an own key, where an assignment had changed the object's prototype and lost it. A group keyed by the empty string no longer gives its leaves the same params as the root's, which made one knob in the URL set two leaves.
