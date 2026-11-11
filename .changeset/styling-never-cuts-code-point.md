---
"@weasel-js/text": patch
---

Styling never splits a character in two: a range end inside an emoji or other surrogate pair widens to take the whole character.

`applyStyleToRange`, `setFlagOverRange` and `styleAtRange` all read ranges this way; styling a combining mark on its own is unchanged. Runs that already split a pair lay it out and case-map it as one character, in the style of the run holding its first half.

<!-- entry: fix -->
