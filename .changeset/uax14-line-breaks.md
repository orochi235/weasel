---
"@weasel-js/text": patch
---

`layoutRuns` wraps at the break opportunities of the Unicode Line Breaking
Algorithm (UAX #14, Unicode 16.0) instead of only at spaces, so a wrapped line
breaks after a hyphen or between CJK characters where the browser does, and the
edit overlay no longer reflows such a line when an edit opens. It also stops
breaking where UAX #14 forbids a break even after a space, such as before `!`,
`?`, `,` or a closing bracket. This is a behavior change: text with those
characters may wrap differently than before. Text of words, spaces and
word-final punctuation wraps exactly as it did. A word wider than the line
still overflows rather than breaking inside itself.

Additive: `lineBreakOpportunities(codePoints)` returns, for each position, one
of `NO_BREAK`, `BREAK_ALLOWED` or `BREAK_MANDATORY`, for a consumer running its
own line fitting. It passes all of Unicode's `LineBreakTest.txt`.
