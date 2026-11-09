---
"@weasel-js/routing": patch
---

A tool held on a Ctrl or Meta hotkey now lets its `mod` bindings fire with that key down on the platform where `mod` is the other key (a Cmd binding with the Ctrl hold down on a Mac), while `mod` keeps its own key required; a `mod: false` binding still refuses the held key.
