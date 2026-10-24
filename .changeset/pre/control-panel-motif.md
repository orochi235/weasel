---
"@weasel-js/labkit": patch
---

A `ControlPanel` group or section can be drawn in a `MotifFrame` motif from `@weasel-js/ui`, such as `stereo()`: `f.group({...}).motif(stereo())` on a group, `.section('Look', { motif: stereo() })` on a section, and `<ControlPanel motif>` for every group and section that names none. Unset, they draw as before.
