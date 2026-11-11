---
"@weasel-js/pdf": patch
---

A path or a group clip holding a non-finite coordinate is dropped and reported as a non-finite command before any
geometry runs on it. An outlined stroke of one could throw out of `writePdf` instead.
