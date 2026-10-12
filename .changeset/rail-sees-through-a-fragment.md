---
'@weasel-js/ui': patch
---

A `PrefsForm` rail lists what an `as: 'fragment'` group holds as its parent's. A page inside a fragment gets a rail entry and a page of its own, where it used to be drawn as a section where the fragment sat, and a section inside a fragment that sits on a page gets the entry that scrolls to it. A group with no `as` inside a top-level fragment is still a section, since its depth is what decides. `prefRailItems` and `prefRailAbove` return these entries, which changes what they return for a schema with a page or section inside a fragment. Made on an agent's judgment: a fragment is read as a pure macro.
