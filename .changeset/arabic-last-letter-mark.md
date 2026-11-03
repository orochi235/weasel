---
'@weasel-js/pdf': patch
---

An exported PDF's Arabic text reads back as written when a mark sits on a word's last letter: `بَبَ بت` used to come back from pdf.js as `بَب َ بت` and from poppler (`pdftotext`) as `ب بتبَ َ`, and now comes back from both as `بَبَ بت`. Each right-to-left mark's code now has a width that takes the pen back to just before its base, so poppler puts the mark ahead of the base in its word. Where a mark follows a space, or that width moves the pen back, the text also carries one extra glyph, raised far off the page so neither reader takes it for text, whose kern puts pdf.js's pen back where pdf.js measures the word gap from. Every glyph is drawn where it was.
