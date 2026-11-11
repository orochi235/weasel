---
"@weasel-js/diagram": patch
---

Where nothing measures text, a row, an edge label, or a header estimates one glyph per character rather than per UTF-16 unit, so an emoji or other character outside the Basic Multilingual Plane no longer counts twice; its tracking already counted it once. `canvasMeasure` reports a `capCenter` of 0 for a 0px font instead of `NaN`.
