---
'@weasel-js/pdf': patch
'@weasel-js/diagram-formats': patch
---

PDF export writes the document's language as the catalog's `/Lang`, and marks text in another language with
its own `/Lang`, so a screen reader or text extraction no longer guesses it. `writePdf` and `exportPagesPdf`
take the document's language as a new `lang` option; left out, it is the language every run of text shares,
and the document has none when they do not share one. A run's language is its `lang`, or its text node's.
