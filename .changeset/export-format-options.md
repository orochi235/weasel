---
'@weasel-js/export': minor
'@weasel-js/svg': minor
'@weasel-js/pdf': minor
---

`exportRegions` warns in development about an option the chosen format does not read, such as `compres` for `'pdf'` or `lang` for `'svg'`.

An `ExportFormat` lists the options it reads beyond the shared ones in `options`; png, svg and pdf do. A format that leaves it out is not checked. `pickExportOptions(format, opts)` picks what a format reads.

<!-- entry: api new -->
