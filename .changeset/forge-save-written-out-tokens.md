---
'@weasel-js/forge': patch
---

The CSS Vars panel saves a token edited by hand into the theme's definition file, where it saved scale edits only. A token saves when the definition writes its value out: a pin, a component or a literal semantic, and only the branch the trial's globals read, so an edit made in dark mode leaves the light value alone. A token the theme derives, from another token, a ramp, a rule or an alpha, stays a per-trial override as before, and so does a scale step. The button reads "Save to theme", where it read "Save scales to theme".

Which tokens save, and that a derived one is left alone and not flattened to the edited value, was decided on an agent's judgment.
