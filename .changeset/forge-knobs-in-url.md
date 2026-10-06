---
'@weasel-js/forge': patch
---

The workshop keeps a story's knobs in its URL: `#/<story id>?label=Save&look.px=8`. Opening such a URL shows the story at those values, a knob inside a group is named by its dotted path, and each value is read as its control's type, with one that does not parse ignored. Changing a control rewrites the URL in place, values at their default are left out, and moving to another story drops the previous one's knobs. `t` is reserved and never a knob. `parseRoute`, `formatRoute`, `paramsToKnobs`, `knobsToParams` and `storyHref` are exported for a host building links to a story at a given state.
