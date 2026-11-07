---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

An auto setting now falls off as soon as anyone touches it. An auto row keeps its control live, ghosted in the secondary accent, at the value in effect (the instrument's report, else the resolver's, else the leaf's default), and any edit pins the path at the new value: a slider drag or arrow key, a typed number, an enum pick, a checkbox toggle. There is no need to click the label or the pin dot first; they still hand the row back to auto. A slider whose readout is the word takes the keyboard itself, so `getByRole('slider', { name })` and the arrow keys reach it. A standalone `<ControlPanel>` that keeps its own auto set unpins a row it edits.

This is breaking for `@weasel-js/ui`'s `<PropertyRow>`: `autoControl` is gone, and every auto row draws its control the way `autoControl="dimmed"` did. Clicking a row's label back to pinned now pins at the value the row draws, which for a field with no report and no resolver is its default rather than the last pinned value.
