---
"@weasel-js/forge": patch
---

The Accessibility panel no longer asks for a review of every story's text contrast. axe judged contrast against the whole workshop page, so it gave up on text under labkit's overlay canvas (light mode) or over the lab's starfield backdrop (dark mode); forge now judges those elements itself with the workshop left out, using axe's own stack, color parsing, and thresholds, and reports them as passes or violations. Text the story itself makes undecidable, such as a button's gloss, stays under "Needs review", and every review item now says why in plain words. `A11yNode` gains an optional `reason` carrying axe's message key and sentence.
