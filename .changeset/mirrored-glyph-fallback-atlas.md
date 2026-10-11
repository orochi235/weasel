---
'@weasel-js/text': patch
---

With a `bidi` engine, a bracket in right-to-left text whose mirrored form is missing from the run's atlas was drawn as an arbitrary patch of that atlas: `layoutRuns` took the mirrored glyph from the fallback tier but kept sampling the original texture. The mirrored glyph is now drawn from the tier that served it. Under the `'none'` fallback policy the bracket stays unmirrored, as before, without the warning that claimed it was skipped.
