---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A sidebar narrower than 200px stacks its paired rows. At 140px, the narrowest a drag makes a `Split`'s sidebar, two label-beside-value rows shared one line and a value ran out of its cell and under the next row's label; forge's Globals section showed it.

Adds API: `--wzl-prop-columns`, the track list a `PropertyList`, a `PropertyGroup` body and a `Subpanel` lay their rows on. It defaults to `1fr 1fr`; a container that knows it is too narrow for two columns sets `minmax(0, 1fr)`.

`Split`'s sidebar pane is now a size container named `lk-split-sidebar`, which is how it sets that. A pane that is a container is also a containing block for a `position: fixed` descendant and a stacking context of its own. The 200px threshold was chosen on an agent's judgment.
