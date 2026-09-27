---
'@weasel-js/forge': patch
---

A global can follow the lab's own chrome. A declaration with `follows` offers
`App` first on the lab's toolbar, and while the lab's value is `App` the global
takes what `follows` reads from the chrome (`LabChrome`, which carries the lab
header's mode switch). Picking any other value overrides the chrome for the
trials; a trial's pin still follows the lab or names a value. `FOLLOW_APP` and
`LabChrome` are exported.

The repo's workshop uses it for Mode, whose default is now `App`: the header's
Auto/Light/Dark switch reaches every story and index page until a Mode is picked,
where before it styled only the workshop's chrome. A new Theme global picks the
theme trials are rendered in, from weasel and interstellar, lab-wide or pinned
per trial in Settings → Globals.
