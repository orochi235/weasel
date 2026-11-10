---
"@weasel-js/text": patch
---

Styling never cuts a character in two. `applyStyleToRange` and `setFlagOverRange` widen a range end that falls between the two halves of a surrogate pair (an emoji, a flag's letter, an astral letter) so the whole character takes the style, and `styleAtRange` reads such a range the same way. Styling a combining mark on its own is unchanged. Runs that already split a pair now lay out and case-map it as one character, in the style of the run holding its first half, instead of two broken halves.
