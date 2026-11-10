---
"@weasel-js/quantity": patch
---

`fraction` and `ratio` displays read typed text in the locale `parseAs` is given, as the other kinds do: `0,5` is one half in `de-DE`, and `١/٢` in `ar-EG`. They read every number as `en-US`, so a decimal typed with the locale's own mark or digits came back NaN.
