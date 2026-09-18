---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Controls can be set to auto. Shift-click a row in a labkit control panel — or
click the pin dot beside its label — and the field stops holding a pinned
value: the instrument decides instead, and the control draws ghosted at what it
decided.

`auto` is a value you write anywhere a config value goes, so `setConfig('gap',
auto)` and a trial's seed config both work. A schema starts a field unpinned
with `.initial(auto)`, attaches a resolver with `.auto(fn)`, and opts a field
out entirely with `.manual()` — for a value the instrument cannot receive as
`undefined`. The sentinel is normalized into a per-trial set of unpinned paths
at every boundary, so nothing stores or serializes it, and the last pinned
value stays where it is: un-pinning is lossless, and Reset returns a trial to
the auto paths it opened on.

This adds API and changes nothing existing. Property rows in `@weasel-js/ui`
take `auto` and `onAutoChange`; a `Select`'s trigger and an alpha range read
new color and border hooks that default to what they already rendered; a
control renderer's argument gains two fields.
