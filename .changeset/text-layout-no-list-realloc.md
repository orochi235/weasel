---
'@weasel-js/text': patch
---

Re-laying out text allocates less each call: `measureRuns`, `breakLines` and the grapheme and line-break scans refill their reused lists in place instead of emptying and regrowing them, and `measureRuns` walks runs and code points without a closure or a string per code point. Layouts are unchanged.
