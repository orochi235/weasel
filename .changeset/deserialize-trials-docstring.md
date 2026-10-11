---
'@weasel-js/labkit': patch
---

`deserializeTrials`'s docstring said it returns an empty list rather than throwing on malformed input. That holds only for input that is not an array, and the docstring now says so.
