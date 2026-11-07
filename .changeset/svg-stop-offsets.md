---
'@weasel-js/svg': patch
---

An imported gradient kept each `<stop>`'s `offset` as written. SVG clamps an offset to 0..1 and raises one below an earlier stop's to that offset, so `0.5 red, 0.2 blue` is a hard edge at 0.5; the kit sorts stops by offset, so it painted blue first and red second, the gradient reversed. `parseSvg` now resolves offsets as SVG does.
